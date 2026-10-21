import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'
import { randomUUID } from 'node:crypto'
import StoreStatus from '#enums/store_status'
import Notification from '#models/notification'
import PushRegistration from '#models/push_registration'
import NotificationService from '#services/notification_service'
import { createStore, createUser } from '#tests/helpers/fixtures'
import { openStream } from '#tests/helpers/transmit'

async function announce(userIds: string[]) {
  const service = await app.container.make(NotificationService)
  return await service.notify(
    'system.announcement',
    { title: 'Manutenção', body: 'Sistema indisponível às 3h.' },
    { userIds }
  )
}

test.group('Notifications', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('notify renders the template and stores one row per recipient', async ({ assert }) => {
    const [a, b] = [await createUser(), await createUser()]

    const notifications = await announce([a.id, b.id, a.id])

    assert.lengthOf(notifications, 2)
    assert.equal(notifications[0].category, 'system')
    assert.equal(notifications[0].title, 'Manutenção')
  })

  test('users only see and change their own notifications', async ({ client, assert }) => {
    const [owner, other] = [await createUser(), await createUser()]
    const [notification] = await announce([owner.id])

    const ownerList = await client.get('/api/v1/notifications').loginAs(owner)
    const otherList = await client.get('/api/v1/notifications').loginAs(other)
    const otherRead = await client
      .patch(`/api/v1/notifications/${notification.id}/read`)
      .loginAs(other)
    const otherDelete = await client
      .delete(`/api/v1/notifications/${notification.id}`)
      .loginAs(other)

    ownerList.assertStatus(200)
    ownerList.assertBodyContains({ meta: { unreadCount: 1, total: 1 } })
    otherList.assertBodyContains({ data: [], meta: { unreadCount: 0 } })
    otherRead.assertStatus(404)
    otherDelete.assertStatus(404)
    assert.isNotNull(await Notification.find(notification.id))
  })

  test('mark as read, read all and clear', async ({ client, assert }) => {
    const user = await createUser()
    const [first] = await announce([user.id])
    await announce([user.id])

    const read = await client.patch(`/api/v1/notifications/${first.id}/read`).loginAs(user)
    read.assertStatus(200)
    assert.isNotNull(read.body().data.readAt)

    await client.post('/api/v1/notifications/read-all').loginAs(user)
    const afterReadAll = await client.get('/api/v1/notifications?unread=true').loginAs(user)
    afterReadAll.assertBodyContains({ data: [], meta: { unreadCount: 0 } })

    await client.delete('/api/v1/notifications').loginAs(user)
    assert.lengthOf(await Notification.query().where('userId', user.id), 0)
  })

  test('store status change notifies the other store members', async ({ client, assert }) => {
    const actor = await createUser({ name: 'Ana' })
    const colleague = await createUser()
    const outsider = await createUser()
    const store = await createStore([actor, colleague])

    await client
      .patch(`/api/v1/stores/${store.id}/status`)
      .json({ status: StoreStatus.OPEN })
      .loginAs(actor)

    const received = await Notification.query().where('userId', colleague.id)
    assert.lengthOf(received, 1)
    assert.equal(received[0].type, 'store.status_changed')
    assert.equal(received[0].body, 'Ana alterou o status da loja para aberta.')
    assert.lengthOf(await Notification.query().where('userId', actor.id), 0)
    assert.lengthOf(await Notification.query().where('userId', outsider.id), 0)
  })

  test('only the owner can subscribe to their notifications channel', async ({
    client,
    cleanup,
  }) => {
    const [owner, other] = [await createUser(), await createUser()]
    const channel = `users/${owner.id}/notifications`

    const allowed = await client
      .post('/__transmit/subscribe')
      .json({ uid: openStream(cleanup), channel })
      .loginAs(owner)
    const denied = await client
      .post('/__transmit/subscribe')
      .json({ uid: openStream(cleanup), channel })
      .loginAs(other)

    allowed.assertStatus(204)
    denied.assertStatus(400)
  })
})

test.group('Push registrations (FCM)', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  const fid = () => `fid_${randomUUID().replaceAll('-', '')}`

  test('register, check and unregister an installation', async ({ client }) => {
    const user = await createUser()
    const installation = fid()

    const registered = await client
      .post('/api/v1/notifications/push/register')
      .json({ fid: installation })
      .loginAs(user)
    const check = await client
      .post('/api/v1/notifications/push/check')
      .json({ fid: installation })
      .loginAs(user)
    await client
      .post('/api/v1/notifications/push/unregister')
      .json({ fid: installation })
      .loginAs(user)
    const checkAfter = await client
      .post('/api/v1/notifications/push/check')
      .json({ fid: installation })
      .loginAs(user)

    registered.assertStatus(200)
    check.assertBodyContains({ data: { registered: true } })
    checkAfter.assertBodyContains({ data: { registered: false } })
  })

  test('an installation moves to the user who registered it last', async ({ client, assert }) => {
    const [first, second] = [await createUser(), await createUser()]
    const installation = fid()

    await client
      .post('/api/v1/notifications/push/register')
      .json({ fid: installation })
      .loginAs(first)
    await client
      .post('/api/v1/notifications/push/register')
      .json({ fid: installation })
      .loginAs(second)

    const rows = await PushRegistration.query().where('fid', installation)
    assert.lengthOf(rows, 1)
    assert.equal(rows[0].userId, second.id)
  })

  test('rejects malformed installation ids', async ({ client }) => {
    const user = await createUser()

    const response = await client
      .post('/api/v1/notifications/push/register')
      .json({ fid: 'not a fid!' })
      .loginAs(user)

    response.assertStatus(422)
  })
})
