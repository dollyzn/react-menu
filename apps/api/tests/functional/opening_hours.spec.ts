import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import { DateTime } from 'luxon'
import StoreRole from '#enums/store_role'
import { createMenuStore, createUser, linkUser } from '#tests/helpers/fixtures'

const ZONE = 'America/Sao_Paulo'
const customer = { name: 'Ana', phone: '11987654321' }

/** An interval from `start` to `end` (relative to now, business timezone). */
function interval(start: DateTime, end: DateTime) {
  return { day: start.weekday % 7, opens: start.toFormat('HH:mm'), closes: end.toFormat('HH:mm') }
}

async function storeWithManager() {
  const menu = await createMenuStore()
  const manager = await createUser()
  await linkUser(menu.store, manager, StoreRole.MANAGER)
  return { ...menu, manager }
}

test.group('Opening hours', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('managers set the schedule; invalid ones are refused', async ({ client }) => {
    const { store, manager } = await storeWithManager()
    const attendant = await createUser()
    await linkUser(store, attendant, StoreRole.ATTENDANT)
    const other = await storeWithManager()
    const url = `/api/v1/stores/${store.id}/hours`
    const week = [1, 2, 3, 4, 5].map((day) => ({ day, opens: '18:00', closes: '23:00' }))

    const saved = await client
      .put(url)
      .json({ scheduleEnabled: true, openingHours: week })
      .loginAs(manager)
    const overlap = await client
      .put(url)
      .json({
        scheduleEnabled: true,
        openingHours: [
          { day: 1, opens: '10:00', closes: '15:00' },
          { day: 1, opens: '14:00', closes: '18:00' },
        ],
      })
      .loginAs(manager)
    const empty = await client
      .put(url)
      .json({ scheduleEnabled: true, openingHours: [] })
      .loginAs(manager)
    const badTime = await client
      .put(url)
      .json({ scheduleEnabled: true, openingHours: [{ day: 1, opens: '25:00', closes: '23:00' }] })
      .loginAs(manager)
    const byAttendant = await client
      .put(url)
      .json({ scheduleEnabled: false, openingHours: [] })
      .loginAs(attendant)
    const byOtherStore = await client
      .put(url)
      .json({ scheduleEnabled: false, openingHours: [] })
      .loginAs(other.manager)

    saved.assertStatus(200)
    saved.assertBodyContains({ data: { scheduleEnabled: true, openingHours: week } })
    overlap.assertStatus(422)
    overlap.assertBodyContains({ code: 'E_INVALID_HOURS' })
    empty.assertStatus(422)
    badTime.assertStatus(422)
    byAttendant.assertStatus(403)
    byOtherStore.assertStatus(403)
  })

  test('the menu and online orders follow the schedule; the POS always works', async ({
    client,
    assert,
  }) => {
    const { store, carne, manager } = await storeWithManager()
    const now = DateTime.now().setZone(ZONE).startOf('minute')
    const order = () =>
      client
        .post(`/api/v1/public/menu/${store.slug}/orders`)
        .json({ customer, paymentMethod: 'counter', lines: [{ itemId: carne.id, quantity: 1 }] })

    // Opens in two hours.
    await client
      .put(`/api/v1/stores/${store.id}/hours`)
      .json({
        scheduleEnabled: true,
        openingHours: [interval(now.plus({ hours: 2 }), now.plus({ hours: 4 }))],
      })
      .loginAs(manager)
    const closedResponse = await client.get(`/api/v1/public/menu/${store.slug}`)
    const closedMenu = closedResponse.body().data.store
    assert.isFalse(closedMenu.isOpen)
    assert.equal(DateTime.fromISO(closedMenu.opensAt).toMillis(), now.plus({ hours: 2 }).toMillis())
    const refused = await order()
    refused.assertStatus(409)
    refused.assertBodyContains({ code: 'E_STORE_CLOSED' })
    assert.match(refused.body().error, /Abre /)
    const pos = await client
      .post(`/api/v1/stores/${store.id}/orders`)
      .json({ customer: { name: 'Balcão' }, lines: [{ itemId: carne.id, quantity: 1 }] })
      .loginAs(manager)
    pos.assertStatus(200)

    // Open since an hour ago, until in an hour.
    await client
      .put(`/api/v1/stores/${store.id}/hours`)
      .json({
        scheduleEnabled: true,
        openingHours: [interval(now.minus({ hours: 1 }), now.plus({ hours: 1 }))],
      })
      .loginAs(manager)
    const openResponse = await client.get(`/api/v1/public/menu/${store.slug}`)
    const openMenu = openResponse.body().data.store
    assert.isTrue(openMenu.isOpen)
    assert.equal(DateTime.fromISO(openMenu.closesAt).toMillis(), now.plus({ hours: 1 }).toMillis())
    const accepted = await order()
    accepted.assertStatus(200)
  })

  test('turning the schedule on lets it decide even if the store was closed by hand', async ({
    client,
    assert,
  }) => {
    const { store, manager } = await storeWithManager()
    store.status = 'closed'
    await store.save()
    const now = DateTime.now().setZone(ZONE).startOf('minute')

    const on = await client
      .put(`/api/v1/stores/${store.id}/hours`)
      .json({
        scheduleEnabled: true,
        openingHours: [interval(now.minus({ hours: 1 }), now.plus({ hours: 1 }))],
      })
      .loginAs(manager)
    assert.isTrue(on.body().data.isOpen)
    assert.equal(on.body().data.status, 'open')

    // Off again: stays as it is right now (open), now by hand.
    const off = await client
      .put(`/api/v1/stores/${store.id}/hours`)
      .json({ scheduleEnabled: false, openingHours: [] })
      .loginAs(manager)
    assert.isTrue(off.body().data.isOpen)
    assert.isFalse(off.body().data.scheduleEnabled)
  })

  test('"close now" on a schedule lasts until the end of the opening', async ({
    client,
    assert,
  }) => {
    const { store, manager } = await storeWithManager()
    const now = DateTime.now().setZone(ZONE).startOf('minute')
    await client
      .put(`/api/v1/stores/${store.id}/hours`)
      .json({
        scheduleEnabled: true,
        openingHours: [interval(now.minus({ hours: 1 }), now.plus({ hours: 1 }))],
      })
      .loginAs(manager)

    const closed = await client
      .patch(`/api/v1/stores/${store.id}/status`)
      .json({ status: 'closed' })
      .loginAs(manager)
    closed.assertStatus(200)
    assert.isFalse(closed.body().data.isOpen)
    assert.equal(
      DateTime.fromISO(closed.body().data.closedUntil).toMillis(),
      now.plus({ hours: 1 }).toMillis(),
      'reopens by itself at the next opening'
    )
    assert.equal(closed.body().data.status, 'open', 'still following the schedule')

    const reopened = await client
      .patch(`/api/v1/stores/${store.id}/status`)
      .json({ status: 'open' })
      .loginAs(manager)
    assert.isTrue(reopened.body().data.isOpen)
    assert.isNull(reopened.body().data.closedUntil)
  })
})
