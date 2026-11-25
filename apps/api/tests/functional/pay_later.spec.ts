import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import StoreRole from '#enums/store_role'
import Order from '#models/order'
import { createMenuStore, createUser, linkUser } from '#tests/helpers/fixtures'
import { emptyDatabase } from '#tests/helpers/database'

test.group('Pagar depois (fiado)', (group) => {
  group.each.setup(() => emptyDatabase)

  async function setup() {
    const menu = await createMenuStore()
    const attendant = await createUser({ name: 'Ana Atendente' })
    const manager = await createUser({ name: 'Nadson' })
    await linkUser(menu.store, attendant, StoreRole.ATTENDANT)
    await linkUser(menu.store, manager, StoreRole.MANAGER)
    return { ...menu, attendant, manager }
  }

  test('sent as "pagar depois" it needs a phone, goes to the kitchen and is handed over unpaid', async ({
    client,
    assert,
  }) => {
    const { store, coca, attendant, manager } = await setup()
    const orders = `/api/v1/stores/${store.id}/orders`
    const noPhone = await client
      .post(orders)
      .json({ customer: { name: 'Zé' }, lines: [{ itemId: coca.id, quantity: 1 }], payLater: true })
      .loginAs(attendant)
    const sent = await client
      .post(orders)
      .json({
        customer: { name: 'Zé', phone: '(13) 99999-0000' },
        lines: [{ itemId: coca.id, quantity: 2 }],
        payLater: true,
      })
      .loginAs(attendant)
    noPhone.assertStatus(422)
    noPhone.assertBodyContains({ code: 'E_PHONE_REQUIRED' })
    sent.assertStatus(200)
    const id = sent.body().data.id as string
    assert.isNotNull(sent.body().data.payLaterAt)
    assert.equal(sent.body().data.paymentStatus, 'pending')
    // Drinks only: ready at once (in the kitchen's flow like any other order).
    assert.equal(sent.body().data.status, 'ready')

    const delivered = await client.post(`${orders}/${id}/complete`).loginAs(attendant)
    delivered.assertStatus(200)
    delivered.assertBodyContains({ data: { status: 'completed', paymentStatus: 'pending' } })

    // The managers' list: open ones, with who sent them that way.
    const list = await client.get(`${orders}/pay-later`).loginAs(manager)
    list.assertStatus(200)
    assert.lengthOf(list.body().data, 1)
    assert.deepInclude(list.body().data[0], {
      id,
      customerPhone: '5513999990000',
      amountDue: 12,
      payLaterBy: { id: attendant.id, name: 'Ana Atendente' },
    })

    // Settled another day: it leaves the list.
    const paid = await client
      .post(`${orders}/${id}/payment`)
      .json({ method: 'pix', amount: 12 })
      .loginAs(manager)
    paid.assertStatus(200)
    const after = await client.get(`${orders}/pay-later`).loginAs(manager)
    assert.lengthOf(after.body().data, 0)
    const order = await Order.findOrFail(id)
    assert.equal(order.paymentStatus, 'paid')
    assert.equal(order.counterMethod, 'pix')
  })

  test('an order sent as "receber depois" becomes "pagar depois"; the phone is asked when missing', async ({
    client,
    assert,
  }) => {
    const { store, coca, attendant } = await setup()
    const orders = `/api/v1/stores/${store.id}/orders`
    const later = await client
      .post(orders)
      .json({ customer: { name: 'Maria' }, lines: [{ itemId: coca.id, quantity: 1 }] })
      .loginAs(attendant)
    const id = later.body().data.id as string

    // Without "pagar depois" it still can't go unpaid.
    const blocked = await client.post(`${orders}/${id}/complete`).loginAs(attendant)
    blocked.assertStatus(409)
    blocked.assertBodyContains({ code: 'E_PAYMENT_REQUIRED' })

    const noPhone = await client.post(`${orders}/${id}/pay-later`).json({}).loginAs(attendant)
    const badPhone = await client
      .post(`${orders}/${id}/pay-later`)
      .json({ phone: '123' })
      .loginAs(attendant)
    const marked = await client
      .post(`${orders}/${id}/pay-later`)
      .json({ phone: '13988887777' })
      .loginAs(attendant)
    const again = await client.post(`${orders}/${id}/pay-later`).json({}).loginAs(attendant)
    noPhone.assertStatus(422)
    noPhone.assertBodyContains({ code: 'E_PHONE_REQUIRED' })
    badPhone.assertStatus(422)
    marked.assertStatus(200)
    marked.assertBodyContains({ data: { customerPhone: '5513988887777' } })
    again.assertStatus(200)
    const order = await Order.findOrFail(id)
    assert.isNotNull(order.payLaterAt)
    assert.equal(order.payLaterById, attendant.id)
    assert.isNotNull(order.customerId)

    const delivered = await client.post(`${orders}/${id}/complete`).loginAs(attendant)
    delivered.assertStatus(200)
  })

  test('paid or cancelled orders do not become "pagar depois"', async ({ client }) => {
    const { store, coca, attendant, manager } = await setup()
    const orders = `/api/v1/stores/${store.id}/orders`
    const paid = await client
      .post(orders)
      .json({
        customer: { name: 'Pago', phone: '13999990000' },
        lines: [{ itemId: coca.id, quantity: 1 }],
        counterMethod: 'cash',
      })
      .loginAs(attendant)
    const cancelled = await client
      .post(orders)
      .json({
        customer: { name: 'Cancelado', phone: '13999990000' },
        lines: [{ itemId: coca.id, quantity: 1 }],
      })
      .loginAs(attendant)
    await client.post(`${orders}/${cancelled.body().data.id}/cancel`).loginAs(manager)

    const onPaid = await client
      .post(`${orders}/${paid.body().data.id}/pay-later`)
      .json({})
      .loginAs(attendant)
    const onCancelled = await client
      .post(`${orders}/${cancelled.body().data.id}/pay-later`)
      .json({})
      .loginAs(attendant)
    onPaid.assertStatus(409)
    onPaid.assertBodyContains({ code: 'E_ALREADY_PAID' })
    onCancelled.assertStatus(409)
  })

  test('who to charge can be corrected; a cancelled one is refused, not "marked"', async ({
    client,
    assert,
  }) => {
    const { store, coca, attendant, manager } = await setup()
    const orders = `/api/v1/stores/${store.id}/orders`
    const sent = await client
      .post(orders)
      .json({
        customer: { name: 'Zé', phone: '13999990000' },
        lines: [{ itemId: coca.id, quantity: 1 }],
        payLater: true,
      })
      .loginAs(attendant)
    const id = sent.body().data.id as string
    const markedAt = sent.body().data.payLaterAt

    const corrected = await client
      .post(`${orders}/${id}/pay-later`)
      .json({ name: 'José Silva', phone: '13911112222' })
      .loginAs(attendant)
    corrected.assertStatus(200)
    corrected.assertBodyContains({
      data: { customerName: 'José Silva', customerPhone: '5513911112222', payLaterAt: markedAt },
    })

    await client.post(`${orders}/${id}/cancel`).loginAs(manager)
    const onCancelled = await client.post(`${orders}/${id}/pay-later`).json({}).loginAs(attendant)
    onCancelled.assertStatus(409)
    onCancelled.assertBodyContains({ code: 'E_ORDER_CANCELLED' })
    const list = await client.get(`${orders}/pay-later`).loginAs(manager)
    assert.lengthOf(list.body().data, 0)
  })

  test('the list searches, sorts and pages; the summary adds up who owes what', async ({
    client,
    assert,
  }) => {
    const { store, coca, attendant, manager } = await setup()
    const orders = `/api/v1/stores/${store.id}/orders`
    const send = (name: string, phone: string, quantity: number) =>
      client
        .post(orders)
        .json({ customer: { name, phone }, lines: [{ itemId: coca.id, quantity }], payLater: true })
        .loginAs(attendant)
    await send('Zé', '13999990000', 1)
    await send('Maria', '13988880000', 4)
    await send('Zé', '13999990000', 2)

    const all = await client.get(`${orders}/pay-later`).qs({ page: 1, perPage: 2 }).loginAs(manager)
    assert.lengthOf(all.body().data, 2)
    assert.equal(all.body().meta.total, 3)
    const byPhone = await client
      .get(`${orders}/pay-later`)
      .qs({ customerName: '88880' })
      .loginAs(manager)
    assert.deepEqual(
      byPhone.body().data.map((order: { customerName: string }) => order.customerName),
      ['Maria']
    )
    const biggest = await client
      .get(`${orders}/pay-later`)
      .qs({ sort: 'amountDue:desc' })
      .loginAs(manager)
    assert.deepEqual(
      biggest.body().data.map((order: { amountDue: number }) => order.amountDue),
      [24, 12, 6]
    )
    const badSort = await client.get(`${orders}/pay-later`).qs({ sort: 'id:desc' }).loginAs(manager)
    badSort.assertStatus(422)

    const summary = await client.get(`${orders}/pay-later/summary`).loginAs(manager)
    summary.assertStatus(200)
    const { since, ...rest } = summary.body().data
    assert.isString(since)
    assert.deepEqual(rest, {
      count: 3,
      total: 42,
      customers: 2,
      debtors: [
        { name: 'Maria', phone: '5513988880000', orders: 1, due: 24 },
        { name: 'Zé', phone: '5513999990000', orders: 2, due: 18 },
      ],
    })
    const byAttendant = await client.get(`${orders}/pay-later/summary`).loginAs(attendant)
    byAttendant.assertStatus(403)
  })

  test('the list is for managers of this store; marking is for its front of house', async ({
    client,
    assert,
  }) => {
    const { store, coca, attendant } = await setup()
    const other = await setup()
    const kitchen = await createUser()
    await linkUser(store, kitchen, StoreRole.KITCHEN)
    const orders = `/api/v1/stores/${store.id}/orders`
    const sent = await client
      .post(orders)
      .json({ customer: { name: 'Zé' }, lines: [{ itemId: coca.id, quantity: 1 }] })
      .loginAs(attendant)
    const id = sent.body().data.id as string

    const byAttendant = await client.get(`${orders}/pay-later`).loginAs(attendant)
    const byOtherManager = await client.get(`${orders}/pay-later`).loginAs(other.manager)
    const markByKitchen = await client
      .post(`${orders}/${id}/pay-later`)
      .json({ phone: '13999990000' })
      .loginAs(kitchen)
    const markByOther = await client
      .post(`${orders}/${id}/pay-later`)
      .json({ phone: '13999990000' })
      .loginAs(other.attendant)
    byAttendant.assertStatus(403)
    assert.include([403, 404], byOtherManager.status())
    markByKitchen.assertStatus(403)
    assert.include([403, 404], markByOther.status())
    const untouched = await Order.findOrFail(id)
    assert.isNull(untouched.payLaterAt)
  })

  /** "Pagar depois" orders of a customer, sent from the POS. */
  async function owe(
    client: ApiClient,
    store: { id: string },
    itemId: string,
    attendant: Parameters<typeof linkUser>[1],
    customer: { name: string; phone: string },
    quantity: number
  ) {
    const sent = await client
      .post(`/api/v1/stores/${store.id}/orders`)
      .json({ customer, lines: [{ itemId, quantity }], payLater: true })
      .loginAs(attendant)
    return sent.body().data as { id: string; total: number }
  }

  test('by customer: each one with what they owe and their orders, searched and sorted', async ({
    client,
    assert,
  }) => {
    const { store, coca, attendant, manager } = await setup()
    const ze = { name: 'Zé', phone: '(13) 99999-0000' }
    const first = await owe(client, store, coca.id, attendant, ze, 1)
    const second = await owe(client, store, coca.id, attendant, ze, 2)
    await owe(client, store, coca.id, attendant, { name: 'Maria', phone: '(13) 98888-0000' }, 4)
    const url = `/api/v1/stores/${store.id}/orders/pay-later/customers`

    const all = await client.get(url).loginAs(manager)
    all.assertStatus(200)
    assert.equal(all.body().meta.total, 2)
    const [maria, zeRow] = all.body().data
    assert.include(maria, { name: 'Maria', due: 24 })
    assert.include(zeRow, { key: '5513999990000', name: 'Zé', due: 18 })
    assert.deepEqual(
      zeRow.orders.map((order: { id: string }) => order.id),
      [first.id, second.id]
    )

    const oldest = await client.get(url).qs({ sort: 'since:asc' }).loginAs(manager)
    assert.deepEqual(
      oldest.body().data.map((row: { name: string }) => row.name),
      ['Zé', 'Maria']
    )
    const found = await client.get(url).qs({ search: '99999' }).loginAs(manager)
    assert.deepEqual(
      found.body().data.map((row: { name: string }) => row.name),
      ['Zé']
    )
    // Found by one order's number, the customer still owes all of them.
    const firstOrder = await Order.findOrFail(first.id)
    const byNumber = await client
      .get(url)
      .qs({ search: `#${firstOrder.number}` })
      .loginAs(manager)
    assert.include(byNumber.body().data[0], { name: 'Zé', due: 18 })
    assert.lengthOf(byNumber.body().data[0].orders, 2)
    // "%" and "_" match themselves, not everyone.
    const wildcard = await client.get(url).qs({ search: '%' }).loginAs(manager)
    assert.lengthOf(wildcard.body().data, 0)
    const paged = await client.get(url).qs({ perPage: 1, page: 2 }).loginAs(manager)
    assert.equal(paged.body().data[0].name, 'Zé')
    assert.equal(paged.body().meta.lastPage, 2)
    const byAttendant = await client.get(url).loginAs(attendant)
    byAttendant.assertStatus(403)
    const other = await setup()
    const byOtherStore = await client.get(url).loginAs(other.manager)
    assert.include([403, 404], byOtherStore.status())
  })

  test('several orders of one customer are received at once, each for what it owes', async ({
    client,
    assert,
  }) => {
    const { store, coca, attendant, manager } = await setup()
    const other = await setup()
    const ze = { name: 'Zé', phone: '(13) 99999-0000' }
    const first = await owe(client, store, coca.id, attendant, ze, 1)
    const second = await owe(client, store, coca.id, attendant, ze, 2)
    const third = await owe(client, store, coca.id, attendant, ze, 3)
    const maria = await owe(
      client,
      store,
      coca.id,
      attendant,
      { name: 'Maria', phone: '(13) 98888-0000' },
      1
    )
    const url = `/api/v1/stores/${store.id}/orders/pay-later/receive`

    const mixed = await client
      .post(url)
      .json({ orderIds: [first.id, maria.id], method: 'pix', amount: 12 })
      .loginAs(manager)
    mixed.assertStatus(422)
    mixed.assertBodyContains({ code: 'E_MIXED_CUSTOMERS' })
    const stale = await client
      .post(url)
      .json({ orderIds: [first.id, second.id], method: 'pix', amount: 10 })
      .loginAs(manager)
    stale.assertStatus(409)
    stale.assertBodyContains({ code: 'E_AMOUNT_CHANGED' })
    const byAttendant = await client
      .post(url)
      .json({ orderIds: [first.id], method: 'pix', amount: 6 })
      .loginAs(attendant)
    byAttendant.assertStatus(403)
    const byOtherStore = await client
      .post(`/api/v1/stores/${other.store.id}/orders/pay-later/receive`)
      .json({ orderIds: [first.id], method: 'pix', amount: 6 })
      .loginAs(other.manager)
    byOtherStore.assertStatus(404)

    const paid = await client
      .post(url)
      .json({ orderIds: [first.id, second.id], method: 'cash', amount: 18 })
      .loginAs(manager)
    paid.assertStatus(200)
    assert.deepEqual(paid.body().data, { orders: 2, amount: 18 })
    // The same request again records nothing twice.
    const again = await client
      .post(url)
      .json({ orderIds: [first.id, second.id], method: 'cash', amount: 18 })
      .loginAs(manager)
    again.assertStatus(200)
    assert.deepEqual(again.body().data, { orders: 0, amount: 0 })

    for (const id of [first.id, second.id]) {
      const order = await Order.findOrFail(id)
      assert.equal(order.paymentStatus, 'paid')
      assert.equal(order.counterMethod, 'cash')
      assert.equal(order.paidById, manager.id)
    }
    const open = await Order.findOrFail(third.id)
    assert.equal(open.paymentStatus, 'pending')
    const summary = await client
      .get(`/api/v1/stores/${store.id}/orders/pay-later/summary`)
      .loginAs(manager)
    assert.include(summary.body().data, { count: 2, total: 24 })
  })
})
