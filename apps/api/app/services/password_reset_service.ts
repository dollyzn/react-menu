import { createHash, randomBytes } from 'node:crypto'
import db from '@adonisjs/lucid/services/db'
import limiter from '@adonisjs/limiter/services/main'
import mail from '@adonisjs/mail/services/main'
import { DateTime } from 'luxon'
import env from '#start/env'
import AppException from '#exceptions/app_exception'
import PasswordResetToken from '#models/password_reset_token'
import User from '#models/user'
import ResetPasswordNotification from '#mails/reset_password_notification'

const TOKEN_TTL = { hours: 1 }
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

/**
 * "Esqueci minha senha": a single-use link by e-mail (1 hour). The answer
 * never reveals whether the e-mail has an account.
 */
export default class PasswordResetService {
  async request(email: string, ip: string) {
    const normalized = email.trim().toLowerCase()
    const throttle = limiter.use({ requests: 5, duration: '15 min', blockDuration: '15 min' })
    // Per network and per address: no flooding someone's inbox.
    for (const key of [`reset_ip_${ip}`, `reset_email_${normalized}`]) {
      if (!(await throttle.attempt(key, () => true))) {
        throw new AppException(
          'Muitos pedidos de redefinição. Tente de novo em alguns minutos.',
          429
        )
      }
    }

    const user = await User.query().whereILike('email', normalized).first()
    if (!user) return

    const token = randomBytes(32).toString('base64url')
    await db.transaction(async (trx) => {
      // Only the latest link works.
      await PasswordResetToken.query({ client: trx }).where('userId', user.id).delete()
      await PasswordResetToken.create(
        { userId: user.id, tokenHash: hashToken(token), expiresAt: DateTime.now().plus(TOKEN_TTL) },
        { client: trx }
      )
    })

    const url = `${env.get('FRONTEND_URL')}/app/redefinir-senha?token=${encodeURIComponent(token)}`
    await mail.sendLater(new ResetPasswordNotification({ email: user.email, name: user.name }, url))
  }

  /** Sets the new password and ends every session of the user. */
  async reset(token: string, password: string) {
    await db.transaction(async (trx) => {
      const record = await PasswordResetToken.query({ client: trx })
        .where('tokenHash', hashToken(token))
        .whereNull('usedAt')
        .where('expiresAt', '>', DateTime.now().toSQL()!)
        .forUpdate()
        .first()
      if (!record) {
        throw new AppException(
          'Este link expirou ou já foi usado. Peça um novo em "Esqueci minha senha".',
          422,
          'E_RESET_TOKEN_INVALID'
        )
      }

      const user = await User.findOrFail(record.userId, { client: trx })
      user.password = password
      await user.save()

      record.usedAt = DateTime.now()
      await record.save()
      await trx.from('auth_access_tokens').where('tokenable_id', user.id).delete()
    })
  }
}
