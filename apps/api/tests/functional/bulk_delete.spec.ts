import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import Item from '#models/item'
import { createCategory, createItem, createStore, createUser } from '#tests/helpers/fixtures'

test.group('Bulk delete', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('deletes only items of the store and returns { deleted, failed }', async ({
    client,
    assert,
  }) => {
    const member = await createUser()
    const store = await createStore([member])
    const ownItem = await createItem(await createCategory(store))
    const foreignItem = await createItem(await createCategory(await createStore()))

    const response = await client
      .post(`/api/v1/stores/${store.id}/items/bulk-delete`)
      .json({ ids: [ownItem.id, foreignItem.id] })
      .loginAs(member)

    response.assertStatus(200)
    response.assertBodyContains({ success: true, data: { failed: [] } })
    assert.lengthOf(response.body().data.deleted, 1)
    assert.isNull(await Item.find(ownItem.id))
    assert.isNotNull(await Item.find(foreignItem.id))
  })

  test('viewing an item in the admin does not count as a menu view', async ({ client, assert }) => {
    const member = await createUser()
    const store = await createStore([member])
    const item = await createItem(await createCategory(store))

    await client.get(`/api/v1/stores/${store.id}/items/${item.id}`).loginAs(member)

    await item.refresh()
    assert.equal(item.views, 0)
  })
})
