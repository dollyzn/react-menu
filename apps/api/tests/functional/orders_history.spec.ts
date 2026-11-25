import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import StoreRole from '#enums/store_role'
import { createMenuStore, createUser, linkUser } from '#tests/helpers/fixtures'
import { emptyDatabase } from '#tests/helpers/database'

test.group('Orders history', (group) => {
  group.each.setup(() => emptyDatabase)

  async function setup(client: ApiClient) {
    const attendant = await createUser({ name: 'Bia Atendente' })
    const { store, carne } = await createMenuStore()
    await linkUser(store, attendant, StoreRole.ATTENDANT)
    const manager = await createUser({ name: 'Gil Gerente' })
    await linkUser(store, manager, StoreRole.MANAGER)
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
    return { attendant, manager, store, posOrder: pos.body().data }
  }

  test('filters, searches and paginates', async ({ client, assert }) => {
    const { manager, store } = await setup(client)
    const list = (qs: Record<string, unknown>) =>
      client
        .get(`/api/v1/stores/${store.id}/orders`)
        .qs({ page: 1, ...qs })
        .loginAs(manager)

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

  test('counts each filter option, leaving its own choice out', async ({ client, assert }) => {
    const { manager, store } = await setup(client)
    // Another store's orders never count.
    const other = await createMenuStore()
    await client.post(`/api/v1/public/menu/${other.store.slug}/orders`).json({
      customer: { name: 'Outra Loja', phone: '(11) 90000-0000' },
      paymentMethod: 'counter',
      lines: [{ itemId: other.carne.id, quantity: 1 }],
    })
    const facets = async (qs: Record<string, unknown>) => {
      const response = await client
        .get(`/api/v1/stores/${store.id}/orders`)
        .qs({ page: 1, facets: 1, ...qs })
        .loginAs(manager)
      response.assertStatus(200)
      return response.body().meta.facets as Record<string, Record<string, number>>
    }
    const sum = (counts: Record<string, number>) => Object.values(counts).reduce((a, b) => a + b, 0)

    const all = await facets({})
    assert.deepEqual(all.channel, { online: 2, pos: 1 })
    assert.equal(sum(all.status), 3)

    // A channel picked: its own counts stay (to switch), the others follow it.
    const pos = await facets({ channel: 'pos' })
    assert.deepEqual(pos.channel, { online: 2, pos: 1 })
    assert.equal(sum(pos.status), 1)

    // The search applies to every count.
    const bruno = await facets({ customerName: 'bruno' })
    assert.deepEqual(bruno.channel, { online: 1 })
    assert.equal(sum(bruno.status), 1)

    // Only when asked (the table's first page): the next pages don't recount.
    const plain = await client
      .get(`/api/v1/stores/${store.id}/orders`)
      .qs({ page: 2 })
      .loginAs(manager)
    assert.notProperty(plain.body().meta, 'facets')
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

  test("attendants see today's board, not the history, other days or cancelling", async ({
    client,
    assert,
  }) => {
    const { attendant, manager, store, posOrder } = await setup(client)
    const orders = `/api/v1/stores/${store.id}/orders`
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
    const status = async (request: Promise<{ status(): number }>) => {
      const response = await request
      return response.status()
    }

    const board = await client.get(orders).loginAs(attendant)
    board.assertStatus(200)
    assert.lengthOf(board.body().data, 3)
    // `date` is a calendar day in São Paulo, whatever the server's timezone.
    const todays = await client.get(orders).qs({ date: today }).loginAs(attendant)
    todays.assertStatus(200)
    assert.lengthOf(todays.body().data, 3)

    assert.equal(await status(client.get(orders).qs({ page: 1 }).loginAs(attendant)), 403)
    assert.equal(
      await status(client.get(orders).qs({ date: '2026-01-02' }).loginAs(attendant)),
      403
    )
    assert.equal(await status(client.get(orders).qs({ date: '2026-01-02' }).loginAs(manager)), 200)

    // Cancelling refunds a paid order: managers only.
    assert.equal(
      await status(client.post(`${orders}/${posOrder.id}/cancel`).loginAs(attendant)),
      403
    )
    assert.equal(await status(client.post(`${orders}/${posOrder.id}/cancel`).loginAs(manager)), 200)
  })
})
