import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import StoreRole from '#enums/store_role'
import Ingredient from '#models/ingredient'
import Order from '#models/order'
import { createMenuStore, createUser, linkUser } from '#tests/helpers/fixtures'

const customer = { name: 'Ana', phone: '11987654321' }
const today = () => DateTime.now().setZone('America/Sao_Paulo').toISODate()!

async function storeWithSales() {
  const menu = await createMenuStore()
  const manager = await createUser()
  await linkUser(menu.store, manager, StoreRole.MANAGER)
  menu.store.inventoryEnabled = true
  await menu.store.save()
  const massa = await Ingredient.create({
    storeId: menu.store.id,
    name: 'Massa',
    unit: 'un',
    stockQuantity: 100,
    minStock: 0,
  })
  await menu.carne.related('ingredients').attach({ [massa.id]: { quantity: 1 } })
  return { ...menu, manager, massa }
}

test.group('Sales reports', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('totals, best sellers, mixes and stock count only real sales', async ({
    client,
    assert,
  }) => {
    const { store, manager, carne, queijo, catupiry } = await storeWithSales()
    const publicOrder = (lines: object[], paymentMethod = 'counter') =>
      client
        .post(`/api/v1/public/menu/${store.slug}/orders`)
        .json({ customer, paymentMethod, lines })

    // Sales: 2 meat (+catupiry) at the counter online, 1 cheese at the POS.
    await publicOrder([{ itemId: carne.id, quantity: 2, addonIds: [catupiry.id] }])
    await client
      .post(`/api/v1/stores/${store.id}/orders`)
      .json({ customer: { name: 'Balcão' }, lines: [{ itemId: queijo.id, quantity: 1 }] })
      .loginAs(manager)
    // Not sales: an unpaid Pix, and a cancelled order (its dough goes back).
    await publicOrder([{ itemId: queijo.id, quantity: 5 }], 'pix')
    const toCancel = await publicOrder([{ itemId: carne.id, quantity: 3 }])
    const cancelled = await Order.findByOrFail('publicToken', toCancel.body().data.publicToken)
    await client.post(`/api/v1/stores/${store.id}/orders/${cancelled.id}/cancel`).loginAs(manager)

    const response = await client
      .get(`/api/v1/stores/${store.id}/reports/sales`)
      .qs({ from: today(), to: today() })
      .loginAs(manager)

    response.assertStatus(200)
    const report = response.body().data
    const meat = 2 * (carne.price + catupiry.price)
    const revenue = meat + queijo.price
    assert.equal(report.summary.revenue, revenue)
    assert.equal(report.summary.orders, 2)
    assert.equal(report.summary.averageTicket, Math.round((revenue / 2) * 100) / 100)
    assert.equal(report.summary.units, 3)
    assert.deepEqual(report.summary.cancelled, { orders: 1, value: 3 * carne.price })
    assert.deepEqual(report.items[0], { name: carne.name, quantity: 2, revenue: meat })
    assert.deepEqual(report.addons, [
      { name: catupiry.name, quantity: 2, revenue: 2 * catupiry.price },
    ])
    assert.sameDeepMembers(report.channels, [
      { channel: 'online', orders: 1, revenue: meat },
      { channel: 'pos', orders: 1, revenue: queijo.price },
    ])
    assert.deepEqual(report.payments, [{ method: 'counter', orders: 2, revenue }])
    assert.deepEqual(report.daily, [{ date: today(), orders: 2, revenue }])
    assert.lengthOf(report.hourly, 24)
    assert.equal(
      report.hourly.reduce((sum: number, hour: { orders: number }) => sum + hour.orders, 0),
      2
    )
    // 2 sold + 3 cancelled and put back = 2 net.
    assert.deepEqual(
      report.stock.map((row: { name: string; consumed: number }) => [row.name, row.consumed]),
      [['Massa', 2]]
    )
  })

  test('empty days are zeros, and the previous period is compared', async ({ client, assert }) => {
    const { store, manager } = await storeWithSales()
    const to = today()
    const from = DateTime.fromISO(to).minus({ days: 6 }).toISODate()!

    const response = await client
      .get(`/api/v1/stores/${store.id}/reports/sales`)
      .qs({ from, to })
      .loginAs(manager)

    const report = response.body().data
    assert.lengthOf(report.daily, 7)
    assert.equal(report.daily[0].date, from)
    assert.equal(report.period.days, 7)
    assert.equal(report.previousPeriod.to, DateTime.fromISO(from).minus({ days: 1 }).toISODate())
    assert.deepEqual(report.summary.previous, { orders: 0, revenue: 0 })
  })

  test('managers of the store only; periods are validated', async ({ client }) => {
    const { store, manager } = await storeWithSales()
    const attendant = await createUser()
    await linkUser(store, attendant, StoreRole.ATTENDANT)
    const other = await storeWithSales()
    const url = `/api/v1/stores/${store.id}/reports/sales`
    const day = today()

    const byAttendant = await client.get(url).qs({ from: day, to: day }).loginAs(attendant)
    const byOtherStore = await client.get(url).qs({ from: day, to: day }).loginAs(other.manager)
    const backwards = await client.get(url).qs({ from: day, to: '2020-01-01' }).loginAs(manager)
    const tooLong = await client
      .get(url)
      .qs({ from: '2020-01-01', to: '2021-06-01' })
      .loginAs(manager)

    byAttendant.assertStatus(403)
    byOtherStore.assertStatus(403)
    backwards.assertStatus(422)
    tooLong.assertStatus(422)
  })
})
