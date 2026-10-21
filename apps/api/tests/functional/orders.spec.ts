import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import StoreRole from '#enums/store_role'
import Customer from '#models/customer'
import Notification from '#models/notification'
import Order from '#models/order'
import { createMenuStore, createUser, linkUser } from '#tests/helpers/fixtures'

const customer = { name: 'Ana Souza', phone: '(11) 98765-4321' }

test.group('Public menu', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('serves a store menu by slug without private fields', async ({ client, assert }) => {
    const { store, carne } = await createMenuStore()
    carne.isAvailable = false
    await carne.save()

    const response = await client.get(`/api/v1/public/menu/${store.slug}`)

    response.assertStatus(200)
    const body = response.body().data
    assert.equal(body.store.slug, store.slug)
    assert.isTrue(body.store.isOpen)
    assert.notProperty(body.store, 'mercadoPagoAccessToken')
    assert.deepEqual(
      body.categories.map((c: { name: string }) => c.name),
      ['Pastéis', 'Bebidas']
    )
    assert.isFalse(body.categories[0].items[0].isAvailable)
    assert.equal(body.categories[0].items[0].addons[0].name, 'Catupiry')
  })

  test('unknown slug is a 404', async ({ client }) => {
    const response = await client.get('/api/v1/public/menu/nao-existe')
    response.assertStatus(404)
  })
})

test.group('Placing orders', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('prices come from the menu, not from the client', async ({ client, assert }) => {
    const { store, carne, catupiry, coca } = await createMenuStore()

    const response = await client.post(`/api/v1/public/menu/${store.slug}/orders`).json({
      customer,
      paymentMethod: 'counter',
      lines: [
        { itemId: carne.id, quantity: 2, addonIds: [catupiry.id], price: 0.01 },
        { itemId: coca.id, quantity: 1 },
      ],
      total: 0.01,
    })

    response.assertStatus(200)
    const order = response.body().data
    // (15 + 3) × 2 + 6
    assert.equal(order.total, 42)
    assert.equal(order.number, 1)
    assert.equal(order.status, 'received')
    assert.notProperty(order, 'customerPhone')

    const customerRow = await Customer.findByOrFail('phone', '5511987654321')
    assert.equal(customerRow.name, 'Ana Souza')
  })

  test('numbers orders sequentially per store and day', async ({ client, assert }) => {
    const { store, queijo } = await createMenuStore()
    const place = () =>
      client.post(`/api/v1/public/menu/${store.slug}/orders`).json({
        customer,
        paymentMethod: 'counter',
        lines: [{ itemId: queijo.id, quantity: 1 }],
      })

    const first = await place()
    const second = await place()

    assert.equal(first.body().data.number, 1)
    assert.equal(second.body().data.number, 2)
  })

  test('rejects closed stores, unavailable items, foreign add-ons and bad phones', async ({
    client,
  }) => {
    const { store, carne, queijo, catupiry } = await createMenuStore()
    const url = `/api/v1/public/menu/${store.slug}/orders`

    const foreignAddon = await client.post(url).json({
      customer,
      paymentMethod: 'counter',
      lines: [{ itemId: queijo.id, quantity: 1, addonIds: [catupiry.id] }],
    })
    const badPhone = await client.post(url).json({
      customer: { name: 'Ana', phone: '12345678' },
      paymentMethod: 'counter',
      lines: [{ itemId: carne.id, quantity: 1 }],
    })

    carne.isAvailable = false
    await carne.save()
    const unavailable = await client.post(url).json({
      customer,
      paymentMethod: 'counter',
      lines: [{ itemId: carne.id, quantity: 1 }],
    })

    store.status = 'closed'
    await store.save()
    const closed = await client.post(url).json({
      customer,
      paymentMethod: 'counter',
      lines: [{ itemId: queijo.id, quantity: 1 }],
    })

    foreignAddon.assertStatus(422)
    badPhone.assertStatus(422)
    unavailable.assertStatus(422)
    unavailable.assertBodyContains({ code: 'E_UNAVAILABLE' })
    closed.assertStatus(409)
    closed.assertBodyContains({ code: 'E_STORE_CLOSED' })
  })

  test('drink-only orders are ready at once', async ({ client }) => {
    const { store, coca } = await createMenuStore()

    const response = await client.post(`/api/v1/public/menu/${store.slug}/orders`).json({
      customer,
      paymentMethod: 'counter',
      lines: [{ itemId: coca.id, quantity: 2 }],
    })

    response.assertBodyContains({ data: { status: 'ready' } })
  })

  test('customers track orders by token; staff are notified', async ({ client, assert }) => {
    const manager = await createUser()
    const { store, queijo } = await createMenuStore([manager])

    const placed = await client.post(`/api/v1/public/menu/${store.slug}/orders`).json({
      customer,
      paymentMethod: 'counter',
      lines: [{ itemId: queijo.id, quantity: 1 }],
    })
    const tracking = await client.get(`/api/v1/public/orders/${placed.body().data.publicToken}`)

    tracking.assertStatus(200)
    tracking.assertBodyContains({ data: { number: 1, store: { name: store.name } } })
    const notifications = await Notification.query().where('userId', manager.id)
    assert.lengthOf(notifications, 1)
    assert.equal(notifications[0].title, 'Novo pedido #1')
  })
})

test.group('Kitchen and pickup', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  async function placeAll(client: ApiClient, slug: string, itemIds: string[]) {
    const tokens = []
    for (const itemId of itemIds) {
      const response = await client.post(`/api/v1/public/menu/${slug}/orders`).json({
        customer,
        paymentMethod: 'counter',
        lines: [{ itemId, quantity: 1 }],
      })
      tokens.push(response.body().data.publicToken as string)
    }
    return tokens
  }

  test('the queue batches identical pastries from nearby orders', async ({ client, assert }) => {
    const cook = await createUser()
    const { store, carne, queijo } = await createMenuStore()
    await linkUser(store, cook, StoreRole.KITCHEN)
    await placeAll(client, store.slug, [carne.id, queijo.id, carne.id])

    const response = await client.get(`/api/v1/stores/${store.id}/kitchen/queue`).loginAs(cook)

    response.assertStatus(200)
    const batches = response.body().data
    assert.deepEqual(
      batches.map((b: { quantity: number; name: string }) => `${b.quantity}x ${b.name}`),
      ['2x Pastel de Carne', '1x Pastel de Queijo']
    )
  })

  test('managers can turn batching off so the kitchen follows arrival order', async ({
    client,
    assert,
  }) => {
    const manager = await createUser()
    const cook = await createUser()
    const { store, carne, queijo } = await createMenuStore()
    await linkUser(store, manager, StoreRole.MANAGER)
    await linkUser(store, cook, StoreRole.KITCHEN)
    await placeAll(client, store.slug, [carne.id, queijo.id, carne.id])

    const settings = (lookahead: number) => ({ slug: store.slug, kitchenBatchLookahead: lookahead })
    const denied = await client.put(`/api/v1/stores/${store.id}`).json(settings(0)).loginAs(cook)
    denied.assertStatus(403)
    const invalid = await client
      .put(`/api/v1/stores/${store.id}`)
      .json(settings(9))
      .loginAs(manager)
    invalid.assertStatus(422)

    const updated = await client
      .put(`/api/v1/stores/${store.id}`)
      .json(settings(0))
      .loginAs(manager)
    updated.assertStatus(200)
    updated.assertBodyContains({ data: { kitchenBatchLookahead: 0 } })

    const response = await client.get(`/api/v1/stores/${store.id}/kitchen/queue`).loginAs(cook)
    assert.deepEqual(
      response
        .body()
        .data.map((b: { quantity: number; name: string }) => `${b.quantity}x ${b.name}`),
      ['1x Pastel de Carne', '1x Pastel de Queijo', '1x Pastel de Carne']
    )
  })

  test('undoing a finished batch puts the order back in the kitchen queue', async ({
    client,
    assert,
  }) => {
    const cook = await createUser()
    const { store, carne } = await createMenuStore()
    await linkUser(store, cook, StoreRole.KITCHEN)
    await placeAll(client, store.slug, [carne.id])
    const queue = () => client.get(`/api/v1/stores/${store.id}/kitchen/queue`).loginAs(cook)
    const before = await queue()
    const lineId = before.body().data[0].units[0].lineId as number
    const prepare = (quantity: number) =>
      client
        .post(`/api/v1/stores/${store.id}/kitchen/prepare`)
        .json({ units: [{ lineId, quantity }] })
        .loginAs(cook)

    await prepare(1)
    const done = await queue()
    assert.lengthOf(done.body().data, 0)

    const undo = await prepare(-1)
    undo.assertStatus(200)
    const after = await queue()
    assert.lengthOf(after.body().data, 1)
    assert.equal(after.body().data[0].name, 'Pastel de Carne')
  })

  test('marking units moves orders to preparing, ready and completed', async ({
    client,
    assert,
  }) => {
    const cook = await createUser()
    const attendant = await createUser()
    const { store, carne } = await createMenuStore()
    await linkUser(store, cook, StoreRole.KITCHEN)
    await linkUser(store, attendant, StoreRole.ATTENDANT)

    const placed = await client.post(`/api/v1/public/menu/${store.slug}/orders`).json({
      customer,
      paymentMethod: 'counter',
      lines: [{ itemId: carne.id, quantity: 2 }],
    })
    const order = await Order.findByOrFail('publicToken', placed.body().data.publicToken)
    await order.load('items')
    const lineId = order.items[0].id
    const prepare = (quantity: number) =>
      client
        .post(`/api/v1/stores/${store.id}/kitchen/prepare`)
        .json({ units: [{ lineId, quantity }] })
        .loginAs(cook)

    await prepare(1)
    await order.refresh()
    assert.equal(order.status, 'preparing')

    await prepare(1)
    await order.refresh()
    assert.equal(order.status, 'ready')

    const byCook = await client
      .post(`/api/v1/stores/${store.id}/orders/${order.id}/complete`)
      .loginAs(cook)
    const byAttendant = await client
      .post(`/api/v1/stores/${store.id}/orders/${order.id}/complete`)
      .loginAs(attendant)

    byCook.assertStatus(403)
    byAttendant.assertStatus(200)
    await order.refresh()
    assert.equal(order.status, 'completed')
    assert.equal(order.paymentStatus, 'paid')
  })

  test('kitchen cannot touch lines of another store', async ({ client }) => {
    const cook = await createUser()
    const { store } = await createMenuStore()
    await linkUser(store, cook, StoreRole.KITCHEN)
    const other = await createMenuStore()
    await placeAll(client, other.store.slug, [other.carne.id])
    const foreign = await Order.query()
      .where('storeId', other.store.id)
      .preload('items')
      .firstOrFail()

    const response = await client
      .post(`/api/v1/stores/${store.id}/kitchen/prepare`)
      .json({ units: [{ lineId: foreign.items[0].id, quantity: 1 }] })
      .loginAs(cook)

    response.assertStatus(404)
  })

  test('POS orders are created by front of house only', async ({ client, assert }) => {
    const attendant = await createUser()
    const cook = await createUser()
    const { store, queijo } = await createMenuStore()
    await linkUser(store, attendant, StoreRole.ATTENDANT)
    await linkUser(store, cook, StoreRole.KITCHEN)
    const payload = { customer: { name: 'Balcão' }, lines: [{ itemId: queijo.id, quantity: 3 }] }

    const byAttendant = await client
      .post(`/api/v1/stores/${store.id}/orders`)
      .json(payload)
      .loginAs(attendant)
    const byCook = await client
      .post(`/api/v1/stores/${store.id}/orders`)
      .json(payload)
      .loginAs(cook)

    byAttendant.assertStatus(200)
    byCook.assertStatus(403)
    const order = byAttendant.body().data
    assert.equal(order.channel, 'pos')
    assert.equal(order.total, 42)
    assert.equal(order.createdById, attendant.id)
  })
})

test.group('Menu views', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('customer visits are counted per hour, staff previews are not', async ({
    client,
    assert,
  }) => {
    const { store } = await createMenuStore()
    const manager = await createUser()
    await linkUser(store, manager, StoreRole.MANAGER)
    const phone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148'

    await client.get(`/api/v1/public/menu/${store.slug}`)
    await client.get(`/api/v1/public/menu/${store.slug}`)
    await client.get(`/api/v1/public/menu/${store.slug}`).header('user-agent', phone)
    await client.get(`/api/v1/public/menu/${store.slug}?preview=1`)

    // One row per hour and platform, however many visits.
    const rows = await db.from('store_view_counts').where('store_id', store.id)
    assert.lengthOf(rows, 2)
    assert.sameMembers(
      rows.map((row) => `${row.platform}:${row.count}`),
      ['desktop:2', 'mobile:1']
    )

    const overview = await client
      .get(`/api/v1/stores/${store.id}/dashboard/overview`)
      .loginAs(manager)
    const chart = await client.get(`/api/v1/stores/${store.id}/dashboard/chart`).loginAs(manager)
    assert.equal(overview.body().data.accesses.total, 3)
    const today = chart.body().data.at(-1)
    assert.deepInclude(today, { desktop: 2, mobile: 1 })
  })
})
