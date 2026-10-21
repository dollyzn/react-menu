import { randomUUID } from 'node:crypto'
import { test } from '@japa/runner'
import app from '@adonisjs/core/services/app'
import testUtils from '@adonisjs/core/services/test_utils'
import OrderChannel from '#enums/order_channel'
import PaymentMethod from '#enums/payment_method'
import StoreRole from '#enums/store_role'
import Order from '#models/order'
import OrderItem from '#models/order_item'
import OrderService from '#services/order_service'
import { createMenuStore, createUser, linkUser } from '#tests/helpers/fixtures'

const customer = { name: 'Ana Souza', phone: '(11) 98765-4321' }

/**
 * Clients at the beach lose responses and retry. A retry with the same
 * Idempotency-Key must never run the operation twice.
 */
test.group('Idempotency', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('a retried public order returns the same order', async ({ client, assert }) => {
    const { store, carne } = await createMenuStore()
    const key = randomUUID()
    const body = { customer, paymentMethod: 'counter', lines: [{ itemId: carne.id, quantity: 2 }] }
    const place = () =>
      client
        .post(`/api/v1/public/menu/${store.slug}/orders`)
        .header('Idempotency-Key', key)
        .json(body)

    const first = await place()
    const retry = await place()

    first.assertStatus(200)
    retry.assertStatus(200)
    assert.equal(retry.header('idempotent-replayed'), 'true')
    assert.equal(retry.body().data.publicToken, first.body().data.publicToken)
    assert.lengthOf(await Order.query().where('storeId', store.id), 1)
  })

  test('the same key with different data is rejected', async ({ client }) => {
    const { store, carne } = await createMenuStore()
    const key = randomUUID()
    const place = (quantity: number) =>
      client
        .post(`/api/v1/public/menu/${store.slug}/orders`)
        .header('Idempotency-Key', key)
        .json({ customer, paymentMethod: 'counter', lines: [{ itemId: carne.id, quantity }] })

    const first = await place(1)
    first.assertStatus(200)
    const misuse = await place(3)
    misuse.assertStatus(422)
    misuse.assertBodyContains({ code: 'E_IDEMPOTENCY_KEY_REUSED' })
  })

  test('without a key every request is a new order', async ({ client, assert }) => {
    const { store, carne } = await createMenuStore()
    const body = { customer, paymentMethod: 'counter', lines: [{ itemId: carne.id, quantity: 1 }] }
    await client.post(`/api/v1/public/menu/${store.slug}/orders`).json(body)
    await client.post(`/api/v1/public/menu/${store.slug}/orders`).json(body)
    assert.lengthOf(await Order.query().where('storeId', store.id), 2)
  })

  test('the database key alone prevents duplicates (Redis lost, process restarted)', async ({
    assert,
  }) => {
    const { store, carne } = await createMenuStore()
    const orders = await app.container.make(OrderService)
    const input = {
      channel: OrderChannel.POS,
      paymentMethod: PaymentMethod.COUNTER,
      customer: { name: 'Balcão' },
      lines: [{ itemId: carne.id, quantity: 1 }],
      idempotencyKey: randomUUID(),
    }

    const first = await orders.create(store.id, input)
    const again = await orders.create(store.id, input)

    assert.equal(again.id, first.id)
    assert.lengthOf(await Order.query().where('storeId', store.id), 1)
  })

  test('a retried kitchen mark counts once', async ({ client, assert }) => {
    const cook = await createUser()
    const { store, carne } = await createMenuStore()
    await linkUser(store, cook, StoreRole.KITCHEN)
    await client.post(`/api/v1/public/menu/${store.slug}/orders`).json({
      customer,
      paymentMethod: 'counter',
      lines: [{ itemId: carne.id, quantity: 3 }],
    })
    const line = await OrderItem.query()
      .whereHas('order', (q) => q.where('storeId', store.id))
      .firstOrFail()
    const key = randomUUID()
    const mark = () =>
      client
        .post(`/api/v1/stores/${store.id}/kitchen/prepare`)
        .header('Idempotency-Key', key)
        .json({ units: [{ lineId: line.id, quantity: 1 }] })
        .loginAs(cook)

    const first = await mark()
    const retry = await mark()
    first.assertStatus(200)
    retry.assertStatus(200)

    await line.refresh()
    assert.equal(line.preparedQuantity, 1)
  })

  test('delivering or cancelling twice is a success, not a conflict', async ({ client }) => {
    const attendant = await createUser()
    const cook = await createUser()
    const { store, carne } = await createMenuStore()
    await linkUser(store, attendant, StoreRole.ATTENDANT)
    await linkUser(store, cook, StoreRole.KITCHEN)
    const create = () =>
      client
        .post(`/api/v1/stores/${store.id}/orders`)
        .json({ customer: { name: 'Balcão' }, lines: [{ itemId: carne.id, quantity: 1 }] })
        .loginAs(attendant)
    const deliveredResponse = await create()
    const cancelledResponse = await create()
    const delivered = deliveredResponse.body().data.id
    const cancelled = cancelledResponse.body().data.id
    const line = await OrderItem.query().where('orderId', delivered).firstOrFail()
    await client
      .post(`/api/v1/stores/${store.id}/kitchen/prepare`)
      .json({ units: [{ lineId: line.id, quantity: 1 }] })
      .loginAs(cook)

    for (let i = 0; i < 2; i++) {
      const complete = await client
        .post(`/api/v1/stores/${store.id}/orders/${delivered}/complete`)
        .loginAs(attendant)
      complete.assertStatus(200)
      const cancel = await client
        .post(`/api/v1/stores/${store.id}/orders/${cancelled}/cancel`)
        .loginAs(attendant)
      cancel.assertStatus(200)
    }
  })

  test("a key never replays another caller's response", async ({ client, assert }) => {
    const first = await createUser()
    const second = await createUser()
    const { store, carne } = await createMenuStore()
    await linkUser(store, first, StoreRole.ATTENDANT)
    await linkUser(store, second, StoreRole.ATTENDANT)
    const key = randomUUID()
    const create = (user: typeof first) =>
      client
        .post(`/api/v1/stores/${store.id}/orders`)
        .header('Idempotency-Key', key)
        .json({ customer: { name: 'Balcão' }, lines: [{ itemId: carne.id, quantity: 1 }] })
        .loginAs(user)

    const a = await create(first)
    const b = await create(second)

    assert.notEqual(b.header('idempotent-replayed'), 'true')
    // The database key is per store, so the second caller still gets one order, not two.
    assert.equal(b.body().data.id, a.body().data.id)
  })

  test('a malformed key is a 400', async ({ client }) => {
    const { store, carne } = await createMenuStore()
    const response = await client
      .post(`/api/v1/public/menu/${store.slug}/orders`)
      .header('Idempotency-Key', 'x')
      .json({ customer, paymentMethod: 'counter', lines: [{ itemId: carne.id, quantity: 1 }] })
    response.assertStatus(400)
    response.assertBodyContains({ code: 'E_IDEMPOTENCY_KEY_INVALID' })
  })
})
