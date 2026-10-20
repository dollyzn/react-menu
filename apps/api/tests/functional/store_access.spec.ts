import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Category from '#models/category'
import { createCategory, createStore, createUser } from '#tests/helpers/fixtures'

test.group('Store access (tenant isolation)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('rejects unauthenticated requests', async ({ client }) => {
    const store = await createStore()

    const response = await client.get(`/api/v1/stores/${store.id}`)

    response.assertStatus(401)
  })

  test('member can read their own store', async ({ client }) => {
    const member = await createUser()
    const store = await createStore([member])

    const response = await client.get(`/api/v1/stores/${store.id}`).loginAs(member)

    response.assertStatus(200)
    response.assertBodyContains({ success: true, data: { id: store.id } })
  })

  test('non-member cannot read, update or delete another store', async ({ client }) => {
    const outsider = await createUser()
    const store = await createStore([await createUser()])

    const show = await client.get(`/api/v1/stores/${store.id}`).loginAs(outsider)
    const update = await client
      .put(`/api/v1/stores/${store.id}`)
      .json({ name: 'Hijacked' })
      .loginAs(outsider)
    const destroy = await client.delete(`/api/v1/stores/${store.id}`).loginAs(outsider)

    show.assertStatus(403)
    update.assertStatus(403)
    destroy.assertStatus(403)
  })

  test('non-member cannot touch nested resources of another store', async ({ client, assert }) => {
    const outsider = await createUser()
    const store = await createStore([await createUser()])
    const category = await createCategory(store)

    const list = await client.get(`/api/v1/stores/${store.id}/categories`).loginAs(outsider)
    const destroy = await client
      .delete(`/api/v1/stores/${store.id}/categories/${category.id}`)
      .loginAs(outsider)

    list.assertStatus(403)
    destroy.assertStatus(403)
    assert.isNotNull(await Category.find(category.id))
  })

  test('super user can access any store', async ({ client }) => {
    const admin = await createUser({ superUser: true })
    const store = await createStore()

    const response = await client.get(`/api/v1/stores/${store.id}`).loginAs(admin)

    response.assertStatus(200)
  })

  test('public menu stays public', async ({ client }) => {
    const store = await createStore()

    const response = await client.get(`/api/v1/public/menu/${store.slug}`)

    response.assertStatus(200)
  })
})
