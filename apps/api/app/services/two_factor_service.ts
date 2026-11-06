import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import type { HttpContext } from '@adonisjs/core/http'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import mail from '@adonisjs/mail/services/main'
import { DateTime } from 'luxon'
import * as OTPAuth from 'otpauth'
import env from '#start/env'
import AppException from '#exceptions/app_exception'
import { assertOwnPassword } from '#helpers/own_password'
import limiter from '@adonisjs/limiter/services/main'
import SignInCodeNotification from '#mails/sign_in_code_notification'
import User from '#models/user'
import { markEmailVerified } from '#helpers/user_activity'
import { describeDevice } from '#services/account_service'

/** Cookie with the token of a sign-in waiting for its second step. */
const CHALLENGE_COOKIE = 'two_factor_challenge'
/** Cookie of a device trusted for TRUST_DAYS ("Confiar neste dispositivo"). */
const TRUST_COOKIE = 'trusted_device'
const CHALLENGE_MINUTES = 10
const TRUST_DAYS = 30
const MAX_ATTEMPTS = 5
const MAX_SENDS = 5
const RESEND_SECONDS = 60
const RECOVERY_CODES = 10
/** Per user, whatever the browser or IP: sign-ins that reach the second step… */
const STARTS_PER_15_MIN = () => env.get('TWO_FACTOR_START_LIMIT', 10)
/** …and wrong codes across all of their challenges. */
const FAILURES_PER_HOUR = () => env.get('TWO_FACTOR_FAILURE_LIMIT', 10)
const ISSUER = 'React Menu'

export type TwoFactorMethod = 'email' | 'totp'

/** What the login page needs for the second step. */
export type TwoFactorChallenge = {
  method: TwoFactorMethod
  /** "a•••@gmail.com" (e-mail codes only). */
  emailHint: string | null
  expiresAt: string
  /** When "Reenviar" works again (e-mail codes only). */
  resendAt: string | null
}

type ChallengeRow = {
  id: string
  user_id: string
  method: TwoFactorMethod
  code_hash: string | null
  attempts: number
  sends: number
  last_sent_at: Date | null
  expires_at: Date
  consumed_at: Date | null
}

type Ctx = Pick<HttpContext, 'request' | 'response'>

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')
/** E-mail codes have 10⁶ values: an HMAC keyed by APP_KEY keeps a leaked row useless. */
const codeHash = (challengeId: string, code: string) =>
  createHmac('sha256', env.get('APP_KEY')).update(`${challengeId}:${code}`).digest('hex')
const sameHash = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))
/** "XXXX-XXXX", without look-alike characters (0/O, 1/I/L). */
const RECOVERY_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const normalizeRecovery = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '')

export function maskEmail(email: string) {
  const [local, domain] = email.split('@')
  return `${local.slice(0, 1)}•••@${domain}`
}

/** "Chrome 141 em Windows 10" for the e-mail: where the sign-in came from. */
function deviceName(userAgent: string | undefined) {
  const { browser, os } = describeDevice(userAgent ?? null)
  return [browser, os].filter(Boolean).join(' em ') || null
}

/**
 * E-mail codes of the e2e run, readable by the e2e hook route only when
 * E2E_TEST_HOOKS is on (never in production: the app refuses to boot).
 */
export const e2eCodes = new Map<string, string>()

/**
 * Two-factor sign-in. After the first factor (password or Google) the API
 * opens a challenge: a TOTP code when the user set up an authenticator app,
 * otherwise a 6-digit code by e-mail. A trusted device skips it.
 */
export default class TwoFactorService {
  private totp(secret: string, label: string) {
    return new OTPAuth.TOTP({
      issuer: ISSUER,
      label,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    })
  }

  // ---- Sign-in -------------------------------------------------------------

  /**
   * After the first factor. Returns null when this device is trusted (the
   * caller signs in right away, linked to `trustedDeviceId`), otherwise opens
   * the challenge and sets its cookie.
   */
  async start(
    user: User,
    ctx: Ctx
  ): Promise<{ trustedDeviceId: string } | { challenge: TwoFactorChallenge }> {
    const trusted = await this.trustedDevice(user, ctx)
    if (trusted) return { trustedDeviceId: trusted }

    // A right password opens a challenge (and e-mails a code): without this,
    // whoever has the password could loop it for fresh attempts and flood
    // the inbox.
    try {
      await limiter
        .use({ requests: STARTS_PER_15_MIN(), duration: '15 min' })
        .consume(`two_factor_start_${user.id}`)
    } catch {
      throw new AppException(
        'Muitas tentativas de login. Tente de novo em alguns minutos.',
        429,
        'E_TWO_FACTOR_TOO_MANY'
      )
    }

    const token = randomBytes(32).toString('base64url')
    const method: TwoFactorMethod = user.twoFactorEnabled ? 'totp' : 'email'
    const expiresAt = DateTime.now().plus({ minutes: CHALLENGE_MINUTES })
    const [row] = await db
      .table('login_challenges')
      .insert({
        user_id: user.id,
        token_hash: sha256(token),
        method,
        expires_at: expiresAt.toJSDate(),
        created_at: new Date(),
      })
      .returning(['id'])

    ctx.response.cookie(CHALLENGE_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: app.inProduction,
      maxAge: CHALLENGE_MINUTES * 60,
    })
    if (method === 'email') await this.mailCode(user, await this.issueCode(row.id), ctx)
    return { challenge: await this.describe(row.id) }
  }

  /** The pending challenge of this browser (the login page after Google). */
  async current(ctx: Ctx) {
    const row = await this.findChallenge(ctx)
    return this.describe(row.id)
  }

  /**
   * Checks the code of the pending challenge: the e-mail code, the TOTP
   * code, or a recovery code ("recovery"). Returns the user to sign in and,
   * with `remember`, a new trusted device for this browser.
   */
  async verify(ctx: Ctx, input: { code: string; recovery?: boolean; remember?: boolean }) {
    const failures = limiter.use({
      requests: FAILURES_PER_HOUR(),
      duration: '1 hour',
      blockDuration: '1 hour',
    })
    const result = await db.transaction(async (trx) => {
      const row = await this.findChallenge(ctx, trx)
      const failuresKey = `two_factor_fail_${row.user_id}`
      if (
        (await failures.isBlocked(failuresKey)) ||
        (await failures.remaining(failuresKey)) === 0
      ) {
        throw new AppException(
          'Muitos códigos errados nesta conta. Tente de novo mais tarde.',
          429,
          'E_TWO_FACTOR_LOCKED'
        )
      }
      if (row.attempts >= MAX_ATTEMPTS) {
        throw new AppException(
          'Muitas tentativas com este código. Entre de novo para receber outro.',
          429,
          'E_TWO_FACTOR_LOCKED'
        )
      }
      const found = await User.findOrFail(row.user_id, { client: trx })
      const ok = input.recovery
        ? await this.useRecoveryCode(found, input.code, trx)
        : row.method === 'totp'
          ? await this.checkTotp(found, input.code, trx)
          : Boolean(row.code_hash) &&
            sameHash(row.code_hash!, codeHash(row.id, input.code.replace(/\D/g, '')))

      if (!ok) {
        // Counted in the committed transaction; the error comes after it.
        await trx.from('login_challenges').where('id', row.id).increment('attempts', 1)
        await failures.consume(failuresKey).catch(() => undefined)
        return { ok: false as const, left: MAX_ATTEMPTS - row.attempts - 1 }
      }

      await trx.from('login_challenges').where('id', row.id).update({ consumed_at: new Date() })
      // A code read from the inbox proves the address.
      if (row.method === 'email' && !input.recovery) await markEmailVerified(found.id, trx)
      const trust = input.remember ? await this.trust(found, ctx, trx) : null
      return { ok: true as const, user: found, trustedDeviceId: trust }
    })
    if (!result.ok) {
      throw new AppException(
        result.left > 0
          ? `Código inválido. Você tem mais ${result.left} ${result.left === 1 ? 'tentativa' : 'tentativas'}.`
          : 'Código inválido. Entre de novo para receber outro.',
        422,
        'E_TWO_FACTOR_INVALID',
        { attemptsLeft: result.left }
      )
    }
    ctx.response.clearCookie(CHALLENGE_COOKIE)
    return { user: result.user, trustedDeviceId: result.trustedDeviceId }
  }

  /**
   * A new e-mail code for the pending challenge (once a minute, a few times).
   * The row is locked, so parallel requests can't all pass the limits, and a
   * challenge locked by wrong codes stays locked (attempts are not reset).
   */
  async resend(ctx: Ctx) {
    const { user, challengeId, code } = await db.transaction(async (trx) => {
      const row = await this.findChallenge(ctx, trx)
      if (row.method !== 'email') {
        throw new AppException('Use o código do seu app autenticador.', 422)
      }
      if (row.attempts >= MAX_ATTEMPTS) {
        throw new AppException(
          'Muitas tentativas com este código. Entre de novo para receber outro.',
          429,
          'E_TWO_FACTOR_LOCKED'
        )
      }
      if (row.sends >= MAX_SENDS) {
        throw new AppException('Limite de reenvios. Entre de novo para receber outro código.', 429)
      }
      if (
        row.last_sent_at &&
        DateTime.fromJSDate(row.last_sent_at).plus({ seconds: RESEND_SECONDS }) > DateTime.now()
      ) {
        throw new AppException('Aguarde um pouco para pedir outro código.', 429)
      }
      return {
        user: await User.findOrFail(row.user_id, { client: trx }),
        challengeId: row.id,
        code: await this.issueCode(row.id, trx),
      }
    })
    await this.mailCode(user, code, ctx)
    return this.describe(challengeId)
  }

  /** A new code for the challenge (the previous one stops working). */
  private async issueCode(challengeId: string, trx?: TransactionClientContract) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
    await (trx ?? db)
      .from('login_challenges')
      .where('id', challengeId)
      .update({
        code_hash: codeHash(challengeId, code),
        last_sent_at: new Date(),
        sends: db.raw('sends + 1'),
      })
    return code
  }

  private async mailCode(user: User, code: string, ctx: Ctx) {
    if (env.get('E2E_TEST_HOOKS')) e2eCodes.set(user.email.toLowerCase(), code)
    await mail.sendLater(
      new SignInCodeNotification({ email: user.email, name: user.name }, code, {
        minutes: CHALLENGE_MINUTES,
        device: deviceName(ctx.request.header('user-agent')),
        ip: ctx.request.ip(),
      })
    )
  }

  private async findChallenge(ctx: Ctx, trx?: TransactionClientContract) {
    const token = ctx.request.cookie(CHALLENGE_COOKIE)
    const row: ChallengeRow | null = token
      ? await (trx ?? db)
          .from('login_challenges')
          .where('token_hash', sha256(token))
          .whereNull('consumed_at')
          .where('expires_at', '>', new Date())
          .if(Boolean(trx), (query) => query.forUpdate())
          .first()
      : null
    if (!row) {
      throw new AppException(
        'Este acesso expirou. Entre de novo com seu e-mail e senha.',
        410,
        'E_TWO_FACTOR_EXPIRED'
      )
    }
    return row
  }

  private async describe(challengeId: string): Promise<TwoFactorChallenge> {
    const row = await db.from('login_challenges').where('id', challengeId).firstOrFail()
    const user = await User.findOrFail(row.user_id)
    return {
      method: row.method,
      emailHint: row.method === 'email' ? maskEmail(user.email) : null,
      expiresAt: new Date(row.expires_at).toISOString(),
      resendAt:
        row.method === 'email' && row.last_sent_at
          ? new Date(new Date(row.last_sent_at).getTime() + RESEND_SECONDS * 1000).toISOString()
          : null,
    }
  }

  // ---- Trusted devices -----------------------------------------------------

  /** The trusted device of this browser for this user, if any (renews nothing). */
  private async trustedDevice(user: User, ctx: Ctx) {
    const token = ctx.request.cookie(TRUST_COOKIE)
    if (!token) return null
    const row = await db
      .from('trusted_devices')
      .where({ token_hash: sha256(token), user_id: user.id })
      .where('expires_at', '>', new Date())
      .first()
    return (row?.id as string | undefined) ?? null
  }

  private async trust(user: User, ctx: Ctx, trx: TransactionClientContract) {
    const token = randomBytes(32).toString('base64url')
    const [row] = await trx
      .table('trusted_devices')
      .insert({
        user_id: user.id,
        token_hash: sha256(token),
        user_agent: ctx.request.header('user-agent')?.slice(0, 512) ?? null,
        expires_at: DateTime.now().plus({ days: TRUST_DAYS }).toJSDate(),
        created_at: new Date(),
      })
      .returning(['id'])
    ctx.response.cookie(TRUST_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: app.inProduction,
      maxAge: `${TRUST_DAYS} days`,
    })
    return row.id as string
  }

  /** Ends the trust of every device of the user, but `keep` (e.g. the current one). */
  async forgetDevices(
    user: User,
    options: { keep?: string | null } = {},
    trx?: TransactionClientContract
  ) {
    await (trx ?? db)
      .from('trusted_devices')
      .where('user_id', user.id)
      .if(Boolean(options.keep), (query) => query.whereNot('id', options.keep!))
      .delete()
  }

  // ---- Authenticator app (TOTP) ------------------------------------------

  /** A new secret to scan; it only takes effect once `enable` gets a code from it. */
  async setup(user: User, password: string) {
    // A session left open must not be enough to tie the account to someone
    // else's phone (and lock the owner out).
    await assertOwnPassword(user, password)
    if (user.twoFactorEnabled) {
      throw new AppException('O app autenticador já está configurado.', 409)
    }
    const secret = new OTPAuth.Secret({ size: 20 }).base32
    user.twoFactorPendingSecret = secret
    await user.save()
    return { secret, uri: this.totp(secret, user.email).toString() }
  }

  /** Turns TOTP on with the first code; returns the recovery codes (shown once). */
  async enable(user: User, code: string) {
    const secret = user.twoFactorPendingSecret
    if (!secret) throw new AppException('Comece a configuração de novo.', 409)
    const step = this.matchStep(secret, user.email, code)
    if (step === null) {
      throw new AppException(
        'Código inválido. Confira o horário do celular e tente de novo.',
        422,
        'E_TWO_FACTOR_INVALID'
      )
    }
    return await db.transaction(async (trx) => {
      user.useTransaction(trx)
      user.merge({
        twoFactorSecret: secret,
        twoFactorPendingSecret: null,
        twoFactorEnabledAt: DateTime.now(),
        twoFactorLastStep: step,
      })
      await user.save()
      return await this.newRecoveryCodes(user, trx)
    })
  }

  /** Back to e-mail codes. Needs the password; trusted devices are forgotten. */
  async disable(user: User, password: string) {
    await assertOwnPassword(user, password)
    await db.transaction(async (trx) => {
      user.useTransaction(trx)
      user.merge({
        twoFactorSecret: null,
        twoFactorPendingSecret: null,
        twoFactorEnabledAt: null,
        twoFactorLastStep: null,
      })
      await user.save()
      await trx.from('user_recovery_codes').where('user_id', user.id).delete()
      await this.forgetDevices(user, {}, trx)
    })
  }

  /** New recovery codes (the old ones stop working); needs a current TOTP code. */
  async regenerateRecoveryCodes(user: User, code: string) {
    if (!user.twoFactorEnabled) throw new AppException('O app autenticador não está ativo.', 409)
    return await db.transaction(async (trx) => {
      if (!(await this.checkTotp(user, code, trx))) {
        throw new AppException('Código inválido.', 422, 'E_TWO_FACTOR_INVALID')
      }
      return await this.newRecoveryCodes(user, trx)
    })
  }

  async recoveryCodesLeft(user: User) {
    const row = await db
      .from('user_recovery_codes')
      .where('user_id', user.id)
      .whereNull('used_at')
      .count('* as total')
      .first()
    return Number(row?.total ?? 0)
  }

  private async newRecoveryCodes(user: User, trx: TransactionClientContract) {
    const codes = Array.from({ length: RECOVERY_CODES }, () => {
      const chars = Array.from(
        { length: 8 },
        () => RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)]
      )
      return `${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`
    })
    await trx.from('user_recovery_codes').where('user_id', user.id).delete()
    await trx.table('user_recovery_codes').multiInsert(
      codes.map((code) => ({
        user_id: user.id,
        code_hash: sha256(normalizeRecovery(code)),
        created_at: new Date(),
      }))
    )
    return codes
  }

  /** The time step the code belongs to (±1 step of clock drift), or null. */
  private matchStep(secret: string, label: string, code: string) {
    const totp = this.totp(secret, label)
    const delta = totp.validate({ token: code.replace(/\D/g, ''), window: 1 })
    if (delta === null) return null
    return Math.floor(Date.now() / 1000 / 30) + delta
  }

  /** A TOTP code of the user's app, used once (a replayed code fails). */
  private async checkTotp(user: User, code: string, trx: TransactionClientContract) {
    if (!user.twoFactorSecret) return false
    const step = this.matchStep(user.twoFactorSecret, user.email, code)
    if (step === null) return false
    // Atomic: two sign-ins racing with the same code can't both win.
    const updated = await trx
      .from('users')
      .where('id', user.id)
      .where((query) =>
        query.whereNull('two_factor_last_step').orWhere('two_factor_last_step', '<', step)
      )
      .update({ two_factor_last_step: step })
    if (Number(Array.isArray(updated) ? updated[0] : updated) === 0) return false
    user.twoFactorLastStep = step
    return true
  }

  private async useRecoveryCode(user: User, code: string, trx: TransactionClientContract) {
    if (!user.twoFactorEnabled) return false
    const updated = await trx
      .from('user_recovery_codes')
      .where({ user_id: user.id, code_hash: sha256(normalizeRecovery(code)) })
      .whereNull('used_at')
      .update({ used_at: new Date() })
    return Number(Array.isArray(updated) ? updated[0] : updated) > 0
  }
}
