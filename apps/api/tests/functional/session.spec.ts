import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import env from '#start/env'
import { createUser } from '#tests/helpers/fixtures'

const COOKIE = env.get('AUTH_COOKIE_NAME')

test.group('Session', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('the session renews itself in its second half and keeps it otherwise', async ({
    client,
    assert,
  }) => {
    const user = await createUser({ password: 'secret123' })
    const login = await client
      .post('/api/v1/auth/login')
      .json({ email: user.email, password: 'secret123' })
    login.assertStatus(200)
    const token = login.cookie(COOKIE)!.value

    // Fresh session: nothing changes.
    const fresh = await client.get('/api/v1/auth/me').withCookie(COOKIE, token)
    fresh.assertStatus(200)
    assert.isUndefined(fresh.cookie(COOKIE))

    // Two days left of seven: a new token replaces the old one.
    await db
      .from('auth_access_tokens')
      .where('tokenable_id', user.id)
      .update({ expires_at: DateTime.now().plus({ days: 2 }).toJSDate() })
    const renewed = await client.get('/api/v1/auth/me').withCookie(COOKIE, token)
    renewed.assertStatus(200)
    const newToken = renewed.cookie(COOKIE)?.value
    assert.exists(newToken)
    assert.notEqual(newToken, token)
    const expiresAt = DateTime.fromISO(renewed.body().data.user.tokenExpiresAt)
    assert.isAbove(expiresAt.diffNow('days').days, 6)

    const tokens = await db.from('auth_access_tokens').where('tokenable_id', user.id)
    assert.lengthOf(tokens, 1)
    const withOld = await client.get('/api/v1/auth/me').withCookie(COOKIE, token)
    const withNew = await client.get('/api/v1/auth/me').withCookie(COOKIE, newToken!)
    withOld.assertStatus(401)
    withNew.assertStatus(200)
  })
})
