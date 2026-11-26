import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import WhatsAppMessageService from '#services/whatsapp_message_service'
import StoreRole from '#enums/store_role'
import SendWhatsAppMessage from '#jobs/send_whatsapp_message'
import Order from '#models/order'
import OrderItem from '#models/order_item'
import WhatsAppMessage from '#models/whatsapp_message'
import { WhatsAppApiError } from '#whatsapp/client'
import { TEMPLATES } from '#whatsapp/templates'
import { createMenuStore, createStaff, linkUser } from '#tests/helpers/fixtures'
import { emptyDatabase } from '#tests/helpers/database'
import { failJob, fakeQueue, runJob } from '#tests/helpers/queue'
import { connectStore, useFakeGraph, VERIFY_TOKEN, webhookBody } from '#tests/helpers/fake_whatsapp'

const customer = { name: 'Ana Souza', phone: '(11) 98765-4321' }

/**
 * Order notices by WhatsApp (ADR 0025): only for online customers who asked
 * at checkout, once per state, through the store's number.
 */
test.group('WhatsApp order notices', (group) => {
  group.each.setup(() => emptyDatabase)
  const meta = useFakeGraph(group)

  async function setup() {
    const { store, carne } = await createMenuStore()
    const account = await connectStore(store)
    const cook = await createStaff()
    await linkUser(store, cook, StoreRole.KITCHEN)
    const cashier = await createStaff()
    await linkUser(store, cashier, StoreRole.ATTENDANT)
    return { store, carne, account, cook, cashier }
  }

  async function sendQueued() {
    const queued = await WhatsAppMessage.query().where('status', 'queued')
    for (const message of queued) await runJob(SendWhatsAppMessage, { messageId: message.id })
  }

  test('received and ready, once each, with the order link', async ({ client, assert }) => {
    fakeQueue()
    const { store, carne, cook } = await setup()

    const placed = await client.post(`/api/v1/public/menu/${store.slug}/orders`).json({
      customer,
      paymentMethod: 'counter',
      lines: [{ itemId: carne.id, quantity: 1 }],
      whatsappOptIn: true,
    })
    placed.assertStatus(200)
    const order = await Order.findByOrFail('publicToken', placed.body().data.publicToken)
    assert.isTrue(order.whatsappOptIn)

    await sendQueued()
    assert.lengthOf(meta.graph.sent, 1)
    const [received] = meta.graph.sent
    assert.equal(received.to, '5511987654321')
    const template = received.body.template as {
      name: string
      language: { code: string }
      components: { type: string; parameters: { parameter_name?: string; text: string }[] }[]
    }
    assert.equal(template.name, TEMPLATES.ORDER_RECEIVED)
    assert.equal(template.language.code, 'pt_BR')
    // Named parameters: any order (jsonb keeps its own).
    assert.sameDeepMembers(template.components[0].parameters, [
      { type: 'text', parameter_name: 'cliente', text: 'Ana' },
      { type: 'text', parameter_name: 'numero', text: String(order.number) },
      { type: 'text', parameter_name: 'loja', text: store.name },
    ] as never)
    assert.deepEqual(template.components[1].parameters, [
      { type: 'text', text: order.publicToken },
    ] as never)

    // The kitchen finishes it: "ready" is told.
    const line = await OrderItem.findByOrFail('orderId', order.id)
    const made = await client
      .post(`/api/v1/stores/${store.id}/kitchen/prepare`)
      .json({ units: [{ lineId: line.id, quantity: 1 }] })
      .loginAs(cook)
    made.assertStatus(200)
    await sendQueued()
    assert.lengthOf(meta.graph.sent, 2)
    assert.equal((meta.graph.sent[1].body.template as { name: string }).name, TEMPLATES.ORDER_READY)

    // Nothing is sent twice, whatever runs again.
    const rows = await WhatsAppMessage.query().where('orderId', order.id)
    for (const row of rows) await runJob(SendWhatsAppMessage, { messageId: row.id })
    assert.lengthOf(meta.graph.sent, 2)
  })

  test('nothing without the opt-in, at the POS, or with the template not approved', async ({
    client,
    assert,
  }) => {
    fakeQueue()
    const { store, carne, cashier, account } = await setup()

    await client.post(`/api/v1/public/menu/${store.slug}/orders`).json({
      customer,
      paymentMethod: 'counter',
      lines: [{ itemId: carne.id, quantity: 1 }],
    })
    await client
      .post(`/api/v1/stores/${store.id}/orders`)
      .json({ customer, lines: [{ itemId: carne.id, quantity: 1 }], counterMethod: 'cash' })
      .loginAs(cashier)
    assert.lengthOf(await WhatsAppMessage.all(), 0)

    account.templates = {
      ...account.templates,
      [TEMPLATES.ORDER_RECEIVED]: { id: null, status: 'PENDING', category: null, reason: null },
    }
    await account.save()
    await client.post(`/api/v1/public/menu/${store.slug}/orders`).json({
      customer,
      paymentMethod: 'counter',
      lines: [{ itemId: carne.id, quantity: 1 }],
      whatsappOptIn: true,
    })
    assert.lengthOf(await WhatsAppMessage.all(), 0)

    // The store turned notices off: the checkout no longer offers them.
    account.notifyOrders = false
    await account.save()
    const menu = await client.get(`/api/v1/public/menu/${store.slug}`)
    assert.deepEqual(menu.body().data.store.whatsapp, {
      notifications: false,
      login: { message: true, code: true },
    })
  })

  test('"cancelado" only after "recebido": an unpaid order left to expire is not told', async ({
    client,
    assert,
  }) => {
    fakeQueue()
    const { store, carne } = await setup()
    const { default: OrderService } = await import('#services/order_service')
    const orders = await app.container.make(OrderService)
    const place = async () => {
      const placed = await client.post(`/api/v1/public/menu/${store.slug}/orders`).json({
        customer,
        paymentMethod: 'counter',
        lines: [{ itemId: carne.id, quantity: 1 }],
        whatsappOptIn: true,
      })
      return await Order.findByOrFail('publicToken', placed.body().data.publicToken)
    }

    // A Pix never paid: still pending_payment, never told it was received
    // (the tests have no gateway, so it is set as such), cancelled without a word.
    const unpaid = await place()
    await WhatsAppMessage.query().where('orderId', unpaid.id).delete()
    await Order.query().where('id', unpaid.id).update({ status: 'pending_payment' })
    await orders.cancel(store.id, unpaid.id)
    assert.lengthOf(await WhatsAppMessage.query().where('orderId', unpaid.id), 0)

    // Received and told: cancelling it is told too.
    const received = await place()
    await sendQueued()
    await orders.cancel(store.id, received.id)
    const rows = await WhatsAppMessage.query().where('orderId', received.id)
    const kinds = rows.map((row) => row.kind)
    assert.sameMembers(kinds, ['order_received', 'order_cancelled'])
  })

  test('a notice whose dispatch failed goes out on the next change; a job that gives up says so', async ({
    assert,
  }) => {
    const queue = fakeQueue()
    const { store } = await setup()
    // A row whose dispatch was lost (Redis down when it was queued).
    const lost = await WhatsAppMessage.create({
      storeId: store.id,
      kind: 'order_received',
      dedupKey: 'order:lost:received',
      to: '5511987654321',
      content: { type: 'template', name: TEMPLATES.ORDER_RECEIVED, params: {} },
      status: 'queued',
    })
    const service = await app.container.make(WhatsAppMessageService)
    const again = await service.queue({
      storeId: store.id,
      kind: 'order_received',
      dedupKey: 'order:lost:received',
      to: '5511987654321',
      content: lost.content,
    })
    assert.equal(again?.id, lost.id)
    queue.assertPushed('SendWhatsAppMessage', { payload: { messageId: lost.id } })

    await failJob(SendWhatsAppMessage, { messageId: lost.id }, new Error('Meta did not answer'))
    await lost.refresh()
    assert.equal(lost.status, 'failed')
    assert.equal(lost.errorTitle, 'Meta did not answer')
  })

  test('a payment problem is recorded and shown; the status webhook moves the message forward', async ({
    client,
    assert,
  }) => {
    fakeQueue()
    const { store, carne, account } = await setup()
    const order = async () =>
      await client.post(`/api/v1/public/menu/${store.slug}/orders`).json({
        customer,
        paymentMethod: 'counter',
        lines: [{ itemId: carne.id, quantity: 1 }],
        whatsappOptIn: true,
      })

    await order()
    meta.graph.failNextSend = new WhatsAppApiError('Payment issue', 400, 131042)
    await sendQueued()
    const failed = await WhatsAppMessage.firstOrFail()
    assert.equal(failed.status, 'failed')
    assert.equal(failed.errorCode, 131042)
    await account.refresh()
    assert.isNotNull(account.paymentIssueAt)

    // Meta not answering: the job throws so the queue retries it.
    await order()
    meta.graph.failNextSend = new WhatsAppApiError('Meta did not answer', 0, null)
    const queued = await WhatsAppMessage.query().where('status', 'queued').firstOrFail()
    await assert.rejects(() => runJob(SendWhatsAppMessage, { messageId: queued.id }))
    await runJob(SendWhatsAppMessage, { messageId: queued.id })
    await queued.refresh()
    assert.equal(queued.status, 'sent')

    // Delivered, then a late "sent": it stays delivered, and payment is fine again.
    const status = (value: string) =>
      webhookBody(account.phoneNumberId, {
        statuses: [
          {
            id: queued.wamid,
            status: value,
            timestamp: '1749416383',
            recipient_id: '5511987654321',
          },
        ],
      })
    for (const value of ['delivered', 'sent']) {
      const { payload, signature } = status(value)
      const response = await client
        .post('/api/v1/webhooks/whatsapp')
        .header('x-hub-signature-256', signature)
        .json(payload)
      response.assertStatus(200)
    }
    await queued.refresh()
    assert.equal(queued.status, 'delivered')
    await account.refresh()
    assert.isNull(account.paymentIssueAt)
  })
})

test.group('WhatsApp webhook', (group) => {
  group.each.setup(() => emptyDatabase)
  useFakeGraph(group)

  test("Meta's verification of our callback", async ({ client, assert }) => {
    const ok = await client.get('/api/v1/webhooks/whatsapp').qs({
      'hub.mode': 'subscribe',
      'hub.verify_token': VERIFY_TOKEN,
      'hub.challenge': '1158201444',
    })
    ok.assertStatus(200)
    assert.equal(ok.text(), '1158201444')

    const wrong = await client
      .get('/api/v1/webhooks/whatsapp')
      .qs({ 'hub.mode': 'subscribe', 'hub.verify_token': 'nope', 'hub.challenge': '1' })
    wrong.assertStatus(403)
  })

  test("a body without a valid signature is refused; another product's number is ignored", async ({
    client,
  }) => {
    const { payload, signature } = webhookBody('999', { statuses: [] })
    const unsigned = await client.post('/api/v1/webhooks/whatsapp').json(payload)
    unsigned.assertStatus(401)
    const forged = await client
      .post('/api/v1/webhooks/whatsapp')
      .header('x-hub-signature-256', `sha256=${'0'.repeat(64)}`)
      .json(payload)
    forged.assertStatus(401)

    // Signed, but for a number no store here connected (Chatwoot's): 200, nothing done.
    const other = await client
      .post('/api/v1/webhooks/whatsapp')
      .header('x-hub-signature-256', signature)
      .json(payload)
    other.assertStatus(200)
  })
})
