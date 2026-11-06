import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import mail from '@adonisjs/mail/services/main'
import { DateTime } from 'luxon'
import * as OTPAuth from 'otpauth'
import SignInCodeNotification from '#mails/sign_in_code_notification'
import { createUser } from '#tests/helpers/fixtures'
import { CHALLENGE_COOKIE, SESSION_COOKIE, TRUST_COOKIE, signIn } from '#tests/helpers/sign_in'

const PASSWORD = 'secret123'

/** The code of the authenticator app for `secret`, `offset` periods away. */
const totpCode = (secret: string, offset = 0) =>
  new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret) }).generate({
    timestamp: Date.now() + offset * 30_000,
  })

test.group('Two-factor sign-in', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.setup(() => () => mail.restore())

  test('the password alone opens a challenge; the e-mail code finishes it once', async ({
    client,
    assert,
  }) => {
    const user = await createUser({ password: PASSWORD, email: 'ana.souza@example.com' })
    const mails = mail.fake()

    const first = await client
      .post('/api/v1/auth/login')
      .json({ email: user.email, password: PASSWORD })
    first.assertStatus(200)
    first.assertBodyContains({
      data: { twoFactor: { method: 'email', emailHint: 'a•••@example.com' } },
    })
    assert.notProperty(first.body().data, 'user')
    assert.isUndefined(first.cookie(SESSION_COOKIE), 'no session before the second step')
    const challenge = first.cookie(CHALLENGE_COOKIE)!.value
    const [message] = mails.mails.queued((queued) => queued instanceof SignInCodeNotification)
    const { code } = message as SignInCodeNotification
    assert.match(code, /^\d{6}$/)

    const verify = (body: object) =>
      client.post('/api/v1/auth/two-factor').withCookie(CHALLENGE_COOKIE, challenge).json(body)
    const wrong = await verify({ code: code === '000000' ? '111111' : '000000' })
    wrong.assertStatus(422)
    wrong.assertBodyContains({ code: 'E_TWO_FACTOR_INVALID', details: { attemptsLeft: 4 } })

    const right = await verify({ code: `${code.slice(0, 3)} ${code.slice(3)}` })
    right.assertStatus(200)
    assert.exists(right.cookie(SESSION_COOKIE)?.value)
    assert.isUndefined(right.cookie(TRUST_COOKIE), 'not trusted unless asked')

    const again = await verify({ code })
    again.assertStatus(410)
    again.assertBodyContains({ code: 'E_TWO_FACTOR_EXPIRED' })
  })

  test('five wrong codes lock the challenge; an expired one is gone', async ({ client }) => {
    const user = await createUser({ password: PASSWORD })
    const mails = mail.fake()
    const first = await client
      .post('/api/v1/auth/login')
      .json({ email: user.email, password: PASSWORD })
    const challenge = first.cookie(CHALLENGE_COOKIE)!.value
    const { code } = mails.mails.queued()[0] as SignInCodeNotification
    const verify = (value: string) =>
      client
        .post('/api/v1/auth/two-factor')
        .withCookie(CHALLENGE_COOKIE, challenge)
        .json({ code: value })

    for (let attempt = 0; attempt < 5; attempt++) {
      const wrong = await verify(code === '999999' ? '888888' : '999999')
      wrong.assertStatus(422)
    }
    const locked = await verify(code)
    locked.assertStatus(429)
    locked.assertBodyContains({ code: 'E_TWO_FACTOR_LOCKED' })

    const second = await client
      .post('/api/v1/auth/login')
      .json({ email: user.email, password: PASSWORD })
    await db
      .from('login_challenges')
      .where('user_id', user.id)
      .whereNull('consumed_at')
      .update({ expires_at: DateTime.now().minus({ minutes: 1 }).toJSDate() })
    const expired = await client
      .post('/api/v1/auth/two-factor')
      .withCookie(CHALLENGE_COOKIE, second.cookie(CHALLENGE_COOKIE)!.value)
      .json({ code: '123456' })
    expired.assertStatus(410)
  })

  test('"Reenviar" waits a minute, and the new code replaces the old one', async ({
    client,
    assert,
  }) => {
    const user = await createUser({ password: PASSWORD })
    const mails = mail.fake()
    const first = await client
      .post('/api/v1/auth/login')
      .json({ email: user.email, password: PASSWORD })
    const challenge = first.cookie(CHALLENGE_COOKIE)!.value
    const { code: oldCode } = mails.mails.queued()[0] as SignInCodeNotification

    const tooSoon = await client
      .post('/api/v1/auth/two-factor/resend')
      .withCookie(CHALLENGE_COOKIE, challenge)
    tooSoon.assertStatus(429)

    await db
      .from('login_challenges')
      .where('user_id', user.id)
      .update({ last_sent_at: DateTime.now().minus({ minutes: 2 }).toJSDate() })
    const resent = await client
      .post('/api/v1/auth/two-factor/resend')
      .withCookie(CHALLENGE_COOKIE, challenge)
    resent.assertStatus(200)
    assert.exists(resent.body().data.twoFactor.resendAt)
    const codes = mails.mails.queued().map((queued) => (queued as SignInCodeNotification).code)
    assert.lengthOf(codes, 2)
    const newCode = codes[1]

    if (oldCode !== newCode) {
      const old = await client
        .post('/api/v1/auth/two-factor')
        .withCookie(CHALLENGE_COOKIE, challenge)
        .json({ code: oldCode })
      old.assertStatus(422)
    }
    const ok = await client
      .post('/api/v1/auth/two-factor')
      .withCookie(CHALLENGE_COOKIE, challenge)
      .json({ code: newCode })
    ok.assertStatus(200)
  })

  test('a trusted device skips the second step until its session ends or the password changes', async ({
    client,
    assert,
  }) => {
    const user = await createUser({ password: PASSWORD })
    const trusted = await signIn(
      client,
      { email: user.email, password: PASSWORD },
      { remember: true }
    )
    assert.exists(trusted.trust)

    // Next sign-in on that browser: straight in, and the session says so.
    const skip = await signIn(
      client,
      { email: user.email, password: PASSWORD },
      { trust: trusted.trust }
    )
    assert.exists(skip.response.body().data.user)
    const sessions = await client
      .get('/api/v1/account/sessions')
      .withCookie(SESSION_COOKIE, skip.session)
    assert.isTrue(sessions.body().data.find((s: { current: boolean }) => s.current).trusted)

    // Another user can't ride on that cookie.
    const other = await createUser({ password: PASSWORD })
    const otherLogin = await client
      .post('/api/v1/auth/login')
      .withCookie(TRUST_COOKIE, trusted.trust!)
      .json({ email: other.email, password: PASSWORD })
    assert.exists(otherLogin.body().data.twoFactor)

    // Ending the trusted sessions from elsewhere ends the trust.
    const elsewhere = await signIn(client, { email: user.email, password: PASSWORD })
    await client.delete('/api/v1/account/sessions').withCookie(SESSION_COOKIE, elsewhere.session)
    const asksAgain = await client
      .post('/api/v1/auth/login')
      .withCookie(TRUST_COOKIE, trusted.trust!)
      .json({ email: user.email, password: PASSWORD })
    assert.exists(asksAgain.body().data.twoFactor)

    // A new trust ends when the password changes on another device.
    const retrusted = await signIn(
      client,
      { email: user.email, password: PASSWORD },
      { remember: true }
    )
    const changer = await signIn(client, { email: user.email, password: PASSWORD })
    await client.put('/api/v1/account/password').withCookie(SESSION_COOKIE, changer.session).json({
      currentPassword: PASSWORD,
      password: 'brand-new-1',
      passwordConfirmation: 'brand-new-1',
    })
    const afterChange = await client
      .post('/api/v1/auth/login')
      .withCookie(TRUST_COOKIE, retrusted.trust!)
      .json({ email: user.email, password: 'brand-new-1' })
    assert.exists(afterChange.body().data.twoFactor)
  })

  test('authenticator app: setup, sign-in with a code (once), recovery codes, disable', async ({
    client,
    assert,
  }) => {
    const user = await createUser({ password: PASSWORD })
    const { session } = await signIn(client, { email: user.email, password: PASSWORD })
    const account = (method: 'get' | 'post', path: string, body?: object) => {
      const request = client[method](`/api/v1/account/two-factor${path}`).withCookie(
        SESSION_COOKIE,
        session
      )
      return body ? request.json(body) : request
    }

    const setup = await account('post', '/setup')
    setup.assertStatus(200)
    const { secret, uri } = setup.body().data
    assert.match(uri, /^otpauth:\/\/totp\/React%20Menu:/)
    const wrong = await account('post', '/enable', { code: '000000' })
    wrong.assertStatus(422)
    const enabled = await account('post', '/enable', { code: totpCode(secret) })
    enabled.assertStatus(200)
    const recovery: string[] = enabled.body().data.recoveryCodes
    assert.lengthOf(recovery, 10)
    assert.match(recovery[0], /^[A-Z2-9]{4}-[A-Z2-9]{4}$/)
    const status = await account('get', '')
    status.assertBodyContains({ data: { enabled: true, recoveryCodesLeft: 10 } })
    const me = await client.get('/api/v1/auth/me').withCookie(SESSION_COOKIE, session)
    assert.isTrue(me.body().data.user.twoFactorEnabled)
    assert.notProperty(me.body().data.user, 'twoFactorSecret')

    // Sign-in now asks for the app's code; no e-mail goes out.
    const mails = mail.fake()
    const login = await client
      .post('/api/v1/auth/login')
      .json({ email: user.email, password: PASSWORD })
    login.assertBodyContains({ data: { twoFactor: { method: 'totp', emailHint: null } } })
    assert.lengthOf(mails.mails.queued(), 0)
    const challenge = login.cookie(CHALLENGE_COOKIE)!.value
    const verify = (body: object) =>
      client.post('/api/v1/auth/two-factor').withCookie(CHALLENGE_COOKIE, challenge).json(body)
    // The step used to enable it was spent: the next period's code signs in.
    const ok = await verify({ code: totpCode(secret, 1) })
    ok.assertStatus(200)

    // The same code can't be used twice.
    const replay = await client
      .post('/api/v1/auth/login')
      .json({ email: user.email, password: PASSWORD })
    const replayed = await client
      .post('/api/v1/auth/two-factor')
      .withCookie(CHALLENGE_COOKIE, replay.cookie(CHALLENGE_COOKIE)!.value)
      .json({ code: totpCode(secret, 1) })
    replayed.assertStatus(422)

    // A recovery code works once (any case, with or without the dash).
    const recover = (code: string) =>
      client
        .post('/api/v1/auth/two-factor')
        .withCookie(CHALLENGE_COOKIE, replay.cookie(CHALLENGE_COOKIE)!.value)
        .json({ code, recovery: true })
    const recovered = await recover(recovery[0].toLowerCase().replace('-', ''))
    recovered.assertStatus(200)
    const lost = await client
      .post('/api/v1/auth/login')
      .json({ email: user.email, password: PASSWORD })
    const reused = await client
      .post('/api/v1/auth/two-factor')
      .withCookie(CHALLENGE_COOKIE, lost.cookie(CHALLENGE_COOKIE)!.value)
      .json({ code: recovery[0], recovery: true })
    reused.assertStatus(422)

    // New recovery codes need a current code.
    const refused = await account('post', '/recovery-codes', { code: '000000' })
    refused.assertStatus(422)
    // (Time passes: the codes spent above are behind.)
    await db.from('users').where('id', user.id).update({ two_factor_last_step: null })
    const regenerated = await account('post', '/recovery-codes', { code: totpCode(secret) })
    regenerated.assertStatus(200)
    assert.notInclude(regenerated.body().data.recoveryCodes, recovery[1])

    // Turning it off needs the password; sign-ins go back to the e-mail code.
    const badPassword = await account('post', '/disable', { password: 'nope' })
    badPassword.assertStatus(422)
    const disabled = await account('post', '/disable', { password: PASSWORD })
    disabled.assertStatus(200)
    const back = await client
      .post('/api/v1/auth/login')
      .json({ email: user.email, password: PASSWORD })
    back.assertBodyContains({ data: { twoFactor: { method: 'email' } } })
    const codesLeft = await db.from('user_recovery_codes').where('user_id', user.id)
    assert.lengthOf(codesLeft, 0)
  })

  test('the e2e hook route only exists when E2E_TEST_HOOKS is on', async ({ client }) => {
    const response = await client
      .get('/api/v1/__e2e/two-factor-code')
      .qs({ email: 'x@example.com' })
    response.assertStatus(404)
  })
})
