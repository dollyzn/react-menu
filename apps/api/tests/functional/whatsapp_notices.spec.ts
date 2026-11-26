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
    const { store, carne, coca } = await createMenuStore()
    const account = await connectStore(store)
    const cook = await createStaff()
    await linkUser(store, cook, StoreRole.KITCHEN)
    const cashier = await createStaff()
    await linkUser(store, cashier, StoreRole.ATTENDANT)
    return { store, carne, coca, account, cook, cashier }
  }

  async function sendQueued() {
    const queued = await WhatsAppMessage.query().where('status', 'queued')
    for (const message of queued) await runJob(SendWhatsAppMessage, { messageId: message.id })
  }

  test('every step of the order, once each: the order on "recebido", the link on "em preparo", "pronto" without one', async ({
    client,
    assert,
  }) => {
    fakeQueue()
    const { store, carne, coca, cook, cashier, account } = await setup()
    const placed = await client.post(`/api/v1/public/menu/${store.slug}/orders`).json({
      customer,
      paymentMethod: 'counter',
      lines: [
        { itemId: carne.id, quantity: 2 },
        { itemId: coca.id, quantity: 1 },
      ],
      whatsappOptIn: true,
    })
    placed.assertStatus(200)
    const order = await Order.findByOrFail('publicToken', placed.body().data.publicToken)
    assert.isTrue(order.whatsappOptIn)
    // The pickup time is the database's default: not on the fixture's model.
    await store.refresh()

    type Sent = {
      name: string
      language: { code: string }
      components: { type: string; parameters: { parameter_name?: string; text: string }[] }[]
    }
    const sent = (index: number) => meta.graph.sent[index].body.template as Sent

    await sendQueued()
    assert.lengthOf(meta.graph.sent, 1)
    assert.equal(meta.graph.sent[0].to, '5511987654321')
    const received = sent(0)
    assert.equal(received.name, TEMPLATES.ORDER_RECEIVED)
    assert.equal(received.language.code, 'pt_BR')
    // Named parameters: any order (jsonb keeps its own). No button: the order is in the text.
    assert.sameDeepMembers(received.components[0].parameters, [
      { type: 'text', parameter_name: 'cliente', text: 'Ana' },
      { type: 'text', parameter_name: 'numero', text: String(order.number) },
      { type: 'text', parameter_name: 'loja', text: store.name },
      { type: 'text', parameter_name: 'itens', text: '2x Pastel de Carne, 1x Coca-Cola' },
      { type: 'text', parameter_name: 'pagamento', text: 'Pagamento na retirada' },
      { type: 'text', parameter_name: 'total', text: 'R$ 36,00' },
      {
        type: 'text',
        parameter_name: 'previsao',
        text: `fica pronto em cerca de ${store.pickupEtaMinutes} minutos`,
      },
    ] as never)
    assert.lengthOf(received.components, 1)

    // The kitchen makes one of the two pastries: "em preparo", with the link.
    const line = await OrderItem.query()
      .where({ orderId: order.id, itemId: carne.id })
      .firstOrFail()
    const prepare = () =>
      client
        .post(`/api/v1/stores/${store.id}/kitchen/prepare`)
        .json({ units: [{ lineId: line.id, quantity: 1 }] })
        .loginAs(cook)
    const first = await prepare()
    first.assertStatus(200)
    await sendQueued()
    const preparing = sent(1)
    assert.equal(preparing.name, TEMPLATES.ORDER_PREPARING)
    assert.deepEqual(preparing.components[0].parameters, [
      { type: 'text', parameter_name: 'numero', text: String(order.number) },
    ] as never)
    assert.deepEqual(preparing.components[1].parameters, [
      { type: 'text', text: order.publicToken },
    ] as never)

    // The second one: "pronto", no link.
    const second = await prepare()
    second.assertStatus(200)
    await sendQueued()
    const ready = sent(2)
    assert.equal(ready.name, TEMPLATES.ORDER_READY)
    assert.lengthOf(ready.components, 1)

    // "Retirado" is off until the store turns it on.
    const manager = await createStaff()
    await linkUser(store, manager, StoreRole.MANAGER)
    const toggled = await client
      .put(`/api/v1/stores/${store.id}/whatsapp/settings`)
      .json({ notices: { completed: true, preparing: false } })
      .loginAs(manager)
    toggled.assertStatus(200)
    const notices = toggled.body().data.account.notices as { kind: string; enabled: boolean }[]
    assert.deepEqual(Object.fromEntries(notices.map((notice) => [notice.kind, notice.enabled])), {
      received: true,
      preparing: false,
      ready: true,
      completed: true,
      cancelled: true,
    })
    await account.refresh()
    // Only what differs from the defaults is kept.
    assert.deepEqual(account.notices, { completed: true, preparing: false })

    // Paid at the counter, then handed over.
    const paid = await client
      .post(`/api/v1/stores/${store.id}/orders/${order.id}/payment`)
      .json({ method: 'cash' })
      .loginAs(cashier)
    paid.assertStatus(200)
    const delivered = await client
      .post(`/api/v1/stores/${store.id}/orders/${order.id}/complete`)
      .loginAs(cashier)
    delivered.assertStatus(200)
    await sendQueued()
    assert.equal(sent(3).name, TEMPLATES.ORDER_COMPLETED)

    // Nothing is sent twice, whatever runs again.
    const rows = await WhatsAppMessage.query().where('orderId', order.id)
    assert.lengthOf(rows, 4)
    for (const row of rows) await runJob(SendWhatsAppMessage, { messageId: row.id })
    assert.lengthOf(meta.graph.sent, 4)
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

  test('a status before our send saved its wamid: 500 so Meta delivers it again; old unknown ids are ignored', async ({
    client,
  }) => {
    const { store } = await createMenuStore()
    const account = await connectStore(store)
    const status = (timestamp: number) =>
      webhookBody(account.phoneNumberId, {
        statuses: [{ id: 'wamid.NOT_SAVED_YET', status: 'failed', timestamp: String(timestamp) }],
      })
    const now = Math.floor(Date.now() / 1000)
    const early = status(now)
    const retried = await client
      .post('/api/v1/webhooks/whatsapp')
      .header('x-hub-signature-256', early.signature)
      .json(early.payload)
    retried.assertStatus(500)
    const old = status(now - 3600)
    const ignored = await client
      .post('/api/v1/webhooks/whatsapp')
      .header('x-hub-signature-256', old.signature)
      .json(old.payload)
    ignored.assertStatus(200)
  })

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
