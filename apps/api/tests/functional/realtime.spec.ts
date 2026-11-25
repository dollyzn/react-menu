import { test } from '@japa/runner'
import { randomUUID } from 'node:crypto'
import transmit from '@adonisjs/transmit/services/main'
import StoreStatus from '#enums/store_status'
import { createStore, createUser } from '#tests/helpers/fixtures'
import { openStream } from '#tests/helpers/transmit'
import { emptyDatabase } from '#tests/helpers/database'

test.group('Realtime (Transmit)', (group) => {
  group.each.setup(() => emptyDatabase)

  test('guests cannot subscribe to private channels', async ({ client, cleanup }) => {
    const store = await createStore()
    const user = await createUser()

    const storeChannel = await client
      .post('/__transmit/subscribe')
      .json({ uid: openStream(cleanup), channel: `stores/${store.id}` })
    const userChannel = await client
      .post('/__transmit/subscribe')
      .json({ uid: openStream(cleanup), channel: `users/${user.id}/notifications` })

    storeChannel.assertStatus(400)
    userChannel.assertStatus(400)
  })

  test('guests can track an order with its public token', async ({ client, cleanup }) => {
    const response = await client
      .post('/__transmit/subscribe')
      .json({ uid: openStream(cleanup), channel: `orders/${randomUUID()}` })

    response.assertStatus(204)
  })

  test('only store members can subscribe to the store channel', async ({ client, cleanup }) => {
    const member = await createUser()
    const outsider = await createUser()
    const store = await createStore([member])
    const channel = `stores/${store.id}`

    const allowed = await client
      .post('/__transmit/subscribe')
      .json({ uid: openStream(cleanup), channel })
      .loginAs(member)
    const denied = await client
      .post('/__transmit/subscribe')
      .json({ uid: openStream(cleanup), channel })
      .loginAs(outsider)
    const invalid = await client
      .post('/__transmit/subscribe')
      .json({ uid: openStream(cleanup), channel: 'stores/not-a-uuid' })
      .loginAs(member)

    allowed.assertStatus(204)
    denied.assertStatus(400)
    invalid.assertStatus(400)
  })

  test('status change is persisted and broadcast once', async ({ client, assert, cleanup }) => {
    const member = await createUser()
    const store = await createStore([member])
    const broadcasts: unknown[] = []
    cleanup(transmit.on('broadcast', ({ payload }) => broadcasts.push(payload)))

    const changed = await client
      .patch(`/api/v1/stores/${store.id}/status`)
      .json({ status: StoreStatus.OPEN })
      .loginAs(member)
    const unchanged = await client
      .patch(`/api/v1/stores/${store.id}/status`)
      .json({ status: StoreStatus.OPEN })
      .loginAs(member)

    changed.assertStatus(200)
    unchanged.assertStatus(200)
    await store.refresh()
    assert.equal(store.status, StoreStatus.OPEN)
    assert.deepEqual(broadcasts, [
      { type: 'store.status_changed', storeId: store.id, status: StoreStatus.OPEN },
    ])
  })

  test('a stock count is told to the store, so open menus read availability again', async ({
    client,
    assert,
    cleanup,
  }) => {
    const { default: StoreRole } = await import('#enums/store_role')
    const { default: Ingredient } = await import('#models/ingredient')
    const { linkUser } = await import('#tests/helpers/fixtures')
    const manager = await createUser()
    const store = await createStore()
    await linkUser(store, manager, StoreRole.MANAGER)
    const coca = await Ingredient.create({
      storeId: store.id,
      name: 'Coca lata',
      unit: 'un',
      stockQuantity: 5,
      minStock: 0,
    })
    const broadcasts: unknown[] = []
    cleanup(transmit.on('broadcast', ({ payload }) => broadcasts.push(payload)))

    const counted = await client
      .post(`/api/v1/stores/${store.id}/ingredients/${coca.id}/movements`)
      .json({ type: 'adjustment', quantity: 0 })
      .loginAs(manager)

    counted.assertStatus(200)
    assert.deepEqual(broadcasts, [{ type: 'stock.changed', storeId: store.id }])
  })

  test('an item sold out by hand is told to the store, so open menus drop it', async ({
    client,
    assert,
    cleanup,
  }) => {
    const { default: StoreRole } = await import('#enums/store_role')
    const { createMenuStore, linkUser } = await import('#tests/helpers/fixtures')
    const manager = await createUser()
    const { store, coca } = await createMenuStore()
    await linkUser(store, manager, StoreRole.MANAGER)
    const broadcasts: unknown[] = []
    cleanup(transmit.on('broadcast', ({ payload }) => broadcasts.push(payload)))

    const soldOut = await client
      .put(`/api/v1/stores/${store.id}/items/${coca.id}`)
      .json({ isAvailable: false })
      .loginAs(manager)

    soldOut.assertStatus(200)
    assert.deepEqual(broadcasts, [{ type: 'menu.changed', storeId: store.id }])
  })
})
