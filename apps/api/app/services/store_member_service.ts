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
import PasswordResetService from '#services/password_reset_service'

export type StoreMember = {
  id: string
  name: string | null
  email: string
  role: StoreRole
  since: string
  invitePending: boolean
}

const ROLE_ORDER = [StoreRole.MANAGER, StoreRole.ATTENDANT, StoreRole.KITCHEN]
const INVITE_TTL = { days: 7 }

/**
 * The team of a store (store_user.role). Managers add people by e-mail:
 * existing accounts are linked, new ones get an invite to create their
 * password (and can get it again while they haven't used it). A store
 * always keeps at least one manager.
 */
@inject()
export default class StoreMemberService {
  constructor(
    private passwords: PasswordResetService,
    private notifications: NotificationService
  ) {}

  async list(storeId: string): Promise<StoreMember[]> {
    const rows = await db
      .from('store_user as su')
      .join('users as u', 'u.id', 'su.user_id')
      .where('su.store_id', storeId)
      .select('u.id', 'u.name', 'u.email', 'u.invite_pending', 'su.role', 'su.created_at')
    return rows
      .map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        since: DateTime.fromJSDate(row.created_at).toISO()!,
        invitePending: row.invite_pending,
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
      if (await this.membership(trx, storeId, existing.id)) {
        throw new AppException('Essa pessoa já faz parte da equipe.', 409, 'E_ALREADY_MEMBER')
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
        { userIds: [user.id] }
      )
      await mail.sendLater(
        new StoreAccessNotification(
          { email: user.email, name: user.name },
          { store: storeBrand(store), role: input.role, addedBy: actor.name },
          `${env.get('FRONTEND_URL')}/app/stores/${storeId}`
        )
      )
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
      if (current.role === StoreRole.MANAGER) await this.assertAnotherManager(trx, storeId, userId)
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
      if (current.role === StoreRole.MANAGER) await this.assertAnotherManager(trx, storeId, userId)
      await trx.from('store_user').where({ store_id: storeId, user_id: userId }).delete()
    })
  }

  private async membership(trx: TransactionClientContract, storeId: string, userId: string) {
    return (await trx
      .from('store_user')
      .where({ store_id: storeId, user_id: userId })
      .forUpdate()
      .first()) as { role: StoreRole } | null
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
      .whereNot('user_id', userId)
      .forUpdate()
    if (others.length === 0) {
      throw new AppException(
        'A loja precisa de pelo menos um gerente. Promova outra pessoa antes.',
        409,
        'E_LAST_MANAGER'
      )
    }
  }
}
