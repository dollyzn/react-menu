import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import env from '#start/env'
import { createStaff } from '#tests/helpers/fixtures'
import { SESSION_COOKIE, signIn } from '#tests/helpers/sign_in'

const COOKIE = env.get('AUTH_COOKIE_NAME')

test.group('Session', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('the session renews itself in its second half and keeps it otherwise', async ({
    client,
    assert,
  }) => {
    const user = await createStaff({ password: 'secret123' })
    const { session: token } = await signIn(client, { email: user.email, password: 'secret123' })

    // Fresh session: nothing changes.
    const fresh = await client.get('/api/v1/auth/me').withCookie(COOKIE, token)
    fresh.assertStatus(200)
    assert.isUndefined(fresh.cookie(COOKIE))

    // Still more than half of the 14 days left: kept.
    const signedInAt = DateTime.now().minus({ days: 9 }).startOf('second').toJSDate()
    await db
      .from('auth_access_tokens')
      .where('tokenable_id', user.id)
      .update({ expires_at: DateTime.now().plus({ days: 8 }).toJSDate(), signed_in_at: signedInAt })
    const kept = await client.get('/api/v1/auth/me').withCookie(COOKIE, token)
    assert.isUndefined(kept.cookie(COOKIE))

    // Six days left: a new token replaces the old one.
    await db
      .from('auth_access_tokens')
      .where('tokenable_id', user.id)
      .update({ expires_at: DateTime.now().plus({ days: 6 }).toJSDate() })
    const renewed = await client.get('/api/v1/auth/me').withCookie(COOKIE, token)
    renewed.assertStatus(200)
    const newToken = renewed.cookie(COOKIE)?.value
    assert.exists(newToken)
    assert.notEqual(newToken, token)
    const expiresAt = DateTime.fromISO(renewed.body().data.user.tokenExpiresAt)
    assert.isAbove(expiresAt.diffNow('days').days, 13)

    const tokens = await db.from('auth_access_tokens').where('tokenable_id', user.id)
    assert.lengthOf(tokens, 1)
    // "Sessões ativas" still says since when this sign-in lasts.
    assert.equal(new Date(tokens[0].signed_in_at).getTime(), signedInAt.getTime())
    const withOld = await client.get('/api/v1/auth/me').withCookie(COOKIE, token)
    const withNew = await client.get('/api/v1/auth/me').withCookie(COOKIE, newToken!)
    withOld.assertStatus(401)
    withNew.assertStatus(200)
  })
})

test.group('Cookie writes from another origin', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('a write with the session cookie must come from the panel origin', async ({ client }) => {
    const user = await createStaff({ password: 'secret123' })
    const { session } = await signIn(client, { email: user.email, password: 'secret123' })
    const write = () =>
      client
        .put('/api/v1/account/profile')
        .json({ name: 'Novo Nome' })
        .withCookie(SESSION_COOKIE, session)

    const evil = await write().header('origin', 'https://evil.example')
    const sibling = await write().header('sec-fetch-site', 'same-site')
    const panel = await write().header('origin', new URL(env.get('FRONTEND_URL')).origin)
    const noBrowser = await write()
    // Reading is never blocked.
    const read = await client
      .get('/api/v1/auth/me')
      .withCookie(SESSION_COOKIE, session)
      .header('origin', 'https://evil.example')

    evil.assertStatus(403)
    evil.assertBodyContains({ code: 'E_UNTRUSTED_ORIGIN' })
    sibling.assertStatus(403)
    panel.assertStatus(200)
    noBrowser.assertStatus(200)
    read.assertStatus(200)
  })
})
