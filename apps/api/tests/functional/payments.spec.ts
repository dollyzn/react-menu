import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'
import { createHmac } from 'node:crypto'
import AppException from '#exceptions/app_exception'
import StoreRole from '#enums/store_role'
import Order from '#models/order'
import MercadoPagoClient, {
  type MercadoPagoPayment,
  type PreferenceInput,
} from '#payments/mercado_pago_client'
import { createMenuStore, createUser, linkUser } from '#tests/helpers/fixtures'

const TOKEN = 'TEST-1234567890-abcdef'
const SECRET = 'webhook-secret-123'
const customer = { name: 'Ana', phone: '11987654321' }

class FakeMercadoPago extends MercadoPagoClient {
  preferences: PreferenceInput[] = []
  payments = new Map<string, MercadoPagoPayment>()
  failing = false

  async createPreference(_token: string, input: PreferenceInput) {
    if (this.failing) throw new AppException('down', 502, 'E_PAYMENT_PROVIDER')
    this.preferences.push(input)
    return { id: `pref-${this.preferences.length}` }
  }

  async getPayment(_token: string, paymentId: string) {
    return this.payments.get(paymentId)!
  }
}

function signature(dataId: string, requestId: string, secret = SECRET) {
  const ts = '1700000000'
  const v1 = createHmac('sha256', secret)
    .update(`id:${dataId};request-id:${requestId};ts:${ts};`)
    .digest('hex')
  return `ts=${ts},v1=${v1}`
}

async function onlinePaymentStore() {
  const menu = await createMenuStore()
  menu.store.merge({ mercadoPagoAccessToken: TOKEN, mercadoPagoWebhookSecret: SECRET })
  await menu.store.save()
  return menu
}

test.group('Mercado Pago', (group) => {
  let fake: FakeMercadoPago
  group.each.setup(() => {
    fake = new FakeMercadoPago()
    app.container.swap(MercadoPagoClient, () => fake)
    return () => app.container.restore(MercadoPagoClient)
  })
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('credentials are stored encrypted and never exposed', async ({ client, assert }) => {
    const manager = await createUser()
    const { store } = await createMenuStore()
    await linkUser(store, manager, StoreRole.MANAGER)

    const response = await client
      .put(`/api/v1/stores/${store.id}/payment-settings`)
      .json({ mercadoPagoAccessToken: TOKEN, mercadoPagoWebhookSecret: SECRET })
      .loginAs(manager)
    const show = await client.get(`/api/v1/stores/${store.id}`).loginAs(manager)
    const raw = await Order.query().client.from('stores').where('id', store.id).first()

    response.assertBodyContains({ data: { mercadoPagoEnabled: true } })
    assert.notProperty(show.body().data, 'mercadoPagoAccessToken')
    assert.notInclude(raw.mercado_pago_access_token, TOKEN)
  })

  test('online orders wait for payment and get a sandbox checkout', async ({ client, assert }) => {
    const { store, carne, catupiry } = await onlinePaymentStore()

    const response = await client.post(`/api/v1/public/menu/${store.slug}/orders`).json({
      customer,
      paymentMethod: 'mercado_pago',
      lines: [{ itemId: carne.id, quantity: 2, addonIds: [catupiry.id] }],
    })

    response.assertStatus(200)
    const order = response.body().data
    assert.equal(order.status, 'pending_payment')
    assert.equal(
      order.checkoutUrl,
      'https://sandbox.mercadopago.com.br/checkout/v1/redirect?pref_id=pref-1'
    )
    assert.deepEqual(fake.preferences[0].items, [
      { title: 'Pastel de Carne + Catupiry', quantity: 2, unitPrice: 18 },
    ])
  })

  test('an approved payment sends the order to the kitchen', async ({ client, assert }) => {
    const { store, carne } = await onlinePaymentStore()
    const placed = await client.post(`/api/v1/public/menu/${store.slug}/orders`).json({
      customer,
      paymentMethod: 'mercado_pago',
      lines: [{ itemId: carne.id, quantity: 1 }],
    })
    const order = await Order.findByOrFail('publicToken', placed.body().data.publicToken)
    fake.payments.set('999', { id: 999, status: 'approved', external_reference: order.id })

    const webhook = await client
      .post(`/api/v1/webhooks/mercado-pago/${store.id}`)
      .header('x-signature', signature('999', 'req-1'))
      .header('x-request-id', 'req-1')
      .json({ type: 'payment', data: { id: '999' } })

    webhook.assertStatus(200)
    await order.refresh()
    assert.equal(order.status, 'received')
    assert.equal(order.paymentStatus, 'paid')
  })

  test('forged or foreign notifications change nothing', async ({ client, assert }) => {
    const { store, carne } = await onlinePaymentStore()
    const other = await onlinePaymentStore()
    const placed = await client.post(`/api/v1/public/menu/${store.slug}/orders`).json({
      customer,
      paymentMethod: 'mercado_pago',
      lines: [{ itemId: carne.id, quantity: 1 }],
    })
    const order = await Order.findByOrFail('publicToken', placed.body().data.publicToken)
    fake.payments.set('1', { id: 1, status: 'approved', external_reference: order.id })

    const forged = await client
      .post(`/api/v1/webhooks/mercado-pago/${store.id}`)
      .header('x-signature', signature('1', 'req', 'wrong-secret'))
      .header('x-request-id', 'req')
      .json({ type: 'payment', data: { id: '1' } })
    // Valid signature for the other store, but the payment belongs to this store's order.
    const foreign = await client
      .post(`/api/v1/webhooks/mercado-pago/${other.store.id}`)
      .header('x-signature', signature('1', 'req'))
      .header('x-request-id', 'req')
      .json({ type: 'payment', data: { id: '1' } })

    forged.assertStatus(401)
    foreign.assertStatus(200)
    await order.refresh()
    assert.equal(order.status, 'pending_payment')
  })

  test('if Mercado Pago is down the order is cancelled, not left pending', async ({
    client,
    assert,
  }) => {
    const { store, carne } = await onlinePaymentStore()
    fake.failing = true

    const response = await client.post(`/api/v1/public/menu/${store.slug}/orders`).json({
      customer,
      paymentMethod: 'mercado_pago',
      lines: [{ itemId: carne.id, quantity: 1 }],
    })

    response.assertStatus(502)
    const order = await Order.query().where('storeId', store.id).firstOrFail()
    assert.equal(order.status, 'cancelled')
  })
})
