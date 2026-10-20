import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { randomUUID } from 'node:crypto'
import transmit from '@adonisjs/transmit/services/main'
import StoreStatus from '#enums/store_status'
import { createStore, createUser } from '#tests/helpers/fixtures'

test.group('Realtime (Transmit)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('requires authentication to subscribe', async ({ client }) => {
    const store = await createStore()

    const response = await client
      .post('/__transmit/subscribe')
      .json({ uid: randomUUID(), channel: `stores/${store.id}` })

    response.assertStatus(401)
  })

  test('only store members can subscribe to the store channel', async ({ client }) => {
    const member = await createUser()
    const outsider = await createUser()
    const store = await createStore([member])
    const channel = `stores/${store.id}`

    const allowed = await client
      .post('/__transmit/subscribe')
      .json({ uid: randomUUID(), channel })
      .loginAs(member)
    const denied = await client
      .post('/__transmit/subscribe')
      .json({ uid: randomUUID(), channel })
      .loginAs(outsider)
    const invalid = await client
      .post('/__transmit/subscribe')
      .json({ uid: randomUUID(), channel: 'stores/not-a-uuid' })
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
