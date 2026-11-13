import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import type { BatchResponse } from 'firebase-admin/messaging'
import StoreRole from '#enums/store_role'
import NotifyOrderReady from '#jobs/notify_order_ready'
import Order from '#models/order'
import OrderItem from '#models/order_item'
import FcmClient from '#notifications/fcm_client'
import { createMenuStore, createUser, linkUser } from '#tests/helpers/fixtures'
import { fakeQueue, runJob } from '#tests/helpers/queue'

/** FCM double: records sends; `configured: false` is a server without Firebase. */
class FakeFcm extends FcmClient {
  sent: { fids: string[]; data: Record<string, string> }[] = []
  configured = true

  get isConfigured() {
    return this.configured
  }

  async send(fids: string[], data: Record<string, string>) {
    this.sent.push({ fids, data })
    const responses = fids.map((id) => ({ success: true, messageId: `m-${id}` }))
    return { responses, successCount: fids.length, failureCount: 0 } as unknown as BatchResponse
  }
}

const FID = 'fid_customer_phone_123'

test.group('"Avise quando ficar pronto" (customer push)', (group) => {
  let fcm: FakeFcm
  group.each.setup(() => {
    fcm = new FakeFcm()
    app.container.swap(FcmClient, () => fcm)
    return () => app.container.restore(FcmClient)
  })
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  async function setup() {
    const { store, carne } = await createMenuStore()
    const cashier = await createUser()
    const cook = await createUser()
    await linkUser(store, cashier, StoreRole.ATTENDANT)
    await linkUser(store, cook, StoreRole.KITCHEN)
    return { store, carne, cashier, cook }
  }

  test('the customer is told once when the order is ready, and forgotten when it is delivered', async ({
    client,
    assert,
  }) => {
    const queue = fakeQueue()
    const { store, carne, cashier, cook } = await setup()
    const sent = await client
      .post(`/api/v1/stores/${store.id}/orders`)
      .json({
        customer: { name: 'Ana' },
        lines: [{ itemId: carne.id, quantity: 1 }],
        counterMethod: 'cash',
      })
      .loginAs(cashier)
    const order = await Order.findOrFail(sent.body().data.id)
    const url = `/api/v1/public/orders/${order.publicToken}/push`

    const subscribed = await client.post(url).json({ fid: FID })
    subscribed.assertStatus(200)
    // Again (the page asked twice): still one subscription.
    await client.post(url).json({ fid: FID })
    const rows = await db.from('order_push_subscriptions').where('order_id', order.id)
    assert.lengthOf(rows, 1)

    // The kitchen finishes it: the notice is queued and sent once.
    const line = await OrderItem.findByOrFail('orderId', order.id)
    await client
      .post(`/api/v1/stores/${store.id}/kitchen/prepare`)
      .json({ units: [{ lineId: line.id, quantity: 1 }] })
      .loginAs(cook)
    queue.assertPushed('NotifyOrderReady', { payload: { orderId: order.id } })

    await runJob(NotifyOrderReady, { orderId: order.id })
    await runJob(NotifyOrderReady, { orderId: order.id })
    assert.lengthOf(fcm.sent, 1)
    assert.deepEqual(fcm.sent[0].fids, [FID])
    assert.equal(fcm.sent[0].data.title, `Pedido #${order.number} pronto!`)
    assert.equal(fcm.sent[0].data.url, `/pedido/${order.publicToken}`)

    // Delivered: nothing more to tell this browser.
    await client.post(`/api/v1/stores/${store.id}/orders/${order.id}/complete`).loginAs(cashier)
    const left = await db.from('order_push_subscriptions').where('order_id', order.id)
    assert.lengthOf(left, 0)
    const over = await client.post(url).json({ fid: FID })
    over.assertStatus(409)
    over.assertBodyContains({ code: 'E_ORDER_OVER' })
  })

  test('without subscriptions nothing is queued; unsubscribing works; bad input is refused', async ({
    client,
    assert,
  }) => {
    const queue = fakeQueue()
    const { store, carne, cashier, cook } = await setup()
    const sent = await client
      .post(`/api/v1/stores/${store.id}/orders`)
      .json({
        customer: { name: 'Bia' },
        lines: [{ itemId: carne.id, quantity: 1 }],
        counterMethod: 'pix',
      })
      .loginAs(cashier)
    const order = await Order.findOrFail(sent.body().data.id)
    const url = `/api/v1/public/orders/${order.publicToken}/push`

    const tooShort = await client.post(url).json({ fid: 'x' })
    tooShort.assertStatus(422)
    const unknown = await client
      .post('/api/v1/public/orders/00000000-0000-4000-8000-000000000000/push')
      .json({ fid: FID })
    unknown.assertStatus(404)

    await client.post(url).json({ fid: FID })
    const off = await client.delete(url).json({ fid: FID })
    off.assertStatus(200)
    assert.lengthOf(await db.from('order_push_subscriptions').where('order_id', order.id), 0)

    const line = await OrderItem.findByOrFail('orderId', order.id)
    await client
      .post(`/api/v1/stores/${store.id}/kitchen/prepare`)
      .json({ units: [{ lineId: line.id, quantity: 1 }] })
      .loginAs(cook)
    queue.assertNotPushed('NotifyOrderReady')

    // A server without Firebase says so instead of pretending.
    fcm.configured = false
    const disabled = await client.post(url).json({ fid: FID })
    disabled.assertStatus(503)
    disabled.assertBodyContains({ code: 'E_PUSH_DISABLED' })
  })
})
