import { randomUUID } from 'node:crypto'
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { createMenuStore } from '#tests/helpers/fixtures'

const customer = { name: 'Ana Souza', phone: '(11) 98765-4321' }

/**
 * Customers have no account. Their order history follows a token handed to
 * the device of their first order; knowing a phone number is never enough.
 */
test.group('Customer order history', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('the first order links the device; the phone alone does not', async ({ client, assert }) => {
    const { store, carne } = await createMenuStore()
    const body = { customer, paymentMethod: 'counter', lines: [{ itemId: carne.id, quantity: 1 }] }
    const place = (token?: string) => {
      const request = client.post(`/api/v1/public/menu/${store.slug}/orders`).json(body)
      return token ? request.header('Customer-Token', token) : request
    }

    const first = await place()
    const token = first.body().data.customerToken as string
    assert.match(token, /^ct_/)

    // Another device with the same phone: an order, but no access to history.
    const stranger = await place()
    assert.isNull(stranger.body().data.customerToken)

    // The linked device keeps its token.
    const again = await place(token)
    assert.equal(again.body().data.customerToken, token)

    const history = await client
      .get(`/api/v1/public/menu/${store.slug}/my-orders`)
      .header('Customer-Token', token)
    history.assertStatus(200)
    assert.equal(history.body().data.customer.name, 'Ana Souza')
    assert.equal(history.body().data.customer.phone, '(11) •••••-4321')
    assert.lengthOf(history.body().data.orders, 3)
    assert.deepEqual(history.body().data.orders[0].items, [
      { name: 'Pastel de Carne', quantity: 1 },
    ])
  })

  test('history needs a valid token of that store', async ({ client }) => {
    const { store, carne } = await createMenuStore()
    const other = await createMenuStore()
    const placed = await client.post(`/api/v1/public/menu/${store.slug}/orders`).json({
      customer,
      paymentMethod: 'counter',
      lines: [{ itemId: carne.id, quantity: 1 }],
    })
    const token = placed.body().data.customerToken as string

    const missing = await client.get(`/api/v1/public/menu/${store.slug}/my-orders`)
    missing.assertStatus(401)
    const wrong = await client
      .get(`/api/v1/public/menu/${store.slug}/my-orders`)
      .header('Customer-Token', 'ct_not-a-real-token')
    wrong.assertStatus(401)
    const otherStore = await client
      .get(`/api/v1/public/menu/${other.store.slug}/my-orders`)
      .header('Customer-Token', token)
    otherStore.assertStatus(401)
  })

  test('a device refreshes its own orders by public token', async ({ client, assert }) => {
    const { store, carne } = await createMenuStore()
    const placed = await client.post(`/api/v1/public/menu/${store.slug}/orders`).json({
      customer,
      paymentMethod: 'counter',
      lines: [{ itemId: carne.id, quantity: 2 }],
    })
    const publicToken = placed.body().data.publicToken as string

    const response = await client
      .get('/api/v1/public/orders')
      .qs({ tokens: `${publicToken},${randomUUID()},not-a-token` })

    response.assertStatus(200)
    assert.lengthOf(response.body().data, 1)
    assert.equal(response.body().data[0].publicToken, publicToken)
    assert.equal(response.body().data[0].status, 'received')
    assert.equal(response.body().data[0].store.slug, store.slug)
  })

  test('tracking shows when each step happened', async ({ client, assert }) => {
    const { store, carne } = await createMenuStore()
    const placed = await client.post(`/api/v1/public/menu/${store.slug}/orders`).json({
      customer,
      paymentMethod: 'counter',
      lines: [{ itemId: carne.id, quantity: 1 }],
    })
    const tracking = await client.get(`/api/v1/public/orders/${placed.body().data.publicToken}`)

    const timeline = tracking.body().data.timeline as { status: string; at: string }[]
    assert.deepEqual(
      timeline.map((step) => step.status),
      ['pending_payment', 'received']
    )
    assert.equal(tracking.body().data.items[0].itemId, carne.id)
  })
})
