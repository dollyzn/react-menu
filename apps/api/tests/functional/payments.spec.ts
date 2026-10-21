import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import type { ApiClient } from '@japa/api-client'
import app from '@adonisjs/core/services/app'
import { createHmac } from 'node:crypto'
import AppException from '#exceptions/app_exception'
import StoreRole from '#enums/store_role'
import Order from '#models/order'
import Payment from '#models/payment'
import MercadoPagoClient, {
  type MercadoPagoPayment,
  type PaymentInput,
} from '#payments/mercado_pago_client'
import { createMenuStore, createUser, linkUser } from '#tests/helpers/fixtures'

const TOKEN = 'TEST-1234567890-abcdef'
const PUBLIC_KEY = 'TEST-0b7c6a2e-3d4f-4a1b-9c8d-123456789abc'
const SECRET = 'webhook-secret-123'
const customer = { name: 'Ana', phone: '11987654321' }
const payer = { email: 'ana@example.com' }

/** Mercado Pago double: records requests, answers like the Payments API. */
class FakeMercadoPago extends MercadoPagoClient {
  created: { input: PaymentInput; idempotencyKey: string }[] = []
  refunds: string[] = []
  payments = new Map<string, MercadoPagoPayment>()
  nextCardStatus: MercadoPagoPayment['status'] = 'approved'
  failing = false

  async createPayment(_token: string, input: PaymentInput, idempotencyKey: string) {
    if (this.failing) throw new AppException('down', 502, 'E_PAYMENT_PROVIDER')
    this.created.push({ input, idempotencyKey })
    const id = 1000 + this.created.length
    const payment: MercadoPagoPayment =
      input.payment_method_id === 'pix'
        ? {
            id,
            status: 'pending',
            status_detail: 'pending_waiting_transfer',
            external_reference: input.external_reference,
            date_of_expiration: input.date_of_expiration,
            point_of_interaction: {
              transaction_data: { qr_code: `PIX-${id}`, ticket_url: `https://mp/ticket/${id}` },
            },
          }
        : {
            id,
            status: this.nextCardStatus,
            status_detail:
              this.nextCardStatus === 'approved' ? 'accredited' : 'cc_rejected_other_reason',
            external_reference: input.external_reference,
          }
    this.payments.set(String(id), payment)
    return payment
  }

  async getPayment(_token: string, paymentId: string) {
    return this.payments.get(paymentId)!
  }

  async refundPayment(_token: string, paymentId: string) {
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
  group.each.setup(() => {
    fake = new FakeMercadoPago()
    app.container.swap(MercadoPagoClient, () => fake)
    return () => app.container.restore(MercadoPagoClient)
  })
  group.each.setup(() => testUtils.db().withGlobalTransaction())

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
    assert.equal(first.body().data.payment.pix.qrCode, 'PIX-1001')
    assert.equal(again.body().data.payment.pix.qrCode, 'PIX-1001')
    assert.lengthOf(fake.created, 1)
    const sent = fake.created[0]
    assert.equal(sent.input.payment_method_id, 'pix')
    assert.equal(sent.input.transaction_amount, 15)
    assert.equal(sent.input.payer.email, payer.email)
    assert.match(sent.input.date_of_expiration!, /T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/)
    assert.include(sent.idempotencyKey, 'browser-key-1')
  })

  test('an approved Pix (webhook) sends the order to the kitchen', async ({ client, assert }) => {
    const { store, carne } = await onlinePaymentStore()
    const token = await placeOrder(client, store.slug, carne.id)
    await client.post(`/api/v1/public/orders/${token}/payments`).json({ method: 'pix', payer })
    fake.payments.get('1001')!.status = 'approved'

    const webhook = await client
      .post(`/api/v1/webhooks/mercado-pago/${store.id}`)
      .header('x-signature', signature('1001', 'req-1'))
      .header('x-request-id', 'req-1')
      .json({ type: 'payment', data: { id: '1001' } })

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

    fake.nextCardStatus = 'rejected'
    const rejectedToken = await placeOrder(client, store.slug, queijo.id, 'card')
    const rejected = await client
      .post(`/api/v1/public/orders/${rejectedToken}/payments`)
      .json({ method: 'card', payer, card })
    rejected.assertBodyContains({
      data: {
        status: 'pending_payment',
        paymentStatus: 'failed',
        payment: { method: 'card', status: 'rejected', statusDetail: 'cc_rejected_other_reason' },
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
    fake.payments.get('1001')!.status = 'approved'

    const forged = await client
      .post(`/api/v1/webhooks/mercado-pago/${store.id}`)
      .header('x-signature', signature('1001', 'req', 'wrong-secret'))
      .header('x-request-id', 'req')
      .json({ type: 'payment', data: { id: '1001' } })
    // Valid signature for the other store, but the payment belongs to this store's order.
    const foreign = await client
      .post(`/api/v1/webhooks/mercado-pago/${other.store.id}`)
      .header('x-signature', signature('1001', 'req'))
      .header('x-request-id', 'req')
      .json({ type: 'payment', data: { id: '1001' } })

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
    assert.deepEqual(fake.refunds, ['1001'])
    await order.refresh()
    assert.equal(order.paymentStatus, 'refunded')
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
})
