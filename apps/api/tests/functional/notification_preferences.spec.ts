import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'
import mail from '@adonisjs/mail/services/main'
import { DateTime } from 'luxon'
import type { BatchResponse } from 'firebase-admin/messaging'
import StoreRole from '#enums/store_role'
import FcmClient from '#notifications/fcm_client'
import NotificationService from '#services/notification_service'
import NotificationMail from '#mails/notification_mail'
import DailySummaryMail from '#mails/daily_summary_mail'
import { sendDailySummaries } from '#jobs/send_daily_summaries'
import { BUSINESS_TIMEZONE } from '#services/order_service'
import { createMenuStore, createStore, createUser, linkUser } from '#tests/helpers/fixtures'
import { failJob, fakeQueue } from '#tests/helpers/queue'
import SendEmail from '#jobs/send_email'
import Notification from '#models/notification'
import StoreAccessNotification from '#mails/store_access_notification'

/** Push "configured", so notify() decides per person whether to queue it. */
class ConfiguredFcm extends FcmClient {
  get isConfigured() {
    return true
  }
  async send() {
    return { responses: [], successCount: 0, failureCount: 0 } as unknown as BatchResponse
  }
}

const preferences = '/api/v1/account/notification-preferences'

test.group('Notification preferences', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.setup(() => {
    app.container.swap(FcmClient, () => new ConfiguredFcm())
    return () => app.container.restore(FcmClient)
  })

  test('defaults per type, the stores, and the summary for managers', async ({
    client,
    assert,
  }) => {
    const store = await createStore()
    const manager = await createUser()
    const attendant = await createUser()
    await linkUser(store, manager, StoreRole.MANAGER)
    await linkUser(store, attendant, StoreRole.ATTENDANT)

    const mine = await client.get(preferences).loginAs(manager)
    const theirs = await client.get(preferences).loginAs(attendant)

    mine.assertStatus(200)
    const types = mine.body().data.types as {
      type: string
      label: string
      push: boolean
      email: boolean
    }[]
    assert.include(
      types.find((t) => t.type === 'order.received'),
      { label: 'Novos pedidos', push: true, email: false }
    )
    // Platform alerts are for super users only.
    assert.notInclude(
      types.map((t) => t.type),
      'system.job_failed'
    )
    assert.deepEqual(mine.body().data.stores, [{ id: store.id, name: store.name, muted: false }])
    assert.deepEqual(mine.body().data.dailySummary, { available: true, enabled: false, hour: 8 })
    assert.isFalse(theirs.body().data.dailySummary.available)
  })

  test('choices are saved, and only for the person own stores', async ({ client, assert }) => {
    const store = await createStore()
    const other = await createStore()
    const manager = await createUser()
    await linkUser(store, manager, StoreRole.MANAGER)

    const saved = await client
      .put(preferences)
      .json({
        channels: { 'order.received': { push: false, email: true } },
        mutedStoreIds: [store.id, other.id],
        dailySummary: { enabled: true, hour: 9 },
      })
      .loginAs(manager)

    saved.assertStatus(200)
    const order = saved.body().data.types.find((t: { type: string }) => t.type === 'order.received')
    assert.include(order, { push: false, email: true })
    // A store they don't work in can't be muted.
    assert.deepEqual(saved.body().data.stores, [{ id: store.id, name: store.name, muted: true }])
    assert.deepEqual(saved.body().data.dailySummary, { available: true, enabled: true, hour: 9 })
    const invalid = await client
      .put(preferences)
      .json({ channels: {}, mutedStoreIds: [], dailySummary: { enabled: true, hour: 24 } })
      .loginAs(manager)
    invalid.assertStatus(422)
  })

  test('push and e-mail follow each person; a muted store sends neither', async ({
    client,
    assert,
  }) => {
    const queue = fakeQueue()
    const fakeMail = mail.fake()
    const store = await createStore()
    const [pushOnly, emailOnly, muted] = [
      await createUser(),
      await createUser(),
      await createUser(),
    ]
    for (const user of [pushOnly, emailOnly, muted]) await linkUser(store, user, StoreRole.MANAGER)
    await client
      .put(preferences)
      .json({
        channels: { 'order.received': { push: false, email: true } },
        mutedStoreIds: [],
        dailySummary: { enabled: false, hour: 8 },
      })
      .loginAs(emailOnly)
    await client
      .put(preferences)
      .json({ channels: {}, mutedStoreIds: [store.id], dailySummary: { enabled: false, hour: 8 } })
      .loginAs(muted)

    const notifications = await app.container.make(NotificationService)
    const sent = await notifications.notifyStoreMembers(store.id, 'order.received', {
      storeId: store.id,
      orderNumber: 7,
      customerName: 'Ana',
      itemsCount: 2,
    })

    // The bell always gets it.
    assert.lengthOf(sent, 3)
    const pushed = queue
      .getPushedJobs()
      .filter((record) => record.job.name === 'SendPushNotification')
      .map((record) => (record.job.payload as { userId: string }).userId)
    assert.deepEqual(pushed, [pushOnly.id])
    const mails = fakeMail.mails.queued((message) => message instanceof NotificationMail)
    assert.lengthOf(mails, 1)
    assert.equal((mails[0] as NotificationMail).subject, 'Novo pedido #7')
    mail.restore()
  })

  test('the daily summary: yesterday per managed store, once a day', async ({ client, assert }) => {
    const fakeMail = mail.fake()
    const { store } = await createMenuStore()
    const manager = await createUser()
    await linkUser(store, manager, StoreRole.MANAGER)
    await client
      .put(preferences)
      .json({ channels: {}, mutedStoreIds: [], dailySummary: { enabled: true, hour: 7 } })
      .loginAs(manager)
    const at = (hour: number) => DateTime.now().setZone(BUSINESS_TIMEZONE).set({ hour, minute: 0 })

    const early = await sendDailySummaries(at(6))
    // 07:00 was missed (API down, a failed run): the next run catches up.
    const late = await sendDailySummaries(at(9))
    const again = await sendDailySummaries(at(10))

    assert.equal(early, 0)
    assert.equal(late, 1)
    assert.equal(again, 0)
    const [summary] = fakeMail.mails.queued((message) => message instanceof DailySummaryMail)
    assert.include((summary as DailySummaryMail).subject, store.name)
    mail.restore()
  })

  test('a failed e-mail job tells the admins in the bell, never by e-mail', async ({ assert }) => {
    const fakeMail = mail.fake()
    await createUser({ superUser: true })
    await failJob(SendEmail, { mailer: 'smtp', mail: {} as never }, new Error('SMTP down'))

    assert.lengthOf(
      fakeMail.mails.queued((message) => message instanceof NotificationMail),
      0
    )
    const [notice] = await Notification.query().where('type', 'system.job_failed')
    assert.exists(notice)
    mail.restore()
  })

  test('joining a team sends one e-mail, and none when switched off', async ({
    client,
    assert,
  }) => {
    const fakeMail = mail.fake()
    const store = await createStore()
    const manager = await createUser()
    await linkUser(store, manager, StoreRole.MANAGER)
    const [wants, declined] = [await createUser(), await createUser()]
    await client
      .put(preferences)
      .json({
        channels: { 'store.member_added': { push: true, email: false } },
        mutedStoreIds: [],
        dailySummary: { enabled: false, hour: 8 },
      })
      .loginAs(declined)

    for (const user of [wants, declined]) {
      const added = await client
        .post(`/api/v1/stores/${store.id}/members`)
        .json({ email: user.email, role: StoreRole.ATTENDANT })
        .loginAs(manager)
      added.assertStatus(200)
    }

    const queued = fakeMail.mails.queued()
    assert.lengthOf(queued, 1)
    assert.instanceOf(queued[0], StoreAccessNotification)
    assert.notInstanceOf(queued[0], NotificationMail)
    mail.restore()
  })
})
