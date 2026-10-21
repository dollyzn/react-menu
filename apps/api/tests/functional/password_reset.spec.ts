import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import mail from '@adonisjs/mail/services/main'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import PasswordResetToken from '#models/password_reset_token'
import ResetPasswordNotification from '#mails/reset_password_notification'
import { createUser } from '#tests/helpers/fixtures'

/** Token from the link in the last queued reset e-mail. */
function tokenFromMail(fake: ReturnType<typeof mail.fake>) {
  const [message] = fake.mails.queued((queued) => queued instanceof ResetPasswordNotification)
  const url = (message as unknown as { resetUrl: string }).resetUrl
  return new URL(url).searchParams.get('token')!
}

test.group('Password reset', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())
  group.each.setup(() => {
    mail.fake()
    return () => mail.restore()
  })

  test('answers the same for unknown e-mails and only mails real accounts', async ({ client }) => {
    const fake = mail.fake()
    const user = await createUser()

    const known = await client.post('/api/v1/auth/forgot-password').json({ email: user.email })
    const unknown = await client
      .post('/api/v1/auth/forgot-password')
      .json({ email: 'nobody@example.com' })

    known.assertStatus(200)
    unknown.assertStatus(200)
    unknown.assertBodyContains({ message: known.body().message })
    fake.mails.assertQueuedCount(ResetPasswordNotification, 1)
    fake.mails.assertQueued(ResetPasswordNotification, (sent) => {
      sent.build()
      return sent.message.hasTo(user.email)
    })
  })

  test('the link sets a new password once and ends every session', async ({ client, assert }) => {
    const fake = mail.fake()
    const user = await createUser({ password: 'old-password' })
    const session = await client
      .post('/api/v1/auth/login')
      .json({ email: user.email, password: 'old-password' })
    session.assertStatus(200)

    await client.post('/api/v1/auth/forgot-password').json({ email: user.email })
    const token = tokenFromMail(fake)

    const reset = await client
      .post('/api/v1/auth/reset-password')
      .json({ token, password: 'new-password-123' })
    const sessionsLeft = await db.from('auth_access_tokens').where('tokenable_id', user.id)
    const reused = await client
      .post('/api/v1/auth/reset-password')
      .json({ token, password: 'another-password' })
    const oldLogin = await client
      .post('/api/v1/auth/login')
      .json({ email: user.email, password: 'old-password' })
    const newLogin = await client
      .post('/api/v1/auth/login')
      .json({ email: user.email, password: 'new-password-123' })

    reset.assertStatus(200)
    assert.lengthOf(sessionsLeft, 0)
    reused.assertStatus(422)
    oldLogin.assertStatus(400)
    newLogin.assertStatus(200)
    const tokens = await PasswordResetToken.query().where('userId', user.id)
    assert.isNotNull(tokens[0].usedAt)
  })

  test('expired links are refused and only the latest link works', async ({ client }) => {
    const fake = mail.fake()
    const user = await createUser()

    await client.post('/api/v1/auth/forgot-password').json({ email: user.email })
    const first = tokenFromMail(fake)
    fake.mails.clear()
    await client.post('/api/v1/auth/forgot-password').json({ email: user.email })
    const second = tokenFromMail(fake)

    const old = await client
      .post('/api/v1/auth/reset-password')
      .json({ token: first, password: 'new-password-123' })
    await PasswordResetToken.query()
      .where('userId', user.id)
      .update({ expiresAt: DateTime.now().minus({ minutes: 1 }).toSQL() })
    const expired = await client
      .post('/api/v1/auth/reset-password')
      .json({ token: second, password: 'new-password-123' })

    old.assertStatus(422)
    expired.assertStatus(422)
    expired.assertBodyContains({ code: 'E_RESET_TOKEN_INVALID' })
  })
})
