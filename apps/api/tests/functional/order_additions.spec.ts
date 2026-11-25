import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import type { ApiClient } from '@japa/api-client'
import StoreRole from '#enums/store_role'
import Ingredient from '#models/ingredient'
import Order from '#models/order'
import OrderReceipt from '#models/order_receipt'
import type Store from '#models/store'
import type User from '#models/user'
import { createMenuStore, createUser, linkUser } from '#tests/helpers/fixtures'
import { fakeQueue } from '#tests/helpers/queue'
import { emptyDatabase } from '#tests/helpers/database'

async function counterStore() {
  const menu = await createMenuStore()
  const manager = await createUser()
  const attendant = await createUser()
  const cook = await createUser()
  await linkUser(menu.store, manager, StoreRole.MANAGER)
  await linkUser(menu.store, attendant, StoreRole.ATTENDANT)
  await linkUser(menu.store, cook, StoreRole.KITCHEN)
  return { ...menu, manager, attendant, cook }
}

/** A POS order of one meat pastry (R$ 15), paid in cash unless told otherwise. */
async function placeOrder(
  client: ApiClient,
  store: Store,
  itemId: string,
  user: User,
  { paid = true } = {}
) {
  const response = await client
    .post(`/api/v1/stores/${store.id}/orders`)
    .json({
      customer: { name: 'Maria' },
      lines: [{ itemId, quantity: 1 }],
      counterMethod: paid ? 'cash' : undefined,
    })
    .loginAs(user)
  response.assertStatus(200)
  return response.body().data as { id: string; number: number; total: number }
}

async function firstLineId(orderId: string) {
  // In the order they were placed (without it, Postgres may hand back the
  // drink added later, which the kitchen never makes).
  const order = await Order.query()
    .where('id', orderId)
    .preload('items', (items) => items.orderBy('id'))
    .firstOrFail()
  return order.items[0].id
}

test.group('Orders | items added while in the queue', (group) => {
  group.each.setup(() => {
    fakeQueue()
  })
  group.each.setup(() => emptyDatabase)

  test('a paid order takes a drink paid on Pix: two receipts, paid, and the report splits them', async ({
    client,
    assert,
  }) => {
    const { store, carne, coca, attendant, manager } = await counterStore()
    const order = await placeOrder(client, store, carne.id, attendant)

    const added = await client
      .post(`/api/v1/stores/${store.id}/orders/${order.id}/items`)
      .json({
        lines: [{ itemId: coca.id, quantity: 1, notes: 'Bem gelada' }],
        counterMethod: 'pix',
      })
      .loginAs(attendant)

    added.assertStatus(200)
    added.assertBodyContains({
      data: { total: 21, amountPaid: 21, amountDue: 0, paymentStatus: 'paid', status: 'received' },
    })
    const lines = added.body().data.items as {
      name: string
      notes: string | null
      addedAt: string | null
    }[]
    assert.lengthOf(lines, 2)
    assert.isNull(lines[0].addedAt)
    assert.isNotNull(lines[1].addedAt)
    assert.equal(lines[1].notes, 'Bem gelada')

    const receipts = await OrderReceipt.query().where('orderId', order.id).orderBy('id')
    assert.deepEqual(
      receipts.map((receipt) => [receipt.amount, receipt.paymentMethod, receipt.counterMethod]),
      [
        [15, 'counter', 'cash'],
        [6, 'counter', 'pix'],
      ]
    )
    // The order still reads as paid in cash (how it was first paid).
    const saved = await Order.findOrFail(order.id)
    assert.equal(saved.counterMethod, 'cash')
    // The detail lists both, with who received them (name only).
    const detail = await client
      .get(`/api/v1/stores/${store.id}/orders/${order.id}`)
      .loginAs(manager)
    detail.assertBodyContains({
      data: {
        receipts: [
          { amount: 15, counterMethod: 'cash', receivedBy: { id: attendant.id } },
          { amount: 6, counterMethod: 'pix', receivedBy: { id: attendant.id } },
        ],
      },
    })

    const today = DateTime.now().setZone('America/Sao_Paulo').toISODate()!
    const report = await client
      .get(`/api/v1/stores/${store.id}/reports/sales`)
      .qs({ from: today, to: today })
      .loginAs(manager)
    const payments = report.body().data.payments as {
      counterMethod: string | null
      paid: boolean
      revenue: number
    }[]
    assert.equal(payments.find((row) => row.counterMethod === 'cash')!.revenue, 15)
    assert.equal(payments.find((row) => row.counterMethod === 'pix')!.revenue, 6)
    assert.isUndefined(payments.find((row) => !row.paid))
  })

  test('left to receive: delivered only after the rest is received', async ({ client, assert }) => {
    const { store, carne, coca, attendant } = await counterStore()
    const order = await placeOrder(client, store, carne.id, attendant)
    const base = `/api/v1/stores/${store.id}/orders/${order.id}`

    const added = await client
      .post(`${base}/items`)
      .json({ lines: [{ itemId: coca.id, quantity: 2 }] })
      .loginAs(attendant)
    added.assertBodyContains({
      data: { total: 27, amountPaid: 15, amountDue: 12, paymentStatus: 'pending' },
    })

    // Nothing to make: the cook's part is done, then it waits for the rest.
    const cook = await createUser()
    await linkUser(store, cook, StoreRole.KITCHEN)
    const lineId = await firstLineId(order.id)
    await client
      .post(`/api/v1/stores/${store.id}/kitchen/prepare`)
      .json({ units: [{ lineId, quantity: 1 }] })
      .loginAs(cook)
    const refused = await client.post(`${base}/complete`).loginAs(attendant)
    refused.assertStatus(409)
    refused.assertBodyContains({ code: 'E_PAYMENT_REQUIRED' })

    const received = await client
      .post(`${base}/payment`)
      .json({ method: 'debit' })
      .loginAs(attendant)
    received.assertStatus(200)
    const paid = await Order.findOrFail(order.id)
    assert.equal(paid.paymentStatus, 'paid')
    assert.equal(paid.amountPaid, 27)
    const last = await OrderReceipt.query()
      .where('orderId', order.id)
      .orderBy('id', 'desc')
      .firstOrFail()
    assert.deepEqual([last.amount, last.counterMethod], [12, 'debit'])

    const delivered = await client.post(`${base}/complete`).loginAs(attendant)
    delivered.assertStatus(200)
  })

  test('an unpaid counter order just grows; one payment covers all of it', async ({
    client,
    assert,
  }) => {
    const { store, carne, coca, attendant } = await counterStore()
    const order = await placeOrder(client, store, carne.id, attendant, { paid: false })
    const base = `/api/v1/stores/${store.id}/orders/${order.id}`

    await client
      .post(`${base}/items`)
      .json({ lines: [{ itemId: coca.id, quantity: 1 }] })
      .loginAs(attendant)
    await client.post(`${base}/payment`).json({ method: 'cash' }).loginAs(attendant)

    const receipts = await OrderReceipt.query().where('orderId', order.id)
    assert.deepEqual(
      receipts.map((receipt) => receipt.amount),
      [21]
    )
  })

  test('only while nothing was made, and never with a charge waiting on the machine', async ({
    client,
  }) => {
    const { store, carne, coca, attendant, cook } = await counterStore()
    const order = await placeOrder(client, store, carne.id, attendant)
    const base = `/api/v1/stores/${store.id}/orders/${order.id}`
    const lineId = await firstLineId(order.id)

    // The cook made the pastry: too late.
    await client
      .post(`/api/v1/stores/${store.id}/kitchen/prepare`)
      .json({ units: [{ lineId, quantity: 1 }] })
      .loginAs(cook)
    const started = await client
      .post(`${base}/items`)
      .json({ lines: [{ itemId: coca.id, quantity: 1 }] })
      .loginAs(attendant)
    started.assertStatus(409)
    started.assertBodyContains({ code: 'E_ORDER_STARTED' })

    const cancelled = await placeOrder(client, store, carne.id, attendant)
    const manager = await createUser()
    await linkUser(store, manager, StoreRole.MANAGER)
    await client.post(`/api/v1/stores/${store.id}/orders/${cancelled.id}/cancel`).loginAs(manager)
    const afterCancel = await client
      .post(`/api/v1/stores/${store.id}/orders/${cancelled.id}/items`)
      .json({ lines: [{ itemId: coca.id, quantity: 1 }] })
      .loginAs(attendant)
    afterCancel.assertStatus(409)
    afterCancel.assertBodyContains({ code: 'E_ORDER_CANCELLED' })
  })

  test("the kitchen and another store's staff can't add; invalid lines are refused", async ({
    client,
  }) => {
    const { store, carne, coca, attendant, cook } = await counterStore()
    const other = await counterStore()
    const order = await placeOrder(client, store, carne.id, attendant)
    const url = `/api/v1/stores/${store.id}/orders/${order.id}/items`
    const lines = [{ itemId: coca.id, quantity: 1 }]

    const byCook = await client.post(url).json({ lines }).loginAs(cook)
    const byOtherStore = await client.post(url).json({ lines }).loginAs(other.attendant)
    // Another store's order through this store's URL: not found.
    const theirs = await placeOrder(client, other.store, other.carne.id, other.attendant)
    const theirOrder = await client
      .post(`/api/v1/stores/${store.id}/orders/${theirs.id}/items`)
      .json({ lines })
      .loginAs(attendant)
    const theirItem = await client
      .post(url)
      .json({ lines: [{ itemId: other.coca.id, quantity: 1 }] })
      .loginAs(attendant)
    const empty = await client.post(url).json({ lines: [] }).loginAs(attendant)

    byCook.assertStatus(403)
    byOtherStore.assertStatus(403)
    theirOrder.assertStatus(404)
    theirItem.assertStatus(422)
    empty.assertStatus(422)
  })

  test('added items take their stock, and cancelling puts all of it back', async ({
    client,
    assert,
  }) => {
    const { store, carne, attendant, manager } = await counterStore()
    store.inventoryEnabled = true
    await store.save()
    const massa = await Ingredient.create({
      storeId: store.id,
      name: 'Massa',
      unit: 'un',
      stockQuantity: 3,
      minStock: 0,
    })
    await carne.related('ingredients').attach({ [massa.id]: { quantity: 1 } })

    const order = await placeOrder(client, store, carne.id, attendant)
    const url = `/api/v1/stores/${store.id}/orders/${order.id}/items`
    const added = await client
      .post(url)
      .json({ lines: [{ itemId: carne.id, quantity: 1 }], counterMethod: 'cash' })
      .loginAs(attendant)
    added.assertStatus(200)
    await massa.refresh()
    assert.equal(massa.stockQuantity, 1)

    const tooMany = await client
      .post(url)
      .json({ lines: [{ itemId: carne.id, quantity: 2 }] })
      .loginAs(attendant)
    tooMany.assertStatus(422)
    tooMany.assertBodyContains({ code: 'E_OUT_OF_STOCK' })

    await client.post(`/api/v1/stores/${store.id}/orders/${order.id}/cancel`).loginAs(manager)
    await massa.refresh()
    assert.equal(massa.stockQuantity, 3)
  })

  test('paid now, the amount the cashier confirmed must still be what is due', async ({
    client,
    assert,
  }) => {
    const { store, carne, coca, attendant } = await counterStore()
    // Sent to receive later (R$ 15): adding a drink paid in cash takes all that is due.
    const order = await placeOrder(client, store, carne.id, attendant, { paid: false })
    const url = `/api/v1/stores/${store.id}/orders/${order.id}/items`
    const lines = [{ itemId: coca.id, quantity: 1 }]

    const stale = await client
      .post(url)
      .json({ lines, counterMethod: 'cash', amount: 6 })
      .loginAs(attendant)
    stale.assertStatus(409)
    stale.assertBodyContains({ code: 'E_AMOUNT_CHANGED', details: { amountDue: 21 } })
    // Nothing was added.
    const untouched = await Order.query().where('id', order.id).preload('items').firstOrFail()
    assert.lengthOf(untouched.items, 1)
    assert.equal(untouched.total, 15)

    const right = await client
      .post(url)
      .json({ lines, counterMethod: 'cash', amount: 21 })
      .loginAs(attendant)
    right.assertBodyContains({ data: { total: 21, amountPaid: 21, paymentStatus: 'paid' } })
  })

  test('"Receber pagamento" is refused when what is due changed since it was shown', async ({
    client,
    assert,
  }) => {
    const { store, carne, coca, attendant } = await counterStore()
    const order = await placeOrder(client, store, carne.id, attendant, { paid: false })
    const base = `/api/v1/stores/${store.id}/orders/${order.id}`
    // Someone adds a drink while the cashier has R$ 15 on screen.
    await client
      .post(`${base}/items`)
      .json({ lines: [{ itemId: coca.id, quantity: 1 }] })
      .loginAs(attendant)

    const stale = await client
      .post(`${base}/payment`)
      .json({ method: 'cash', amount: 15 })
      .loginAs(attendant)
    stale.assertStatus(409)
    stale.assertBodyContains({ code: 'E_AMOUNT_CHANGED' })
    const receipts = await OrderReceipt.query().where('orderId', order.id)
    assert.lengthOf(receipts, 0)

    const right = await client
      .post(`${base}/payment`)
      .json({ method: 'cash', amount: 21 })
      .loginAs(attendant)
    right.assertStatus(200)
  })

  test('a retry with the same key adds nothing more, even without the replay cache', async ({
    client,
    assert,
  }) => {
    const { store, carne, coca, attendant } = await counterStore()
    const order = await placeOrder(client, store, carne.id, attendant)
    // The service itself (no replay cache in front): the key kept on the lines finds it.
    const { default: OrderService } = await import('#services/order_service')
    const { default: app } = await import('@adonisjs/core/services/app')
    const orders = await app.container.make(OrderService)
    const input = { lines: [{ itemId: coca.id, quantity: 1 }], idempotencyKey: 'add-items-key-1' }
    await orders.addItems(store.id, order.id, input, attendant)
    const retried = await orders.addItems(store.id, order.id, input, attendant)

    assert.lengthOf(retried.items, 2)
    assert.equal(retried.total, 21)
  })

  test('an approval for more than is due goes back; a refunded order never reads as paid again', async ({
    assert,
  }) => {
    const { store, carne } = await counterStore()
    const { default: OrderService } = await import('#services/order_service')
    const { default: Payment } = await import('#models/payment')
    const { default: app } = await import('@adonisjs/core/services/app')
    const orders = await app.container.make(OrderService)
    const order = await orders.create(store.id, {
      customer: { name: 'Maria' },
      lines: [{ itemId: carne.id, quantity: 1 }],
      channel: 'pos',
      paymentMethod: 'counter',
      counterMethod: 'cash',
    } as never)
    // R$ 6 still due after an addition; an older R$ 15 Pix is approved now.
    order.total = 21
    order.paymentStatus = 'pending'
    await order.save()
    const late = await Payment.create({
      orderId: order.id,
      storeId: store.id,
      gateway: 'fake',
      method: 'pix',
      status: 'approved',
      amount: 15,
    } as never)
    await orders.markPaid(order, { payment: late })
    assert.isNull(await OrderReceipt.findBy('paymentId', late.id))
    const kept = await Order.findOrFail(order.id)
    assert.equal(kept.amountPaid, 15)

    // Cancelled and refunded: a late approval leaves it refunded.
    const refunded = await Order.findOrFail(order.id)
    refunded.merge({ status: 'cancelled', paymentStatus: 'refunded', total: 15 })
    await refunded.save()
    await orders.markPaid(refunded, { payment: late })
    const after = await Order.findOrFail(order.id)
    assert.equal(after.paymentStatus, 'refunded')
  })
})
