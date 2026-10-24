import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import type { ApiClient } from '@japa/api-client'
import app from '@adonisjs/core/services/app'
import { createHmac } from 'node:crypto'
import AppException from '#exceptions/app_exception'
import StoreRole from '#enums/store_role'
import Order from '#models/order'
import Payment from '#models/payment'
import Ingredient from '#models/ingredient'
import MercadoPagoClient, {
  type MercadoPagoOrder,
  type MercadoPagoPayment,
  type OrderInput,
} from '#payments/mercado_pago_client'
import { createMenuStore, createUser, linkUser } from '#tests/helpers/fixtures'
import { fakeQueue, runJob } from '#tests/helpers/queue'
import ExpireUnpaidOrder from '#jobs/expire_unpaid_order'
import RefundOrder from '#jobs/refund_order'
import SendOrderReceipt from '#jobs/send_order_receipt'
import mail from '@adonisjs/mail/services/main'
import OrderReceiptNotification from '#mails/order_receipt_notification'
import OrderRefundNotification from '#mails/order_refund_notification'

const TOKEN = 'TEST-1234567890-abcdef'
const PUBLIC_KEY = 'TEST-0b7c6a2e-3d4f-4a1b-9c8d-123456789abc'
const SECRET = 'webhook-secret-123'
const customer = { name: 'Ana', phone: '11987654321' }
const payer = { email: 'ana@example.com' }

/** Mercado Pago double: records requests, answers like the Orders API. */
class FakeMercadoPago extends MercadoPagoClient {
  created: { input: OrderInput; idempotencyKey: string }[] = []
  refunds: string[] = []
  orders = new Map<string, MercadoPagoOrder>()
  /** Attempts made before the Orders API (numeric ids). */
  legacyPayments = new Map<string, MercadoPagoPayment>()
  nextCardStatus: 'processed' | 'failed' = 'processed'
  failing = false

  async createOrder(_token: string, input: OrderInput, idempotencyKey: string) {
    if (this.failing) throw new AppException('down', 502, 'E_PAYMENT_PROVIDER')
    this.created.push({ input, idempotencyKey })
    const id = `ORD${1000 + this.created.length}`
    const method = input.transactions.payments[0].payment_method
    const order: MercadoPagoOrder =
      method.id === 'pix'
        ? {
            id,
            status: 'action_required',
            status_detail: 'waiting_transfer',
            external_reference: input.external_reference,
            transactions: {
              payments: [
                {
                  id: `PAY${id}`,
                  status: 'action_required',
                  status_detail: 'waiting_transfer',
                  payment_method: {
                    id: 'pix',
                    qr_code: `PIX-${id}`,
                    ticket_url: `https://mp/ticket/${id}`,
                  },
                },
              ],
            },
          }
        : {
            id,
            status: this.nextCardStatus,
            status_detail: this.nextCardStatus === 'processed' ? 'accredited' : 'failed',
            external_reference: input.external_reference,
            transactions: {
              payments: [
                {
                  id: `PAY${id}`,
                  status: this.nextCardStatus,
                  status_detail:
                    this.nextCardStatus === 'processed' ? 'accredited' : 'rejected_by_issuer',
                },
              ],
            },
          }
    this.orders.set(id, order)
    return order
  }

  /** What Mercado Pago reports after the customer pays the Pix. */
  approve(id: string) {
    const order = this.orders.get(id)!
    order.status = 'processed'
    order.status_detail = 'accredited'
    order.transactions!.payments![0].status = 'processed'
    order.transactions!.payments![0].status_detail = 'accredited'
  }

  async getOrder(_token: string, orderId: string) {
    return this.orders.get(orderId)!
  }

  async getPayment(_token: string, paymentId: string) {
    return this.legacyPayments.get(paymentId)!
  }

  failRefunds = false

  async refundOrder(_token: string, orderId: string) {
    if (this.failRefunds) throw new AppException('down', 502, 'E_PAYMENT_PROVIDER')
    this.refunds.push(orderId)
  }

  async refundPayment(_token: string, paymentId: string) {
    if (this.failRefunds) throw new AppException('down', 502, 'E_PAYMENT_PROVIDER')
    this.refunds.push(paymentId)
  }
}

function signature(dataId: string, requestId: string, secret = SECRET) {
  const ts = '1700000000'
  const v1 = createHmac('sha256', secret)
    .update(`id:${dataId};request-id:${requestId};ts:${ts};`)
    .digest('hex')
  return `ts=${ts},v1=${v1}`
}

async function onlinePaymentStore(options = { card: true }) {
  const menu = await createMenuStore()
  menu.store.merge({
    mercadoPagoAccessToken: TOKEN,
    mercadoPagoWebhookSecret: SECRET,
    mercadoPagoPublicKey: options.card ? PUBLIC_KEY : null,
  })
  await menu.store.save()
  return menu
}

test.group('Payments (in-app checkout)', (group) => {
  let fake: FakeMercadoPago
  let queue: ReturnType<typeof fakeQueue>
  group.each.setup(() => {
    queue = fakeQueue()
  })
  group.each.setup(() => {
    fake = new FakeMercadoPago()
    app.container.swap(MercadoPagoClient, () => fake)
    return () => app.container.restore(MercadoPagoClient)
  })
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  /** Places an online order and returns its public token. */
  async function placeOrder(
    client: ApiClient,
    slug: string,
    itemId: string,
    paymentMethod = 'pix'
  ) {
    const response = await client
      .post(`/api/v1/public/menu/${slug}/orders`)
      .json({ customer, paymentMethod, lines: [{ itemId, quantity: 1 }] })
    response.assertStatus(200)
    return response.body().data.publicToken as string
  }

  test('credentials are stored encrypted; the public key is public', async ({ client, assert }) => {
    const manager = await createUser()
    const { store } = await createMenuStore()
    await linkUser(store, manager, StoreRole.MANAGER)

    const response = await client
      .put(`/api/v1/stores/${store.id}/payment-settings`)
      .json({
        mercadoPagoAccessToken: TOKEN,
        mercadoPagoWebhookSecret: SECRET,
        mercadoPagoPublicKey: PUBLIC_KEY,
      })
      .loginAs(manager)
    const show = await client.get(`/api/v1/stores/${store.id}`).loginAs(manager)
    const raw = await Order.query().client.from('stores').where('id', store.id).first()

    response.assertBodyContains({
      data: { mercadoPagoEnabled: true, mercadoPagoPublicKey: PUBLIC_KEY },
    })
    assert.notProperty(show.body().data, 'mercadoPagoAccessToken')
    assert.notInclude(raw.mercado_pago_access_token, TOKEN)
  })

  test('the menu offers Pix, card (with a public key) and the counter', async ({
    client,
    assert,
  }) => {
    const withCard = await onlinePaymentStore()
    const pixOnly = await onlinePaymentStore({ card: false })
    const offline = await createMenuStore()

    const methods = async (slug: string) => {
      const response = await client.get(`/api/v1/public/menu/${slug}`)
      return response.body().data.store.paymentMethods
    }

    assert.deepEqual(await methods(withCard.store.slug), ['pix', 'card', 'counter'])
    assert.deepEqual(await methods(pixOnly.store.slug), ['pix', 'counter'])
    assert.deepEqual(await methods(offline.store.slug), ['counter'])

    const refused = await client
      .post(`/api/v1/public/menu/${pixOnly.store.slug}/orders`)
      .json({ customer, paymentMethod: 'card', lines: [{ itemId: pixOnly.carne.id, quantity: 1 }] })
    refused.assertStatus(422)
  })

  test('Pix: the order waits with a QR code; retries reuse it', async ({ client, assert }) => {
    const { store, carne } = await onlinePaymentStore()
    const token = await placeOrder(client, store.slug, carne.id)

    const tracked = await client.get(`/api/v1/public/orders/${token}`)
    tracked.assertBodyContains({
      data: { status: 'pending_payment', payment: null, checkout: { methods: ['pix', 'card'] } },
    })

    const first = await client
      .post(`/api/v1/public/orders/${token}/payments`)
      .header('idempotency-key', 'browser-key-1')
      .json({ method: 'pix', payer })
    const again = await client
      .post(`/api/v1/public/orders/${token}/payments`)
      .header('idempotency-key', 'browser-key-2')
      .json({ method: 'pix', payer })

    first.assertStatus(200)
    assert.equal(first.body().data.payment.pix.qrCode, 'PIX-ORD1001')
    assert.equal(again.body().data.payment.pix.qrCode, 'PIX-ORD1001')
    assert.isNotNull(first.body().data.payment.pix.expiresAt)
    assert.lengthOf(fake.created, 1)
    const sent = fake.created[0]
    assert.deepInclude(sent.input, {
      type: 'online',
      processing_mode: 'automatic',
      total_amount: '15.00',
    })
    assert.deepEqual(sent.input.transactions.payments[0], {
      amount: '15.00',
      expiration_time: 'PT30M',
      payment_method: { id: 'pix', type: 'bank_transfer' },
    })
    assert.equal(sent.input.payer.email, payer.email)
    assert.include(sent.idempotencyKey, 'browser-key-1')
  })

  test('an approved Pix (webhook) sends the order to the kitchen', async ({ client, assert }) => {
    const { store, carne } = await onlinePaymentStore()
    const token = await placeOrder(client, store.slug, carne.id)
    await client.post(`/api/v1/public/orders/${token}/payments`).json({ method: 'pix', payer })
    fake.approve('ORD1001')

    const webhook = await client
      .post(`/api/v1/webhooks/mercado-pago/${store.id}`)
      .header('x-signature', signature('ORD1001', 'req-1'))
      .header('x-request-id', 'req-1')
      .json({ type: 'order', action: 'order.processed', data: { id: 'ORD1001' } })

    webhook.assertStatus(200)
    const order = await Order.findByOrFail('publicToken', token)
    assert.equal(order.status, 'received')
    assert.equal(order.paymentStatus, 'paid')
    const payment = await Payment.findByOrFail('orderId', order.id)
    assert.equal(payment.status, 'approved')
  })

  test('card: approved on the spot; rejected can retry with Pix', async ({ client }) => {
    const { store, carne, queijo } = await onlinePaymentStore()
    const card = { token: 'card-token', installments: 1, paymentMethodId: 'master' }

    const approvedToken = await placeOrder(client, store.slug, carne.id, 'card')
    const approved = await client
      .post(`/api/v1/public/orders/${approvedToken}/payments`)
      .json({ method: 'card', payer, card })
    approved.assertBodyContains({ data: { status: 'received', paymentStatus: 'paid' } })

    fake.nextCardStatus = 'failed'
    const rejectedToken = await placeOrder(client, store.slug, queijo.id, 'card')
    const rejected = await client
      .post(`/api/v1/public/orders/${rejectedToken}/payments`)
      .json({ method: 'card', payer, card })
    rejected.assertBodyContains({
      data: {
        status: 'pending_payment',
        paymentStatus: 'failed',
        payment: { method: 'card', status: 'rejected', statusDetail: 'rejected_by_issuer' },
      },
    })

    const pix = await client
      .post(`/api/v1/public/orders/${rejectedToken}/payments`)
      .json({ method: 'pix', payer })
    pix.assertBodyContains({
      data: { paymentMethod: 'pix', paymentStatus: 'pending', payment: { status: 'pending' } },
    })

    const cardWithoutToken = await client
      .post(`/api/v1/public/orders/${rejectedToken}/payments`)
      .json({ method: 'card', payer })
    cardWithoutToken.assertStatus(422)
  })

  test('forged or foreign notifications change nothing', async ({ client, assert }) => {
    const { store, carne } = await onlinePaymentStore()
    const other = await onlinePaymentStore()
    const token = await placeOrder(client, store.slug, carne.id)
    await client.post(`/api/v1/public/orders/${token}/payments`).json({ method: 'pix', payer })
    fake.approve('ORD1001')

    const forged = await client
      .post(`/api/v1/webhooks/mercado-pago/${store.id}`)
      .header('x-signature', signature('ORD1001', 'req', 'wrong-secret'))
      .header('x-request-id', 'req')
      .json({ type: 'order', action: 'order.processed', data: { id: 'ORD1001' } })
    // Valid signature for the other store, but the payment belongs to this store's order.
    const foreign = await client
      .post(`/api/v1/webhooks/mercado-pago/${other.store.id}`)
      .header('x-signature', signature('ORD1001', 'req'))
      .header('x-request-id', 'req')
      .json({ type: 'order', action: 'order.processed', data: { id: 'ORD1001' } })

    forged.assertStatus(401)
    foreign.assertStatus(200)
    const order = await Order.findByOrFail('publicToken', token)
    assert.equal(order.status, 'pending_payment')
  })

  test('cancelling a paid order refunds it automatically', async ({ client, assert }) => {
    const { store, carne } = await onlinePaymentStore()
    const manager = await createUser()
    await linkUser(store, manager, StoreRole.MANAGER)
    const token = await placeOrder(client, store.slug, carne.id, 'card')
    await client.post(`/api/v1/public/orders/${token}/payments`).json({
      method: 'card',
      payer,
      card: { token: 't', installments: 1, paymentMethodId: 'visa' },
    })
    const order = await Order.findByOrFail('publicToken', token)

    const cancel = await client
      .post(`/api/v1/stores/${store.id}/orders/${order.id}/cancel`)
      .loginAs(manager)

    cancel.assertStatus(200)
    // Refunds run in a job (retried if the gateway is down).
    queue.assertPushed('RefundOrder', { payload: { orderId: order.id } })
    await runJob(RefundOrder, { orderId: order.id })
    assert.deepEqual(fake.refunds, ['ORD1001'])
    await order.refresh()
    assert.equal(order.paymentStatus, 'refunded')
  })

  test('unpaid online orders expire; a Pix in progress postpones it', async ({
    client,
    assert,
  }) => {
    const { store, carne, queijo } = await onlinePaymentStore()
    const unpaid = await placeOrder(client, store.slug, carne.id)
    const withPix = await placeOrder(client, store.slug, queijo.id)
    await client.post(`/api/v1/public/orders/${withPix}/payments`).json({ method: 'pix', payer })
    const unpaidOrder = await Order.findByOrFail('publicToken', unpaid)
    const pixOrder = await Order.findByOrFail('publicToken', withPix)

    queue.assertPushed('ExpireUnpaidOrder', { payload: { orderId: unpaidOrder.id } })
    await runJob(ExpireUnpaidOrder, { orderId: unpaidOrder.id })
    await runJob(ExpireUnpaidOrder, { orderId: pixOrder.id })

    await unpaidOrder.refresh()
    await pixOrder.refresh()
    assert.equal(unpaidOrder.status, 'cancelled')
    assert.equal(pixOrder.status, 'pending_payment')
    // Checked again after the Pix expires.
    assert.equal(
      queue.getPushedJobs().filter((job) => job.job.name === 'ExpireUnpaidOrder').length,
      3
    )
  })

  test('a Pix paid after the order expired is refunded', async ({ client, assert }) => {
    const { store, carne } = await onlinePaymentStore()
    const token = await placeOrder(client, store.slug, carne.id)
    await client.post(`/api/v1/public/orders/${token}/payments`).json({ method: 'pix', payer })
    const order = await Order.findByOrFail('publicToken', token)
    await Payment.query()
      .where('orderId', order.id)
      .update({ expiresAt: new Date(Date.now() - 1000) })
    await runJob(ExpireUnpaidOrder, { orderId: order.id })

    fake.approve('ORD1001')
    await client
      .post(`/api/v1/webhooks/mercado-pago/${store.id}`)
      .header('x-signature', signature('ORD1001', 'req-late'))
      .header('x-request-id', 'req-late')
      .json({ type: 'order', action: 'order.processed', data: { id: 'ORD1001' } })

    await order.refresh()
    assert.equal(order.status, 'cancelled')
    queue.assertPushed('RefundOrder', { payload: { orderId: order.id } })
  })

  test('a gateway failure leaves the order payable', async ({ client, assert }) => {
    const { store, carne } = await onlinePaymentStore()
    const token = await placeOrder(client, store.slug, carne.id)
    fake.failing = true

    const failed = await client
      .post(`/api/v1/public/orders/${token}/payments`)
      .json({ method: 'pix', payer })
    failed.assertStatus(502)

    fake.failing = false
    const retried = await client
      .post(`/api/v1/public/orders/${token}/payments`)
      .json({ method: 'pix', payer })
    retried.assertBodyContains({
      data: { status: 'pending_payment', payment: { status: 'pending' } },
    })
    assert.lengthOf(fake.created, 1)
  })

  test('paid orders and counter orders are not payable here', async ({ client }) => {
    const { store, carne } = await onlinePaymentStore()
    const counter = await placeOrder(client, store.slug, carne.id, 'counter')

    const response = await client
      .post(`/api/v1/public/orders/${counter}/payments`)
      .json({ method: 'pix', payer })
    const simulate = await client.post(`/api/v1/public/orders/${counter}/payments/simulate`)

    response.assertStatus(409)
    simulate.assertStatus(404)
  })
  test('staff see the attempts; a failed refund can be retried by a manager', async ({
    client,
    assert,
  }) => {
    const { store, carne } = await onlinePaymentStore()
    const manager = await createUser()
    const attendant = await createUser()
    await linkUser(store, manager, StoreRole.MANAGER)
    await linkUser(store, attendant, StoreRole.ATTENDANT)
    const token = await placeOrder(client, store.slug, carne.id, 'card')
    fake.nextCardStatus = 'failed'
    await client.post(`/api/v1/public/orders/${token}/payments`).json({
      method: 'card',
      payer,
      card: { token: 't1', installments: 1, paymentMethodId: 'visa' },
    })
    fake.nextCardStatus = 'processed'
    await client.post(`/api/v1/public/orders/${token}/payments`).json({
      method: 'card',
      payer,
      card: { token: 't2', installments: 1, paymentMethodId: 'visa' },
    })
    const order = await Order.findByOrFail('publicToken', token)

    await client.post(`/api/v1/stores/${store.id}/orders/${order.id}/cancel`).loginAs(manager)
    fake.failRefunds = true
    await assert.rejects(() => runJob(RefundOrder, { orderId: order.id }))

    const detail = await client
      .get(`/api/v1/stores/${store.id}/orders/${order.id}`)
      .loginAs(manager)
    detail.assertBodyContains({
      data: {
        refundPending: true,
        payments: [
          { method: 'card', status: 'rejected' },
          { method: 'card', status: 'approved' },
        ],
      },
    })
    assert.notProperty(detail.body().data.payments[0], 'gatewayPaymentId')

    fake.failRefunds = false
    const byAttendant = await client
      .post(`/api/v1/stores/${store.id}/orders/${order.id}/refund`)
      .loginAs(attendant)
    const refunded = await client
      .post(`/api/v1/stores/${store.id}/orders/${order.id}/refund`)
      .loginAs(manager)
    const again = await client
      .post(`/api/v1/stores/${store.id}/orders/${order.id}/refund`)
      .loginAs(manager)

    byAttendant.assertStatus(403)
    refunded.assertBodyContains({ data: { paymentStatus: 'refunded', refundPending: false } })
    again.assertStatus(409)
  })

  test('card installments follow the store limit', async ({ client }) => {
    const { store, carne, queijo } = await onlinePaymentStore()
    const manager = await createUser()
    await linkUser(store, manager, StoreRole.MANAGER)
    const card = { token: 'tk', installments: 3, paymentMethodId: 'master' }

    const first = await placeOrder(client, store.slug, carne.id, 'card')
    const refused = await client
      .post(`/api/v1/public/orders/${first}/payments`)
      .json({ method: 'card', payer, card })

    const settings = await client
      .put(`/api/v1/stores/${store.id}/payment-settings`)
      .json({ maxInstallments: 6 })
      .loginAs(manager)
    const second = await placeOrder(client, store.slug, queijo.id, 'card')
    const tracked = await client.get(`/api/v1/public/orders/${second}`)
    const accepted = await client
      .post(`/api/v1/public/orders/${second}/payments`)
      .json({ method: 'card', payer, card })

    refused.assertStatus(422)
    settings.assertBodyContains({ data: { maxInstallments: 6 } })
    tracked.assertBodyContains({ data: { checkout: { maxInstallments: 6 } } })
    accepted.assertBodyContains({ data: { paymentStatus: 'paid' } })
  })

  test('an approved payment e-mails one receipt to the payer', async ({ client, assert }) => {
    const mails = mail.fake()
    const { store, carne } = await onlinePaymentStore()
    const token = await placeOrder(client, store.slug, carne.id)
    await client
      .post(`/api/v1/public/orders/${token}/payments`)
      .json({ method: 'pix', payer: { email: ' Ana@Example.com ' } })
    fake.approve('ORD1001')

    // Mercado Pago repeats notifications.
    for (const requestId of ['req-1', 'req-2']) {
      await client
        .post(`/api/v1/webhooks/mercado-pago/${store.id}`)
        .header('x-signature', signature('ORD1001', requestId))
        .header('x-request-id', requestId)
        .json({ type: 'order', action: 'order.processed', data: { id: 'ORD1001' } })
    }

    const payment = await Payment.findByOrFail('gatewayPaymentId', 'ORD1001')
    assert.equal(payment.payerEmail, 'ana@example.com')
    queue.assertPushed('SendOrderReceipt', { payload: { paymentId: payment.id } })
    // Even if the job runs twice (retry, duplicate), one receipt goes out.
    await runJob(SendOrderReceipt, { paymentId: payment.id })
    await runJob(SendOrderReceipt, { paymentId: payment.id })

    mails.mails.assertSentCount(OrderReceiptNotification, 1)
    const order = await Order.findByOrFail('publicToken', token)
    mails.mails.assertSent(OrderReceiptNotification, (sent) => {
      sent.message.assertTo('ana@example.com')
      sent.message.assertSubject(`Pagamento confirmado · Pedido #${order.number} · ${store.name}`)
      sent.message.assertHtmlIncludes(`/pedido/${token}`)
      return true
    })
    await payment.refresh()
    assert.isNotNull(payment.receiptSentAt)
    mail.restore()
  })

  test('a refunded order e-mails the payer', async ({ client }) => {
    const mails = mail.fake()
    const { store, carne } = await onlinePaymentStore()
    const manager = await createUser()
    await linkUser(store, manager, StoreRole.MANAGER)
    const token = await placeOrder(client, store.slug, carne.id, 'card')
    await client.post(`/api/v1/public/orders/${token}/payments`).json({
      method: 'card',
      payer,
      card: { token: 't', installments: 1, paymentMethodId: 'visa' },
    })
    const order = await Order.findByOrFail('publicToken', token)
    await client.post(`/api/v1/stores/${store.id}/orders/${order.id}/cancel`).loginAs(manager)

    await runJob(RefundOrder, { orderId: order.id })

    mails.mails.assertQueued(OrderRefundNotification, (queued) => {
      queued.message.assertTo(payer.email)
      queued.message.assertSubject(`Reembolso do pedido #${order.number} · ${store.name}`)
      return true
    })
    mail.restore()
  })

  test('payment is refused (nothing charged) when the stock ran out after ordering', async ({
    client,
    assert,
  }) => {
    const { store, carne } = await onlinePaymentStore()
    store.inventoryEnabled = true
    await store.save()
    const ovo = await Ingredient.create({
      storeId: store.id,
      name: 'Ovo',
      unit: 'un',
      stockQuantity: 1,
      minStock: 0,
    })
    await carne.related('ingredients').attach({ [ovo.id]: { quantity: 1 } })
    const manager = await createUser()
    await linkUser(store, manager, StoreRole.MANAGER)

    // Online order waits for its Pix (stock is taken only once paid)…
    const token = await placeOrder(client, store.slug, carne.id)
    // …meanwhile the counter sells the last egg.
    const pos = await client
      .post(`/api/v1/stores/${store.id}/orders`)
      .json({ customer: { name: 'Balcão' }, lines: [{ itemId: carne.id, quantity: 1 }] })
      .loginAs(manager)
    pos.assertStatus(200)

    const pay = await client
      .post(`/api/v1/public/orders/${token}/payments`)
      .json({ method: 'pix', payer })

    pay.assertStatus(422)
    pay.assertBodyContains({ code: 'E_OUT_OF_STOCK' })
    assert.lengthOf(fake.created, 0, 'nothing charged')
  })

  test('card: debit or credit and the payer document go on the Mercado Pago order', async ({
    client,
    assert,
  }) => {
    const { store, carne } = await onlinePaymentStore()
    const token = await placeOrder(client, store.slug, carne.id, 'card')
    await client.post(`/api/v1/public/orders/${token}/payments`).json({
      method: 'card',
      payer,
      card: {
        token: 'tk',
        installments: 1,
        paymentMethodId: 'debelo',
        paymentTypeId: 'debit_card',
        identification: { type: 'CPF', number: '12345678909' },
      },
    })

    const sent = fake.created[0].input
    assert.deepInclude(sent.transactions.payments[0].payment_method, {
      id: 'debelo',
      type: 'debit_card',
      token: 'tk',
      installments: 1,
    })
    assert.deepEqual(sent.payer.identification, { type: 'CPF', number: '12345678909' })
    const order = await Order.findByOrFail('publicToken', token)
    assert.equal(sent.external_reference, order.id)
  })

  test('an attempt from before the Orders API still settles and refunds there', async ({
    client,
    assert,
  }) => {
    const { store, carne } = await onlinePaymentStore()
    const manager = await createUser()
    await linkUser(store, manager, StoreRole.MANAGER)
    const token = await placeOrder(client, store.slug, carne.id)
    const order = await Order.findByOrFail('publicToken', token)
    // A Pix created on the Payments API (numeric id) before the switch.
    await Payment.create({
      orderId: order.id,
      storeId: store.id,
      gateway: 'mercado_pago',
      method: 'pix',
      gatewayPaymentId: '987',
      status: 'pending',
      amount: order.total,
      payerEmail: payer.email,
    })
    fake.legacyPayments.set('987', {
      id: 987,
      status: 'approved',
      status_detail: 'accredited',
      external_reference: order.id,
    })

    const webhook = await client
      .post(`/api/v1/webhooks/mercado-pago/${store.id}`)
      .header('x-signature', signature('987', 'req-legacy'))
      .header('x-request-id', 'req-legacy')
      .json({ type: 'payment', data: { id: '987' } })
    webhook.assertStatus(200)
    await order.refresh()
    assert.equal(order.paymentStatus, 'paid')

    await client.post(`/api/v1/stores/${store.id}/orders/${order.id}/cancel`).loginAs(manager)
    await runJob(RefundOrder, { orderId: order.id })
    assert.deepEqual(fake.refunds, ['987'])
  })
})
