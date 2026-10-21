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
import StaffInviteNotification from '#mails/staff_invite_notification'
import PasswordResetService from '#services/password_reset_service'

export type StoreMember = {
  id: string
  name: string | null
  email: string
  role: StoreRole
  since: string
}

const ROLE_ORDER = [StoreRole.MANAGER, StoreRole.ATTENDANT, StoreRole.KITCHEN]

/**
 * The team of a store (store_user.role). Managers add people by e-mail:
 * existing accounts are linked, new ones get an invite to create their
 * password. A store always keeps at least one manager.
 */
@inject()
export default class StoreMemberService {
  constructor(private passwords: PasswordResetService) {}

  async list(storeId: string): Promise<StoreMember[]> {
    const rows = await db
      .from('store_user as su')
      .join('users as u', 'u.id', 'su.user_id')
      .where('su.store_id', storeId)
      .select('u.id', 'u.name', 'u.email', 'su.role', 'su.created_at')
    return rows
      .map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        since: DateTime.fromJSDate(row.created_at).toISO()!,
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
            name: input.name?.trim() || null,
            password: randomBytes(24).toString('base64url'),
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
      const url = await this.passwords.issueLink(user, { days: 7 }, { invite: true })
      await mail.sendLater(
        new StaffInviteNotification(
          { email: user.email, name: user.name },
          { storeName: store.name, role: input.role, invitedBy: actor.name },
          url
        )
      )
    }

    const members = await this.list(storeId)
    return { member: members.find((candidate) => candidate.id === user.id)!, invited }
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
