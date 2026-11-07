import { randomBytes } from 'node:crypto'
import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import mail from '@adonisjs/mail/services/main'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'
import AppException from '#exceptions/app_exception'
import StoreRole from '#enums/store_role'
import Store from '#models/store'
import User from '#models/user'
import env from '#start/env'
import StaffInviteNotification from '#mails/staff_invite_notification'
import StoreAccessNotification from '#mails/store_access_notification'
import { storeBrand } from '#mails/layout'
import NotificationService from '#services/notification_service'
import NotificationPreferenceService from '#services/notification_preference_service'
import PasswordResetService from '#services/password_reset_service'
import { ONLINE_WINDOW_MS, forgetLastSeen } from '#helpers/user_activity'
import { hasActiveStore } from '#helpers/membership'

type Membership = { role: StoreRole; disabled_at: Date | null }

const iso = (value: Date | null) => (value ? DateTime.fromJSDate(value).toISO()! : null)

export type StoreMember = {
  id: string
  name: string | null
  email: string
  avatarUrl: string | null
  role: StoreRole
  since: string
  invitePending: boolean
  /** When the pending invite's link stops working (null: no invite pending). */
  inviteExpiresAt: string | null
  emailVerified: boolean
  online: boolean
  lastSeenAt: string | null
  /** Access to this store switched off by a manager (null: active). */
  disabledAt: string | null
  /** Platform admin: always has access, can't be switched off here. */
  superUser: boolean
}

const ROLE_ORDER = [StoreRole.MANAGER, StoreRole.ATTENDANT, StoreRole.KITCHEN]
const INVITE_TTL = { days: 7 }

/**
 * The team of a store (store_user.role). Managers add people by e-mail:
 * existing accounts are linked, new ones get an invite to create their
 * password (and can get it again while they haven't used it). Managers can
 * switch someone's access to the store off and on (their sessions end) and
 * see who is online. A store always keeps at least one active manager.
 */
@inject()
export default class StoreMemberService {
  constructor(
    private passwords: PasswordResetService,
    private notifications: NotificationService,
    private preferences: NotificationPreferenceService
  ) {}

  async list(storeId: string): Promise<StoreMember[]> {
    const rows = await db
      .from('store_user as su')
      .join('users as u', 'u.id', 'su.user_id')
      .where('su.store_id', storeId)
      .select(
        'u.id',
        'u.name',
        'u.email',
        'u.avatar_url',
        'u.invite_pending',
        'u.email_verified_at',
        'u.last_seen_at',
        'u.super_user',
        'su.role',
        'su.created_at',
        'su.disabled_at'
      )
    // When each pending invite's link (the latest one) stops working.
    const pending = rows.filter((row) => row.invite_pending).map((row) => row.id)
    const invites = pending.length
      ? await db
          .from('password_reset_tokens')
          .whereIn('user_id', pending)
          .whereNull('used_at')
          .groupBy('user_id')
          .select('user_id')
          .max('expires_at as expires_at')
      : []
    const inviteExpiry = new Map<string, Date>(
      invites.map((invite) => [invite.user_id, invite.expires_at])
    )
    const onlineSince = Date.now() - ONLINE_WINDOW_MS
    return rows
      .map((row): StoreMember => ({
        id: row.id,
        name: row.name,
        email: row.email,
        avatarUrl: row.avatar_url,
        role: row.role,
        since: iso(row.created_at)!,
        invitePending: row.invite_pending,
        inviteExpiresAt: iso(inviteExpiry.get(row.id) ?? null),
        emailVerified: Boolean(row.email_verified_at),
        online:
          !row.disabled_at &&
          Boolean(row.last_seen_at) &&
          row.last_seen_at.getTime() >= onlineSince,
        lastSeenAt: iso(row.last_seen_at),
        disabledAt: iso(row.disabled_at),
        superUser: row.super_user,
      }))
      .sort(
        (a, b) =>
          ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) ||
          (a.name ?? a.email).localeCompare(b.name ?? b.email, 'pt-BR')
      )
  }

  async add(
    storeId: string,
    input: { email: string; name?: string; role: StoreRole },
    actor: User
  ) {
    const store = await Store.findOrFail(storeId)
    const email = input.email.trim().toLowerCase()

    const { user, invited } = await db.transaction(async (trx) => {
      let existing = await User.query({ client: trx }).whereILike('email', email).first()
      const isNew = !existing
      if (!existing) {
        // Unusable random password until they create theirs from the invite.
        existing = await User.create(
          {
            email,
            // users.name is required; the e-mail's local part until they change it.
            name: input.name?.trim() || email.split('@')[0],
            password: randomBytes(24).toString('base64url'),
            invitePending: true,
          },
          { client: trx }
        )
      }
      const membership = await this.membership(trx, storeId, existing.id)
      if (membership) {
        throw new AppException(
          membership.disabled_at
            ? 'Essa pessoa já faz parte da equipe, com o acesso desativado. Reative pela lista.'
            : 'Essa pessoa já faz parte da equipe.',
          409,
          'E_ALREADY_MEMBER'
        )
      }
      await trx.table('store_user').insert({
        user_id: existing.id,
        store_id: storeId,
        role: input.role,
        created_at: new Date(),
        updated_at: new Date(),
      })
      return { user: existing, invited: isNew }
    })

    if (invited) {
      await this.sendInvite(user, store, input.role, actor)
    } else {
      await this.notifications.notify(
        'store.member_added',
        {
          storeId,
          storeName: store.name,
          role: input.role,
          addedBy: actor.name ?? actor.email,
        },
        // The e-mail is StoreAccessNotification below (store's look, role),
        // not the generic one: one e-mail, still as the person chose.
        { userIds: [user.id], storeId, email: false }
      )
      const deliveries = await this.preferences.deliveries([user.id], 'store.member_added', storeId)
      if (deliveries.get(user.id)?.email) {
        await mail.sendLater(
          new StoreAccessNotification(
            { email: user.email, name: user.name },
            { store: storeBrand(store), role: input.role, addedBy: actor.name },
            `${env.get('FRONTEND_URL')}/app/stores/${storeId}`
          )
        )
      }
    }

    const members = await this.list(storeId)
    return { member: members.find((candidate) => candidate.id === user.id)!, invited }
  }

  /**
   * A new invite link (the previous one stops working) for a member who
   * hasn't set a password or signed in yet.
   */
  async resendInvite(storeId: string, userId: string, actor: User) {
    const store = await Store.findOrFail(storeId)
    const membership = await db
      .from('store_user')
      .where({ store_id: storeId, user_id: userId })
      .first()
    if (!membership) throw new AppException('Membro não encontrado nesta loja.', 404)
    if (membership.disabled_at) {
      throw new AppException(
        'O acesso dessa pessoa a esta loja está desativado. Reative antes de reenviar o convite.',
        409,
        'E_ACCESS_DISABLED'
      )
    }
    const user = await User.findOrFail(userId)
    if (!user.invitePending) {
      throw new AppException(
        'Essa pessoa já acessou o painel. Se esqueceu a senha, ela pode usar "Esqueci minha senha".',
        409,
        'E_INVITE_ACCEPTED'
      )
    }
    await this.sendInvite(user, store, membership.role, actor)
    return user
  }

  private async sendInvite(user: User, store: Store, role: StoreRole, actor: User) {
    const url = await this.passwords.issueLink(user, INVITE_TTL, { invite: true })
    await mail.sendLater(
      new StaffInviteNotification(
        { email: user.email, name: user.name },
        { store: storeBrand(store), role, invitedBy: actor.name },
        url
      )
    )
  }

  async changeRole(storeId: string, userId: string, role: StoreRole) {
    await db.transaction(async (trx) => {
      const current = await this.requireMembership(trx, storeId, userId)
      if (current.role === role) return
      if (current.role === StoreRole.MANAGER && !current.disabled_at) {
        await this.assertAnotherManager(trx, storeId, userId)
      }
      await trx
        .from('store_user')
        .where({ store_id: storeId, user_id: userId })
        .update({ role, updated_at: new Date() })
    })
    const members = await this.list(storeId)
    return members.find((member) => member.id === userId)!
  }

  async remove(storeId: string, userId: string) {
    await db.transaction(async (trx) => {
      const current = await this.requireMembership(trx, storeId, userId)
      if (current.role === StoreRole.MANAGER && !current.disabled_at) {
        await this.assertAnotherManager(trx, storeId, userId)
      }
      await trx.from('store_user').where({ store_id: storeId, user_id: userId }).delete()
      // Without any store left, there's nothing to do signed in.
      if (!(await this.hasActiveStore(trx, userId))) await this.endSessions(trx, userId)
    })
  }

  private async hasActiveStore(trx: TransactionClientContract, userId: string) {
    const user = await trx.from('users').where('id', userId).select('super_user').first()
    return Boolean(user?.super_user) || (await hasActiveStore(userId, trx))
  }

  /**
   * Switches the person's access to this store off (their sessions end, so
   * open panels sign out; other stores they belong to keep working after
   * they sign in again) or back on with the same role.
   */
  async setAccess(storeId: string, userId: string, enabled: boolean, actor: User) {
    if (userId === actor.id) {
      throw new AppException('Você não pode desativar o seu próprio acesso.', 409, 'E_SELF_ACCESS')
    }
    await db.transaction(async (trx) => {
      const current = await this.requireMembership(trx, storeId, userId)
      if (Boolean(current.disabled_at) === !enabled) return
      if (!enabled) {
        await this.assertNotSuperUser(trx, userId)
        if (current.role === StoreRole.MANAGER)
          await this.assertAnotherManager(trx, storeId, userId)
      }
      await trx
        .from('store_user')
        .where({ store_id: storeId, user_id: userId })
        .update({
          disabled_at: enabled ? null : new Date(),
          disabled_by: enabled ? null : actor.id,
          updated_at: new Date(),
        })
      // Nothing left to do signed in: the sessions end. With another store,
      // they keep working there (this store's requests are refused anyway).
      if (!enabled && !(await this.hasActiveStore(trx, userId))) {
        await this.endSessions(trx, userId)
      }
    })
    const members = await this.list(storeId)
    return members.find((member) => member.id === userId)!
  }

  /**
   * Signs the person out everywhere (e.g. a lost phone), without touching
   * their access. Sessions aren't per store, so only someone who manages
   * every store the person works in (or a super user) can do it.
   */
  async revokeSessions(storeId: string, userId: string, actor: User) {
    if (userId === actor.id) {
      throw new AppException(
        'Para encerrar as suas sessões, use Configurações > Sessões ativas.',
        409,
        'E_SELF_ACCESS'
      )
    }
    return await db.transaction(async (trx) => {
      await this.requireMembership(trx, storeId, userId)
      await this.assertNotSuperUser(trx, userId)
      if (!actor.superUser) {
        const elsewhere = await trx
          .from('store_user as theirs')
          .where('theirs.user_id', userId)
          .whereNull('theirs.disabled_at')
          .whereNot('theirs.store_id', storeId)
          .whereNotExists((query) =>
            query
              .from('store_user as mine')
              .whereColumn('mine.store_id', 'theirs.store_id')
              .where({ 'mine.user_id': actor.id, 'mine.role': StoreRole.MANAGER })
              .whereNull('mine.disabled_at')
          )
          .first()
        if (elsewhere) {
          throw new AppException(
            'Essa pessoa também trabalha em outra loja. Ela pode encerrar as sessões em Configurações > Sessões ativas.',
            409,
            'E_OTHER_STORES'
          )
        }
      }
      return await this.endSessions(trx, userId)
    })
  }

  private async endSessions(trx: TransactionClientContract, userId: string) {
    const ended = await trx.from('auth_access_tokens').where('tokenable_id', userId).delete()
    // Like signing out elsewhere: a trusted browser asks for the code again.
    await trx.from('trusted_devices').where('user_id', userId).delete()
    // Nobody is in the panel any more: "online" goes off right away.
    await trx.from('users').where('id', userId).update({ last_seen_at: null })
    forgetLastSeen(userId)
    return Number(ended) || 0
  }

  private async assertNotSuperUser(trx: TransactionClientContract, userId: string) {
    const user = await trx.from('users').where('id', userId).select('super_user').first()
    if (user?.super_user) {
      throw new AppException(
        'Administradores da plataforma não podem ser desativados por aqui.',
        409,
        'E_SUPER_USER'
      )
    }
  }

  private async membership(trx: TransactionClientContract, storeId: string, userId: string) {
    return (await trx
      .from('store_user')
      .where({ store_id: storeId, user_id: userId })
      .select('role', 'disabled_at')
      .forUpdate()
      .first()) as Membership | null
  }

  private async requireMembership(trx: TransactionClientContract, storeId: string, userId: string) {
    const row = await this.membership(trx, storeId, userId)
    if (!row) throw new AppException('Membro não encontrado nesta loja.', 404)
    return row
  }

  private async assertAnotherManager(
    trx: TransactionClientContract,
    storeId: string,
    userId: string
  ) {
    const others = await trx
      .from('store_user')
      .where({ store_id: storeId, role: StoreRole.MANAGER })
      .whereNull('disabled_at')
      .whereNot('user_id', userId)
      .forUpdate()
    if (others.length === 0) {
      throw new AppException(
        'A loja precisa de pelo menos um gerente com acesso. Promova outra pessoa antes.',
        409,
        'E_LAST_MANAGER'
      )
    }
  }
}
