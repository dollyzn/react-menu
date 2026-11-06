import type { ApiClient } from '@japa/api-client'
import mail from '@adonisjs/mail/services/main'
import env from '#start/env'
import SignInCodeNotification from '#mails/sign_in_code_notification'

export const SESSION_COOKIE = env.get('AUTH_COOKIE_NAME')
export const CHALLENGE_COOKIE = 'two_factor_challenge'
export const TRUST_COOKIE = 'trusted_device'

/**
 * Signs in through both steps (password, then the e-mail code read from the
 * fake mailer) and returns the cookies the browser would keep: the session
 * and, with `remember`, the trusted device.
 */
export async function signIn(
  client: ApiClient,
  credentials: { email: string; password: string },
  options: { userAgent?: string; remember?: boolean; trust?: string } = {}
) {
  const mails = mail.fake()
  let login = client.post('/api/v1/auth/login').json(credentials)
  if (options.userAgent) login = login.header('user-agent', options.userAgent)
  if (options.trust) login = login.withCookie(TRUST_COOKIE, options.trust)
  const first = await login
  first.assertStatus(200)

  // A trusted device skips the second step.
  if (first.body().data.user) {
    mail.restore()
    return { session: first.cookie(SESSION_COOKIE)!.value, trust: options.trust, response: first }
  }

  const [message] = mails.mails.queued((queued) => queued instanceof SignInCodeNotification)
  mail.restore()
  const code = (message as SignInCodeNotification).code
  let second = client
    .post('/api/v1/auth/two-factor')
    .withCookie(CHALLENGE_COOKIE, first.cookie(CHALLENGE_COOKIE)!.value)
    .json({ code, remember: options.remember ?? false })
  if (options.userAgent) second = second.header('user-agent', options.userAgent)
  const response = await second
  response.assertStatus(200)
  return {
    session: response.cookie(SESSION_COOKIE)!.value,
    trust: response.cookie(TRUST_COOKIE)?.value ?? options.trust,
    response,
  }
}
