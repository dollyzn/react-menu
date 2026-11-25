import { test } from '@japa/runner'
import StoreRole from '#enums/store_role'
import { createMenuStore, createUser, linkUser } from '#tests/helpers/fixtures'
import { emptyDatabase } from '#tests/helpers/database'

test.group('Items', (group) => {
  group.each.setup(() => emptyDatabase)

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

  test('the list counts the items of each category filter option', async ({ client, assert }) => {
    const manager = await createUser()
    const { store } = await createMenuStore()
    await linkUser(store, manager, StoreRole.MANAGER)
    // Another store with the same category names never counts.
    await createMenuStore()
    const facets = async (qs: Record<string, string>) => {
      const response = await client
        .get(`/api/v1/stores/${store.id}/items`)
        .qs({ facets: '1', ...qs })
        .loginAs(manager)
      response.assertStatus(200)
      return response.body().meta.facets.category_name as Record<string, number>
    }

    assert.deepEqual(await facets({}), { Pastéis: 2, Bebidas: 1 })
    // Its own choice is left out, so the other categories can still be picked.
    assert.deepEqual(await facets({ category_name: 'Bebidas' }), { Pastéis: 2, Bebidas: 1 })
    // The name search applies.
    assert.deepEqual(await facets({ name: 'carne' }), { Pastéis: 1 })
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
