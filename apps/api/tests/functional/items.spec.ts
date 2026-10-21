import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import StoreRole from '#enums/store_role'
import { createMenuStore, createUser, linkUser } from '#tests/helpers/fixtures'

test.group('Items', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('a partial update (sold out) does not require the category', async ({ client, assert }) => {
    const manager = await createUser()
    const { store, carne } = await createMenuStore()
    await linkUser(store, manager, StoreRole.MANAGER)

    const response = await client
      .put(`/api/v1/stores/${store.id}/items/${carne.id}`)
      .json({ isAvailable: false })
      .loginAs(manager)

    response.assertStatus(200)
    assert.isFalse(response.body().data.isAvailable)
    assert.equal(response.body().data.categoryId, carne.categoryId)
  })

  test('the list filters by category name and by item name', async ({ client, assert }) => {
    const manager = await createUser()
    const { store } = await createMenuStore()
    await linkUser(store, manager, StoreRole.MANAGER)
    const list = (qs: Record<string, string>) =>
      client.get(`/api/v1/stores/${store.id}/items`).qs(qs).loginAs(manager)

    const drinks = await list({ category_name: 'Bebidas' })
    const names = drinks
      .body()
      .data.map((item: { category: { name: string } }) => item.category.name)
    assert.isNotEmpty(names)
    assert.isTrue(names.every((name: string) => name === 'Bebidas'))

    const carne = await list({ name: 'carne' })
    assert.isTrue(
      carne.body().data.every((item: { name: string }) => item.name.toLowerCase().includes('carne'))
    )
  })

  test('the list sorts by allowed columns and ignores the rest', async ({ client, assert }) => {
    const manager = await createUser()
    const { store } = await createMenuStore()
    await linkUser(store, manager, StoreRole.MANAGER)
    const prices = async (sort: string) => {
      const response = await client
        .get(`/api/v1/stores/${store.id}/items`)
        .qs({ sort })
        .loginAs(manager)
      response.assertStatus(200)
      return response.body().data.map((item: { price: number }) => Number(item.price))
    }

    assert.deepEqual(await prices('price:desc'), [15, 14, 6])
    assert.deepEqual(await prices('price:asc'), [6, 14, 15])
    // Unknown column: ignored, default order, no error.
    assert.lengthOf(await prices('password:asc'), 3)
  })
})
