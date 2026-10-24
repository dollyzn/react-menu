import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import StoreRole from '#enums/store_role'
import Ingredient from '#models/ingredient'
import { createMenuStore, createUser, linkUser } from '#tests/helpers/fixtures'

const customer = { name: 'Ana', phone: '11987654321' }

test.group('Dashboard today', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('sales, queue, stock alerts and menu health of today', async ({ client, assert }) => {
    const { store, carne, queijo, coca } = await createMenuStore()
    const manager = await createUser()
    await linkUser(store, manager, StoreRole.MANAGER)
    const attendant = await createUser()
    await linkUser(store, attendant, StoreRole.ATTENDANT)
    const other = await createMenuStore()
    const otherManager = await createUser()
    await linkUser(other.store, otherManager, StoreRole.MANAGER)
    store.inventoryEnabled = true
    await store.save()
    // Dough runs low; the cheese pastry needs more than there is.
    const massa = await Ingredient.create({
      storeId: store.id,
      name: 'Massa',
      unit: 'un',
      stockQuantity: 4,
      minStock: 10,
    })
    await queijo.related('ingredients').attach({ [massa.id]: { quantity: 5 } })
    coca.isAvailable = false
    await coca.save()

    const order = (lines: object[]) =>
      client
        .post(`/api/v1/public/menu/${store.slug}/orders`)
        .json({ customer, paymentMethod: 'counter', lines })
    await order([{ itemId: carne.id, quantity: 2 }])
    await order([{ itemId: carne.id, quantity: 1 }])

    const url = `/api/v1/stores/${store.id}/dashboard/today`
    const response = await client.get(url).loginAs(manager)
    const byAttendant = await client.get(url).loginAs(attendant)
    const byOtherStore = await client.get(url).loginAs(otherManager)

    response.assertStatus(200)
    byAttendant.assertStatus(403)
    byOtherStore.assertStatus(403)
    const data = response.body().data
    assert.deepInclude(data.sales, { orders: 2, revenue: 45, averageTicket: 22.5 })
    assert.deepEqual(data.queue, { pendingPayment: 0, received: 2, preparing: 0, ready: 0 })
    assert.deepEqual(data.topItems, [{ name: 'Pastel de Carne', quantity: 3 }])
    assert.lengthOf(data.pace, 24)
    assert.equal(data.visits.onlineOrders, 2)
    assert.deepEqual(
      data.lowStock.map((row: { name: string }) => row.name),
      ['Massa']
    )
    assert.deepInclude(data.menu, { items: 3, paused: 1, soldOut: 1 })
  })
})
