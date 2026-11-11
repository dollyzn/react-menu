import { randomUUID } from 'node:crypto'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import drive from '@adonisjs/drive/services/main'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Bowser from 'bowser'
import AppException from '#exceptions/app_exception'
import { deleteUpload } from '#helpers/uploads'
import { assertOwnPassword } from '#helpers/own_password'
import type User from '#models/user'
import { uploadPlaceholder } from '#helpers/image_placeholder'

const AVATAR_PREFIX = 'avatars'

type TokenRow = {
  id: number | string
  user_agent: string | null
  ip_address: string | null
  signed_in_at: Date | null
  created_at: Date
  last_used_at: Date | null
  expires_at: Date | null
  trusted_device_id: string | null
}

/** "Chrome 141", "Windows 10", "iOS 18.1", desktop/mobile/tablet from a user agent. */
export function describeDevice(userAgent: string | null) {
  if (!userAgent) return { browser: null, os: null, device: 'desktop' as const }
  const { browser, os, platform } = Bowser.parse(userAgent)
  const major = browser.version?.split('.')[0]
  return {
    browser: browser.name ? [browser.name, major].filter(Boolean).join(' ') : null,
    os: os.name ? [os.name, osVersion(os)].filter(Boolean).join(' ') : null,
    device:
      platform.type === 'mobile'
        ? ('mobile' as const)
        : platform.type === 'tablet'
          ? ('tablet' as const)
          : ('desktop' as const),
  }
}

/**
 * Windows reads best by its marketing name ("10", not "NT 10.0"); browsers
 * freeze macOS at 10.15.7 in the user agent, so its version says nothing.
 */
function osVersion(os: Bowser.Parser.OSDetails) {
  if (os.name === 'Windows') return os.versionName ?? null
  if (os.name === 'macOS') return null
  return os.version ?? null
}

/** The signed-in user's own account: sessions, profile, photo and password. */
export default class AccountService {
  /** Sessions that are still valid, the current one first, then by last activity. */
  async sessions(user: User, currentId: string | number | undefined) {
    const rows: TokenRow[] = await db
      .from('auth_access_tokens')
      .where('tokenable_id', user.id)
      .where((query) => query.whereNull('expires_at').orWhere('expires_at', '>', new Date()))
      .select(
        'id',
        'user_agent',
        'ip_address',
        'signed_in_at',
        'created_at',
        'last_used_at',
        'expires_at',
        'trusted_device_id'
      )

    // Trust lasts 30 days; a session renewed past that is no longer trusted.
    const devices: { id: string }[] = await db
      .from('trusted_devices')
      .where('user_id', user.id)
      .where('expires_at', '>', new Date())
      .select('id')
    const trusted = new Set(devices.map((device) => device.id))

    return rows
      .map((row) => ({
        id: Number(row.id),
        current: String(row.id) === String(currentId),
        ...describeDevice(row.user_agent),
        ipAddress: row.ip_address,
        signedInAt: new Date(row.signed_in_at ?? row.created_at).toISOString(),
        lastActiveAt: new Date(row.last_used_at ?? row.created_at).toISOString(),
        expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
        /** Signed in with "Confiar neste dispositivo", still within its 30 days. */
        trusted: Boolean(row.trusted_device_id && trusted.has(row.trusted_device_id)),
      }))
      .sort((a, b) =>
        a.current !== b.current
          ? a.current
            ? -1
            : 1
          : b.lastActiveAt.localeCompare(a.lastActiveAt)
      )
  }

  /** Ends another session of this user. The current one ends with "Sair". */
  async revokeSession(user: User, id: number, currentId: string | number | undefined) {
    if (String(id) === String(currentId)) {
      throw new AppException('Para encerrar esta sessão, use "Sair".', 422, 'E_CURRENT_SESSION')
    }
    return await db.transaction(async (trx) => {
      const row = await trx
        .from('auth_access_tokens')
        .where({ id, tokenable_id: user.id })
        .select('trusted_device_id')
        .first()
      // Already gone (revoked in another tab, expired): nothing left to do.
      if (!row) return false
      await trx.from('auth_access_tokens').where('id', id).delete()
      // That device asks for the second step again.
      if (row.trusted_device_id) {
        await trx.from('trusted_devices').where('id', row.trusted_device_id).delete()
      }
      return true
    })
  }

  /** Every session but this one. */
  async revokeOtherSessions(user: User, currentId: string | number | undefined) {
    await db.transaction(async (trx) => {
      await trx
        .from('auth_access_tokens')
        .where('tokenable_id', user.id)
        .if(currentId !== undefined, (query) => query.whereNot('id', String(currentId)))
        .delete()
      await this.forgetOtherDevices(user, currentId, trx)
    })
  }

  /** Trusted devices but the current session's: they ask for the second step again. */
  private async forgetOtherDevices(
    user: User,
    currentId: string | number | undefined,
    trx: TransactionClientContract
  ) {
    const current =
      currentId === undefined
        ? null
        : await trx
            .from('auth_access_tokens')
            .where('id', String(currentId))
            .select('trusted_device_id')
            .first()
    await trx
      .from('trusted_devices')
      .where('user_id', user.id)
      .if(Boolean(current?.trusted_device_id), (query) =>
        query.whereNot('id', current!.trusted_device_id)
      )
      .delete()
  }

  async updateProfile(user: User, data: { name: string }) {
    user.name = data.name
    await user.save()
    return user
  }

  async setAvatar(user: User, file: MultipartFile) {
    const previous = user.avatarUrl
    const key = `${AVATAR_PREFIX}/${user.id}_${randomUUID()}.${file.extname}`
    const blur = await uploadPlaceholder(file)
    await file.moveToDisk(key)
    user.avatarUrl = await drive.use().getUrl(key)
    user.avatarBlur = blur
    await user.save()
    await deleteUpload(previous, AVATAR_PREFIX)
    return user
  }

  /** Back to the generated avatar. Repeating it is harmless. */
  async removeAvatar(user: User) {
    const previous = user.avatarUrl
    if (previous) {
      user.avatarUrl = null
      user.avatarBlur = null
      await user.save()
      await deleteUpload(previous, AVATAR_PREFIX)
    }
    return user
  }

  /**
   * Needs the current password (a session left open is not enough to take
   * the account). Wrong guesses are limited like the login; on success
   * every other session ends.
   */
  async changePassword(
    user: User,
    data: { currentPassword: string; password: string },
    currentId: string | number | undefined
  ) {
    await assertOwnPassword(user, data.currentPassword, 'A senha atual não confere.')

    await db.transaction(async (trx) => {
      user.useTransaction(trx)
      user.password = data.password
      await user.save()
      await trx
        .from('auth_access_tokens')
        .where('tokenable_id', user.id)
        .if(currentId !== undefined, (query) => query.whereNot('id', String(currentId)))
        .delete()
      await this.forgetOtherDevices(user, currentId, trx)
    })
  }
}
