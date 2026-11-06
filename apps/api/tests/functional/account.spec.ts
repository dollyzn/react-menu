import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import testUtils from '@adonisjs/core/services/test_utils'
import drive from '@adonisjs/drive/services/main'
import db from '@adonisjs/lucid/services/db'
import env from '#start/env'
import { uploadKey } from '#helpers/uploads'
import { createUser } from '#tests/helpers/fixtures'

const COOKIE = env.get('AUTH_COOKIE_NAME')
const CHROME_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'

/** A valid 1×1 PNG. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

test.group('Account', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  /** Signs in from a browser and returns that session's cookie value. */
  async function signIn(client: ApiClient, email: string, password: string, userAgent: string) {
    const login = await client
      .post('/api/v1/auth/login')
      .header('user-agent', userAgent)
      .json({ email, password })
    login.assertStatus(200)
    return login.cookie(COOKIE)!.value
  }

  test('lists the sessions with their device, and ends the others', async ({ client, assert }) => {
    const user = await createUser({ password: 'secret123' })
    const other = await createUser({ password: 'secret123' })
    const laptop = await signIn(client, user.email, 'secret123', CHROME_WINDOWS)
    const phone = await signIn(client, user.email, 'secret123', SAFARI_IPHONE)
    const stranger = await signIn(client, other.email, 'secret123', CHROME_WINDOWS)

    const list = await client.get('/api/v1/account/sessions').withCookie(COOKIE, laptop)
    list.assertStatus(200)
    const sessions = list.body().data
    assert.lengthOf(sessions, 2, "only this user's sessions")
    assert.include(sessions[0], { current: true, device: 'desktop', os: 'Windows 10' })
    assert.match(sessions[0].browser, /^Chrome 141/)
    assert.include(sessions[1], { current: false, device: 'mobile' })
    assert.match(sessions[1].os, /^iOS/)
    assert.exists(sessions[1].ipAddress)
    assert.exists(sessions[1].signedInAt)

    // Someone else's session id changes nothing; the current one needs "Sair".
    const strangerRow = await db
      .from('auth_access_tokens')
      .where('tokenable_id', other.id)
      .select('id')
      .first()
    const strangerId = strangerRow.id
    await client.delete(`/api/v1/account/sessions/${strangerId}`).withCookie(COOKIE, laptop)
    const strangerMe = await client.get('/api/v1/auth/me').withCookie(COOKIE, stranger)
    strangerMe.assertStatus(200)
    const current = await client
      .delete(`/api/v1/account/sessions/${sessions[0].id}`)
      .withCookie(COOKIE, laptop)
    current.assertStatus(422)

    const revoked = await client
      .delete(`/api/v1/account/sessions/${sessions[1].id}`)
      .withCookie(COOKIE, laptop)
    revoked.assertStatus(200)
    const phoneMe = await client.get('/api/v1/auth/me').withCookie(COOKIE, phone)
    phoneMe.assertStatus(401)

    const again = await signIn(client, user.email, 'secret123', SAFARI_IPHONE)
    const others = await client.delete('/api/v1/account/sessions').withCookie(COOKIE, laptop)
    others.assertStatus(200)
    const againMe = await client.get('/api/v1/auth/me').withCookie(COOKIE, again)
    againMe.assertStatus(401)
    const laptopMe = await client.get('/api/v1/auth/me').withCookie(COOKIE, laptop)
    laptopMe.assertStatus(200)
  })

  test('edits the name and the profile photo', async ({ client, assert }) => {
    drive.fake()
    const user = await createUser()

    const renamed = await client
      .put('/api/v1/account/profile')
      .json({ name: '  Ana Souza ' })
      .loginAs(user)
    renamed.assertStatus(200)
    renamed.assertBodyContains({ data: { name: 'Ana Souza', firstName: 'Ana' } })
    const tooShort = await client.put('/api/v1/account/profile').json({ name: 'A' }).loginAs(user)
    tooShort.assertStatus(422)

    const first = await client
      .put('/api/v1/account/avatar')
      .file('avatar', PNG, { filename: 'eu.png' })
      .loginAs(user)
    first.assertStatus(200)
    const firstKey = uploadKey(first.body().data.avatarUrl, 'avatars')!
    assert.match(firstKey, new RegExp(`^avatars/${user.id}_`))
    const replaced = await client
      .put('/api/v1/account/avatar')
      .file('avatar', PNG, { filename: 'eu2.png' })
      .loginAs(user)
    const secondKey = uploadKey(replaced.body().data.avatarUrl, 'avatars')!
    assert.notEqual(secondKey, firstKey)
    assert.isFalse(await drive.use().exists(firstKey), 'the old photo is deleted')

    const notImage = await client
      .put('/api/v1/account/avatar')
      .file('avatar', Buffer.from('nope'), { filename: 'notes.txt' })
      .loginAs(user)
    notImage.assertStatus(422)

    const removed = await client.delete('/api/v1/account/avatar').loginAs(user)
    removed.assertBodyContains({ data: { avatarUrl: null } })
    assert.isFalse(await drive.use().exists(secondKey))
    drive.restore()

    const guest = await client.put('/api/v1/account/profile').json({ name: 'Ninguém' })
    guest.assertStatus(401)
  })

  test('changing the password needs the current one and ends the other sessions', async ({
    client,
    assert,
  }) => {
    const user = await createUser({ password: 'secret123' })
    const here = await signIn(client, user.email, 'secret123', CHROME_WINDOWS)
    const elsewhere = await signIn(client, user.email, 'secret123', SAFARI_IPHONE)
    const change = (body: object) =>
      client.put('/api/v1/account/password').json(body).withCookie(COOKIE, here)

    const wrong = await change({
      currentPassword: 'nope',
      password: 'brand-new-1',
      passwordConfirmation: 'brand-new-1',
    })
    wrong.assertStatus(422)
    wrong.assertBodyContains({ code: 'E_WRONG_PASSWORD' })
    const mismatch = await change({
      currentPassword: 'secret123',
      password: 'brand-new-1',
      passwordConfirmation: 'brand-new-2',
    })
    mismatch.assertStatus(422)
    const short = await change({
      currentPassword: 'secret123',
      password: 'short',
      passwordConfirmation: 'short',
    })
    short.assertStatus(422)

    const ok = await change({
      currentPassword: 'secret123',
      password: 'brand-new-1',
      passwordConfirmation: 'brand-new-1',
    })
    ok.assertStatus(200)
    const hereMe = await client.get('/api/v1/auth/me').withCookie(COOKIE, here)
    hereMe.assertStatus(200)
    const elsewhereMe = await client.get('/api/v1/auth/me').withCookie(COOKIE, elsewhere)
    elsewhereMe.assertStatus(401)
    const oldLogin = await client
      .post('/api/v1/auth/login')
      .json({ email: user.email, password: 'secret123' })
    assert.notEqual(oldLogin.status(), 200)
    await signIn(client, user.email, 'brand-new-1', CHROME_WINDOWS)
  })
})
