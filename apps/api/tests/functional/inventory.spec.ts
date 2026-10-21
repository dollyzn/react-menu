import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import StoreRole from '#enums/store_role'
import Ingredient from '#models/ingredient'
import Order from '#models/order'
import { createMenuStore, createUser, linkUser } from '#tests/helpers/fixtures'

const customer = { name: 'Ana', phone: '11987654321' }

async function stockedStore() {
  const manager = await createUser()
  const menu = await createMenuStore()
  await linkUser(menu.store, manager, StoreRole.MANAGER)
  menu.store.inventoryEnabled = true
  await menu.store.save()

  const massa = await Ingredient.create({
    storeId: menu.store.id,
    name: 'Massa',
    unit: 'un',
    stockQuantity: 3,
    minStock: 1,
  })
  const carneMoida = await Ingredient.create({
    storeId: menu.store.id,
    name: 'Carne moída',
    unit: 'g',
    stockQuantity: 500,
    minStock: 100,
  })
  const catupiry = await Ingredient.create({
    storeId: menu.store.id,
    name: 'Catupiry',
    unit: 'g',
    stockQuantity: 100,
    minStock: 0,
  })
  await menu.carne.related('ingredients').attach({
    [massa.id]: { quantity: 1 },
    [carneMoida.id]: { quantity: 80 },
  })
  await menu.catupiry.related('ingredients').attach({ [catupiry.id]: { quantity: 30 } })

  return { ...menu, manager, massa, carneMoida, catupiryStock: catupiry }
}

test.group('Inventory', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('orders consume item and add-on recipes when they enter the kitchen', async ({
    client,
    assert,
  }) => {
    const { store, carne, catupiry, massa, carneMoida, catupiryStock } = await stockedStore()

    const response = await client.post(`/api/v1/public/menu/${store.slug}/orders`).json({
      customer,
      paymentMethod: 'counter',
      lines: [{ itemId: carne.id, quantity: 2, addonIds: [catupiry.id] }],
    })

    response.assertStatus(200)
    await Promise.all([massa.refresh(), carneMoida.refresh(), catupiryStock.refresh()])
    assert.equal(massa.stockQuantity, 1)
    assert.equal(carneMoida.stockQuantity, 340)
    assert.equal(catupiryStock.stockQuantity, 40)
  })

  test('items without enough stock become unavailable', async ({ client, assert }) => {
    const { store, carne, massa } = await stockedStore()
    massa.stockQuantity = 0
    await massa.save()

    const menu = await client.get(`/api/v1/public/menu/${store.slug}`)
    const order = await client.post(`/api/v1/public/menu/${store.slug}/orders`).json({
      customer,
      paymentMethod: 'counter',
      lines: [{ itemId: carne.id, quantity: 1 }],
    })

    const carneEntry = menu
      .body()
      .data.categories[0].items.find((item: { id: string }) => item.id === carne.id)
    assert.isFalse(carneEntry.isAvailable)
    order.assertStatus(422)
  })

  test('cancelling an order puts its ingredients back', async ({ client, assert }) => {
    const { store, carne, manager, massa } = await stockedStore()
    const placed = await client.post(`/api/v1/public/menu/${store.slug}/orders`).json({
      customer,
      paymentMethod: 'counter',
      lines: [{ itemId: carne.id, quantity: 1 }],
    })
    const order = await Order.findByOrFail('publicToken', placed.body().data.publicToken)

    const cancel = await client
      .post(`/api/v1/stores/${store.id}/orders/${order.id}/cancel`)
      .loginAs(manager)

    cancel.assertStatus(200)
    await massa.refresh()
    assert.equal(massa.stockQuantity, 3)
  })

  test('a physical count records the difference as an adjustment', async ({ client, assert }) => {
    const { store, manager, carneMoida } = await stockedStore()

    const response = await client
      .post(`/api/v1/stores/${store.id}/ingredients/${carneMoida.id}/movements`)
      .json({ type: 'adjustment', quantity: 420, note: 'Contagem de sexta' })
      .loginAs(manager)
    const movements = await client
      .get(`/api/v1/stores/${store.id}/ingredients/${carneMoida.id}/movements`)
      .loginAs(manager)

    response.assertStatus(200)
    await carneMoida.refresh()
    assert.equal(carneMoida.stockQuantity, 420)
    assert.equal(movements.body().data[0].quantity, -80)
  })

  test('stores without inventory tracking never block sales', async ({ client }) => {
    const { store, carne, massa } = await stockedStore()
    store.inventoryEnabled = false
    await store.save()
    massa.stockQuantity = 0
    await massa.save()

    const response = await client.post(`/api/v1/public/menu/${store.slug}/orders`).json({
      customer,
      paymentMethod: 'counter',
      lines: [{ itemId: carne.id, quantity: 1 }],
    })

    response.assertStatus(200)
  })

  test('ingredients list is paginated, sorted and filtered by stock status', async ({
    client,
    assert,
  }) => {
    const { store, manager } = await stockedStore()
    await Ingredient.create({
      storeId: store.id,
      name: 'Queijo',
      unit: 'g',
      stockQuantity: 50,
      minStock: 100,
    })
    const url = `/api/v1/stores/${store.id}/ingredients`

    const page = await client
      .get(url)
      .qs({ page: 1, perPage: 2, sort: 'stockQuantity:desc' })
      .loginAs(manager)
    page.assertStatus(200)
    assert.deepEqual(
      page.body().data.map((i: { name: string }) => i.name),
      ['Carne moída', 'Catupiry']
    )
    assert.equal(page.body().meta.total, 4)

    // Search ignores case.
    const search = await client.get(url).qs({ name: 'carne' }).loginAs(manager)
    assert.deepEqual(
      search.body().data.map((i: { name: string }) => i.name),
      ['Carne moída']
    )

    const low = await client.get(url).qs({ stock: 'low' }).loginAs(manager)
    assert.deepEqual(
      low.body().data.map((i: { name: string }) => i.name),
      ['Queijo']
    )

    const grams = await client.get(url).qs({ unit: 'g', stock: 'ok' }).loginAs(manager)
    assert.deepEqual(
      grams.body().data.map((i: { name: string }) => i.name),
      ['Carne moída', 'Catupiry']
    )
  })

  test("another store's member can't list the ingredients", async ({ client }) => {
    const { store } = await stockedStore()
    const outsider = await stockedStore()

    const response = await client
      .get(`/api/v1/stores/${store.id}/ingredients`)
      .loginAs(outsider.manager)

    response.assertStatus(403)
  })

  test('recipes only accept ingredients of the same store', async ({ client }) => {
    const { store, manager, carne } = await stockedStore()
    const other = await stockedStore()

    const response = await client
      .put(`/api/v1/stores/${store.id}/items/${carne.id}/recipe`)
      .json({ ingredients: [{ ingredientId: other.massa.id, quantity: 1 }] })
      .loginAs(manager)

    response.assertStatus(422)
  })
})
