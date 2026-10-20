import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { cuid } from '@adonisjs/core/helpers'
import User from '#models/user'
import { createStore, createUser, createUserWithPermissions } from '#tests/helpers/fixtures'

test.group('Store creation and deletion', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('user without create_store cannot create a store', async ({ client }) => {
    const user = await createUser()

    const response = await client
      .post('/api/v1/stores')
      .json({ name: 'Nova', slug: `nova-${cuid()}` })
      .loginAs(user)

    response.assertStatus(403)
  })

  test('creator becomes a member of the new store', async ({ client, assert }) => {
    const user = await createUserWithPermissions(['create_store'])

    const response = await client
      .post('/api/v1/stores')
      .json({ name: 'Nova', slug: `nova-${cuid()}` })
      .loginAs(user)

    response.assertStatus(200)
    assert.isTrue(await user.hasStoreAccess(response.body().data.id))
  })

  test('creating a default store unsets the previous default', async ({ client, assert }) => {
    const user = await createUserWithPermissions(['create_store'])
    const previous = await createStore()
    previous.isDefault = true
    await previous.save()

    const response = await client
      .post('/api/v1/stores')
      .json({ name: 'Nova padrão', slug: `nova-${cuid()}`, isDefault: true })
      .loginAs(user)

    response.assertStatus(200)
    await previous.refresh()
    assert.isFalse(previous.isDefault)
    assert.isTrue(response.body().data.isDefault)
  })

  test('member without delete_store cannot delete the store', async ({ client }) => {
    const member = await createUser()
    const store = await createStore([member])

    const response = await client.delete(`/api/v1/stores/${store.id}`).loginAs(member)

    response.assertStatus(403)
  })
})

test.group('Users management', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('regular user cannot list, edit or delete users', async ({ client, assert }) => {
    const attacker = await createUser()
    const victim = await createUser()
    const store = await createStore()

    const list = await client.get('/api/v1/users').loginAs(attacker)
    const update = await client
      .put(`/api/v1/users/${victim.id}`)
      .json({ name: 'pwned', email: victim.email, password: 'hijacked', storeIds: [store.id] })
      .loginAs(attacker)
    const destroy = await client.delete(`/api/v1/users/${victim.id}`).loginAs(attacker)

    list.assertStatus(403)
    update.assertStatus(403)
    destroy.assertStatus(403)
    assert.isNotNull(await User.find(victim.id))
  })

  test('user with list_user can list users', async ({ client }) => {
    const manager = await createUserWithPermissions(['list_user'])

    const response = await client.get('/api/v1/users').loginAs(manager)

    response.assertStatus(200)
  })
})

test.group('Auth', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('public registration is disabled', async ({ client }) => {
    const response = await client
      .post('/api/v1/auth/register')
      .json({ name: 'Someone', email: `${cuid()}@example.com`, password: 'secret123' })

    response.assertStatus(404)
  })

  test('session endpoint answers 401 without a session', async ({ client }) => {
    const response = await client.get('/api/v1/auth/me')

    response.assertStatus(401)
    response.assertBodyContains({ success: false, code: 'E_UNAUTHORIZED_ACCESS' })
  })

  test('login issues an expiring session cookie', async ({ client, assert }) => {
    const user = await createUser()

    const response = await client
      .post('/api/v1/auth/login')
      .json({ email: user.email, password: 'secret123' })

    response.assertStatus(200)
    assert.isNotNull(response.body().data.user.tokenExpiresAt)
    assert.match(response.header('set-cookie')?.[0] ?? '', /Max-Age=604800/)
  })
})
