import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import testUtils from '@adonisjs/core/services/test_utils'
import StoreRole from '#enums/store_role'
import { createMenuStore, createUser, linkUser } from '#tests/helpers/fixtures'

test.group('Orders history', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  async function setup(client: ApiClient) {
    const attendant = await createUser({ name: 'Bia Atendente' })
    const { store, carne } = await createMenuStore()
    await linkUser(store, attendant, StoreRole.ATTENDANT)
    const place = (name: string, phone: string) =>
      client.post(`/api/v1/public/menu/${store.slug}/orders`).json({
        customer: { name, phone },
        paymentMethod: 'counter',
        lines: [{ itemId: carne.id, quantity: 1 }],
      })
    await place('Ana Souza', '(11) 98765-4321')
    await place('Bruno Lima', '(11) 91234-0000')
    const pos = await client
      .post(`/api/v1/stores/${store.id}/orders`)
      .json({ customer: { name: 'Balcão' }, lines: [{ itemId: carne.id, quantity: 2 }] })
      .loginAs(attendant)
    return { attendant, store, posOrder: pos.body().data }
  }

  test('filters, searches and paginates', async ({ client, assert }) => {
    const { attendant, store } = await setup(client)
    const list = (qs: Record<string, unknown>) =>
      client
        .get(`/api/v1/stores/${store.id}/orders`)
        .qs({ page: 1, ...qs })
        .loginAs(attendant)

    const all = await list({ perPage: 2 })
    all.assertStatus(200)
    assert.lengthOf(all.body().data, 2)
    assert.equal(all.body().meta.total, 3)

    const byName = await list({ customerName: 'bruno' })
    assert.deepEqual(
      byName.body().data.map((o: { customerName: string }) => o.customerName),
      ['Bruno Lima']
    )
    const byPhone = await list({ customerName: '4321' })
    assert.equal(byPhone.body().data[0].customerName, 'Ana Souza')
    const byNumber = await list({ customerName: '#1' })
    assert.equal(byNumber.body().data[0].number, 1)

    const pos = await list({ channel: 'pos' })
    assert.lengthOf(pos.body().data, 1)

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
    const inRange = await list({ createdAt: `${today}~${today}` })
    assert.equal(inRange.body().meta.total, 3)
    const yesterdayOnly = await list({ createdAt: '~2000-01-01' })
    assert.equal(yesterdayOnly.body().meta.total, 0)
  })

  test('the detail shows who changed each status', async ({ client, assert }) => {
    const { attendant, store, posOrder } = await setup(client)
    const detail = await client
      .get(`/api/v1/stores/${store.id}/orders/${posOrder.id}`)
      .loginAs(attendant)

    detail.assertStatus(200)
    const history = detail.body().data.history as {
      toStatus: string
      user: { name: string } | null
    }[]
    assert.deepEqual(
      history.map((entry) => entry.toStatus),
      ['pending_payment', 'received']
    )
    assert.equal(history[1].user?.name, 'Bia Atendente')
    assert.notProperty(history[1].user!, 'email')
  })

  test("another store's member cannot list or open orders", async ({ client }) => {
    const { store, posOrder } = await setup(client)
    const outsider = await createUser()
    const other = await createMenuStore()
    await linkUser(other.store, outsider, StoreRole.MANAGER)

    const list = await client
      .get(`/api/v1/stores/${store.id}/orders`)
      .qs({ page: 1 })
      .loginAs(outsider)
    list.assertStatus(403)
    const detail = await client
      .get(`/api/v1/stores/${store.id}/orders/${posOrder.id}`)
      .loginAs(outsider)
    detail.assertStatus(403)
  })
})
