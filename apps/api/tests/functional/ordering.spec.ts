import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Category from '#models/category'
import Item from '#models/item'
import { createCategory, createItem, createStore, createUser } from '#tests/helpers/fixtures'

async function orderedNames(query: Promise<{ name: string }[]>) {
  const rows = await query
  return rows.map((row) => row.name)
}

test.group('Ordering', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('categories are renumbered 1..N following the given ids', async ({ client, assert }) => {
    const member = await createUser()
    const store = await createStore([member])
    const [a, b, c] = await Category.createMany([
      { storeId: store.id, name: 'A', order: 1 },
      { storeId: store.id, name: 'B', order: 2 },
      { storeId: store.id, name: 'C', order: 3 },
    ])

    const response = await client
      .put(`/api/v1/stores/${store.id}/categories/order`)
      .json({ ids: [c.id, a.id, b.id] })
      .loginAs(member)

    response.assertStatus(200)
    const rows = await Category.query().where('storeId', store.id).orderBy('order')
    assert.deepEqual(
      rows.map((row) => [row.name, row.order]),
      [
        ['C', 1],
        ['A', 2],
        ['B', 3],
      ]
    )
  })

  test('a stale or foreign id list is rejected without changes', async ({ client, assert }) => {
    const member = await createUser()
    const store = await createStore([member])
    const own = await createCategory(store)
    const foreign = await createCategory(await createStore())

    const missing = await client
      .put(`/api/v1/stores/${store.id}/categories/order`)
      .json({ ids: [own.id, foreign.id] })
      .loginAs(member)

    missing.assertStatus(422)
    missing.assertBodyContains({ code: 'E_STALE_ORDER' })
    await own.refresh()
    assert.equal(own.order, 1)
  })

  test('items are reordered within their category', async ({ client, assert }) => {
    const member = await createUser()
    const store = await createStore([member])
    const category = await createCategory(store)
    const first = await createItem(category, { name: 'Primeiro', order: 1 })
    const second = await createItem(category, { name: 'Segundo', order: 2 })

    const response = await client
      .put(`/api/v1/stores/${store.id}/categories/${category.id}/items/order`)
      .json({ ids: [second.id, first.id] })
      .loginAs(member)

    response.assertStatus(200)
    assert.deepEqual(
      await orderedNames(Item.query().where('categoryId', category.id).orderBy('order')),
      ['Segundo', 'Primeiro']
    )
  })

  test('new items are appended to the end of the category', async ({ client, assert }) => {
    const member = await createUser()
    const store = await createStore([member])
    const category = await createCategory(store)
    await createItem(category, { name: 'Existente', order: 1 })

    const response = await client
      .post(`/api/v1/stores/${store.id}/categories/${category.id}/items`)
      .json({ name: 'Novo', price: 10 })
      .loginAs(member)

    response.assertStatus(200)
    assert.equal(response.body().data.order, 2)
  })
})
