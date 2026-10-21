import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { randomUUID } from 'node:crypto'
import transmit from '@adonisjs/transmit/services/main'
import StoreStatus from '#enums/store_status'
import { createStore, createUser } from '#tests/helpers/fixtures'
import { openStream } from '#tests/helpers/transmit'

test.group('Realtime (Transmit)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

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
})
