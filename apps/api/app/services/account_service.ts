import { randomUUID } from 'node:crypto'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import hash from '@adonisjs/core/services/hash'
import limiter from '@adonisjs/limiter/services/main'
import drive from '@adonisjs/drive/services/main'
import db from '@adonisjs/lucid/services/db'
import { UAParser } from 'ua-parser-js'
import AppException from '#exceptions/app_exception'
import { deleteUpload } from '#helpers/uploads'
import type User from '#models/user'

const AVATAR_PREFIX = 'avatars'

type TokenRow = {
  id: number | string
  user_agent: string | null
  ip_address: string | null
  signed_in_at: Date | null
  created_at: Date
  last_used_at: Date | null
  expires_at: Date | null
}

/** "Chrome 141", "Windows 11", desktop/mobile/tablet from a user agent. */
function describeDevice(userAgent: string | null) {
  if (!userAgent) return { browser: null, os: null, device: 'desktop' as const }
  const parsed = new UAParser(userAgent).getResult()
  const major = parsed.browser.version?.split('.')[0]
  const type = parsed.device.type
  return {
    browser: parsed.browser.name ? [parsed.browser.name, major].filter(Boolean).join(' ') : null,
    os: parsed.os.name ? [parsed.os.name, parsed.os.version].filter(Boolean).join(' ') : null,
    device:
      type === 'mobile'
        ? ('mobile' as const)
        : type === 'tablet'
          ? ('tablet' as const)
          : ('desktop' as const),
  }
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
        'expires_at'
      )

    return rows
      .map((row) => ({
        id: Number(row.id),
        current: String(row.id) === String(currentId),
        ...describeDevice(row.user_agent),
        ipAddress: row.ip_address,
        signedInAt: new Date(row.signed_in_at ?? row.created_at).toISOString(),
        lastActiveAt: new Date(row.last_used_at ?? row.created_at).toISOString(),
        expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
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
    const deleted = await db
      .from('auth_access_tokens')
      .where({ id, tokenable_id: user.id })
      .delete()
    // Already gone (revoked in another tab, expired): nothing left to do.
    return Number(Array.isArray(deleted) ? deleted[0] : deleted) > 0
  }

  /** Every session but this one. */
  async revokeOtherSessions(user: User, currentId: string | number | undefined) {
    await db
      .from('auth_access_tokens')
      .where('tokenable_id', user.id)
      .if(currentId !== undefined, (query) => query.whereNot('id', String(currentId)))
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
    await file.moveToDisk(key)
    user.avatarUrl = await drive.use().getUrl(key)
    await user.save()
    await deleteUpload(previous, AVATAR_PREFIX)
    return user
  }

  /** Back to the generated avatar. Repeating it is harmless. */
  async removeAvatar(user: User) {
    const previous = user.avatarUrl
    if (previous) {
      user.avatarUrl = null
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
    const guard = limiter.use({ requests: 5, duration: '15 min', blockDuration: '15 min' })
    const key = `change_password_${user.id}`
    const [error] = await guard.penalize(key, async () => {
      if (!(await hash.verify(user.password, data.currentPassword))) {
        throw new AppException('A senha atual não confere.', 422, 'E_WRONG_PASSWORD')
      }
    })
    if (error) {
      throw new AppException('Muitas tentativas. Tente de novo em alguns minutos.', 429)
    }

    await db.transaction(async (trx) => {
      user.useTransaction(trx)
      user.password = data.password
      await user.save()
      await trx
        .from('auth_access_tokens')
        .where('tokenable_id', user.id)
        .if(currentId !== undefined, (query) => query.whereNot('id', String(currentId)))
        .delete()
    })
  }
}
