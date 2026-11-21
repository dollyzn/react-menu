import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import app from '@adonisjs/core/services/app'
import type { ApiClient } from '@japa/api-client'
import mail from '@adonisjs/mail/services/main'
import StoreRole from '#enums/store_role'
import Customer from '#models/customer'
import Notification from '#models/notification'
import Order from '#models/order'
import type Store from '#models/store'
import StorePartner from '#models/store_partner'
import type User from '#models/user'
import MercadoPagoClient from '#payments/mercado_pago_client'
import RefundOrder from '#jobs/refund_order'
import { createMenuStore, createUser, linkUser } from '#tests/helpers/fixtures'
import { BALCAO, FakePoint, RESERVA, SECRET, TOKEN, signature } from '#tests/helpers/fake_point'
import { fakeQueue, runJob } from '#tests/helpers/queue'
import { openStream } from '#tests/helpers/transmit'

type Menu = Awaited<ReturnType<typeof createMenuStore>>

/** A field of the order as stored now. */
async function stored<Key extends keyof Order>(id: string, key: Key) {
  const order = await Order.findOrFail(id)
  return order[key]
}

const partnerInput = {
  name: 'Açaí da Praça',
  commissionType: 'percent',
  commissionValue: 10,
  cancelPolicy: 'until_kitchen',
}

/** A store with Mercado Pago, a manager, an attendant, a cook and one partner with a person. */
async function partnerStore() {
  const menu = await createMenuStore()
  menu.store.merge({ mercadoPagoAccessToken: TOKEN, mercadoPagoWebhookSecret: SECRET })
  await menu.store.save()
  const manager = await createUser({ name: 'Gerente' })
  const attendant = await createUser({ name: 'Atendente' })
  const cook = await createUser({ name: 'Cozinha' })
  await linkUser(menu.store, manager, StoreRole.MANAGER)
  await linkUser(menu.store, attendant, StoreRole.ATTENDANT)
  await linkUser(menu.store, cook, StoreRole.KITCHEN)
  const { partner, person } = await addPartner(menu.store, 'Açaí da Praça')
  return { ...menu, manager, attendant, cook, partner, person }
}

async function addPartner(store: Store, name: string, rules: Partial<StorePartner> = {}) {
  const partner = await StorePartner.create({
    storeId: store.id,
    name,
    commissionType: 'percent',
    commissionValue: 10,
    commissionUpdatedAt: DateTime.now(),
    cancelPolicy: 'until_kitchen',
    catalogMode: 'all',
    ...rules,
  })
  const person = await createUser({ name: `${name} (pessoa)` })
  await store
    .related('users')
    .attach({ [person.id]: { role: StoreRole.PARTNER, partner_id: partner.id } })
  return { partner, person }
}

test.group('Partners (ADR 0024)', (group) => {
  let fake: FakePoint
  group.each.setup(() => {
    fakeQueue()
  })
  group.each.setup(() => {
    fake = new FakePoint()
    app.container.swap(MercadoPagoClient, () => fake)
    return () => app.container.restore(MercadoPagoClient)
  })
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  /** Turns the second machine on and lends it to the partner. */
  async function lendMachine(client: ApiClient, menu: Menu, manager: User, partnerId: string) {
    const base = `/api/v1/stores/${menu.store.id}/point/terminals`
    for (const [terminalId, name] of [
      [BALCAO, 'Balcão'],
      [RESERVA, 'Açaí'],
    ]) {
      const enabled = await client.post(base).json({ terminalId, name }).loginAs(manager)
      enabled.assertStatus(200)
    }
    const lent = await client.put(`${base}/${RESERVA}/partner`).json({ partnerId }).loginAs(manager)
    lent.assertStatus(200)
  }

  async function sell(client: ApiClient, menu: Menu, person: User, quantity = 2) {
    const response = await client
      .post(`/api/v1/stores/${menu.store.id}/partner/orders`)
      .json({
        customer: { name: 'Cliente da Praça', phone: '11987654321' },
        lines: [{ itemId: menu.carne.id, quantity }],
      })
      .loginAs(person)
    response.assertStatus(200)
    return response.body().data as { id: string; number: number; commissionAmount: number }
  }

  /** Charges the order on the partner's machine and approves it there. */
  async function payOnMachine(client: ApiClient, menu: Menu, person: User, orderId: string) {
    const charged = await client
      .post(`/api/v1/stores/${menu.store.id}/partner/orders/${orderId}/point-charges`)
      .json({ paymentType: 'debit_card' })
      .loginAs(person)
    charged.assertStatus(200)
    const id = [...fake.orders.keys()].at(-1)!
    fake.set(id, 'processed', 'accredited')
    const webhook = await client
      .post(`/api/v1/webhooks/mercado-pago/${menu.store.id}`)
      .header('x-signature', signature(id, `req-${id}`))
      .header('x-request-id', `req-${id}`)
      .json({ type: 'order', action: 'order.processed', data: { id } })
    webhook.assertStatus(200)
    return charged.body().data as { terminalId: string }
  }

  async function prepareAll(client: ApiClient, menu: Menu, cook: User, orderId: string) {
    const order = await Order.query().where('id', orderId).preload('items').firstOrFail()
    const response = await client
      .post(`/api/v1/stores/${menu.store.id}/kitchen/prepare`)
      .json({
        units: order.items.map((item) => ({ lineId: item.id, quantity: item.quantity })),
      })
      .loginAs(cook)
    response.assertStatus(200)
  }

  test('managers create and change partners; nobody else can', async ({ client, assert }) => {
    const { store, manager, attendant } = await partnerStore()
    const other = await partnerStore()
    const base = `/api/v1/stores/${store.id}/partners`

    const made = await client
      .post(base)
      .json({
        ...partnerInput,
        name: 'Banca do Zé',
        commissionType: 'per_unit',
        commissionValue: 1.5,
      })
      .loginAs(manager)
    const byAttendant = await client.post(base).json(partnerInput).loginAs(attendant)
    const byOtherStore = await client.get(base).loginAs(other.manager)
    const tooMuch = await client
      .post(base)
      .json({ ...partnerInput, name: 'Outra', commissionValue: 120 })
      .loginAs(manager)
    const taken = await client
      .post(base)
      .json({ ...partnerInput, name: 'açaí da praça' })
      .loginAs(manager)

    made.assertStatus(200)
    made.assertBodyContains({
      data: { name: 'Banca do Zé', commissionType: 'per_unit', commissionValue: 1.5 },
    })
    byAttendant.assertStatus(403)
    byOtherStore.assertStatus(403)
    tooMuch.assertStatus(422)
    taken.assertStatus(409)

    const list = await client.get(base).loginAs(manager)
    assert.deepEqual(
      list.body().data.map((partner: { name: string }) => partner.name),
      ['Açaí da Praça', 'Banca do Zé']
    )
  })

  test('a partner is invited with the partner created in the same go', async ({
    client,
    assert,
  }) => {
    const { store, manager } = await partnerStore()
    mail.fake()
    const base = `/api/v1/stores/${store.id}/members`

    const invited = await client
      .post(base)
      .json({
        email: 'maria@acai.example.com',
        role: 'partner',
        newPartner: { ...partnerInput, name: 'Açaí da Maria' },
      })
      .loginAs(manager)
    const withoutPartner = await client
      .post(base)
      .json({ email: 'ze@example.com', role: 'partner' })
      .loginAs(manager)

    invited.assertStatus(200)
    withoutPartner.assertStatus(422)
    withoutPartner.assertBodyContains({ code: 'E_PARTNER_REQUIRED' })
    const members = await client.get(base).loginAs(manager)
    const maria = members
      .body()
      .data.find((member: { email: string }) => member.email === 'maria@acai.example.com')
    assert.equal(maria.role, 'partner')
    assert.equal(maria.partner.name, 'Açaí da Maria')
    mail.restore()
  })

  test('partners only reach the partner area, and only partners do', async ({
    client,
    cleanup,
  }) => {
    const { store, manager, person, partner } = await partnerStore()
    const other = await addPartner(store, 'Outro parceiro')

    for (const path of ['orders', 'customers', 'dashboard/today', 'categories', '', 'point']) {
      const response = await client.get(`/api/v1/stores/${store.id}/${path}`).loginAs(person)
      response.assertStatus(403)
    }
    const managerInPartnerArea = await client
      .get(`/api/v1/stores/${store.id}/partner/context`)
      .loginAs(manager)
    managerInPartnerArea.assertStatus(403)

    const subscribe = (user: User, channel: string) =>
      client
        .post('/__transmit/subscribe')
        .json({ uid: openStream(cleanup), channel })
        .loginAs(user)
    const storeChannel = await subscribe(person, `stores/${store.id}`)
    const own = await subscribe(person, `stores/${store.id}/partners/${partner.id}`)
    const someoneElses = await subscribe(person, `stores/${store.id}/partners/${other.partner.id}`)
    const managers = await subscribe(manager, `stores/${store.id}/partners/${partner.id}`)
    storeChannel.assertStatus(400)
    own.assertStatus(204)
    someoneElses.assertStatus(400)
    managers.assertStatus(204)
  })

  test('the partner sells only what the store allows, while not paused', async ({
    client,
    assert,
  }) => {
    const menu = await partnerStore()
    const { store, manager, person, partner } = menu
    const pastries = menu.carne.categoryId

    const limited = await client
      .put(`/api/v1/stores/${store.id}/partners/${partner.id}/catalog`)
      .json({ mode: 'selected', categoryIds: [pastries], excludedItemIds: [menu.queijo.id] })
      .loginAs(manager)
    limited.assertStatus(200)

    const shown = await client.get(`/api/v1/stores/${store.id}/partner/menu`).loginAs(person)
    const names = shown
      .body()
      .data.categories.flatMap((category: { items: { name: string }[] }) =>
        category.items.map((item) => item.name)
      )
    assert.deepEqual(names, ['Pastel de Carne'])

    const refused = await client
      .post(`/api/v1/stores/${store.id}/partner/orders`)
      .json({ customer: { name: 'Ana' }, lines: [{ itemId: menu.coca.id, quantity: 1 }] })
      .loginAs(person)
    refused.assertStatus(422)
    refused.assertBodyContains({ code: 'E_NOT_FOR_PARTNER' })

    await client
      .put(`/api/v1/stores/${store.id}/partners/${partner.id}/pause`)
      .json({ paused: true })
      .loginAs(manager)
    const paused = await client
      .post(`/api/v1/stores/${store.id}/partner/orders`)
      .json({ customer: { name: 'Ana' }, lines: [{ itemId: menu.carne.id, quantity: 1 }] })
      .loginAs(person)
    paused.assertStatus(409)
    paused.assertBodyContains({ code: 'E_PARTNER_PAUSED' })
  })

  test('sold, paid on the lent machine, made, handed over twice, commission settled', async ({
    client,
    assert,
  }) => {
    const menu = await partnerStore()
    const { store, manager, attendant, cook, person, partner } = menu
    await lendMachine(client, menu, manager, partner.id)

    const order = await sell(client, menu, person)
    // 2 × R$ 15, 10%: kept on the order.
    assert.equal(order.commissionAmount, 3)
    const placed = await Order.findOrFail(order.id)
    assert.equal(placed.status, 'pending_payment')
    assert.equal(placed.channel, 'partner')
    assert.isNull(placed.customerId)
    assert.isNull(await Customer.findBy('phone', '11987654321'))

    // The store's POS doesn't charge partner orders, nor see the lent machine.
    const fromPos = await client
      .post(`/api/v1/stores/${store.id}/orders/${order.id}/point-charges`)
      .json({ paymentType: 'debit_card' })
      .loginAs(attendant)
    fromPos.assertStatus(404)
    const pos = await client.get(`/api/v1/stores/${store.id}/point`).loginAs(attendant)
    assert.deepEqual(
      pos.body().data.terminals.map((terminal: { id: string }) => terminal.id),
      [BALCAO]
    )

    // Nor take it at the counter: the money goes through the partner's machine.
    const base = `/api/v1/stores/${store.id}/orders/${order.id}`
    const cash = await client.post(`${base}/payment`).json({ method: 'cash' }).loginAs(attendant)
    const later = await client.post(`${base}/pay-later`).json({}).loginAs(attendant)
    const more = await client
      .post(`${base}/items`)
      .json({ lines: [{ itemId: menu.coca.id, quantity: 1 }] })
      .loginAs(attendant)
    const dropped = await client.post(`${base}/cancel`).loginAs(attendant)
    for (const response of [cash, later, more]) {
      response.assertStatus(409)
      response.assertBodyContains({ code: 'E_PARTNER_ORDER' })
    }
    dropped.assertStatus(403)

    const charge = await payOnMachine(client, menu, person, order.id)
    assert.equal(charge.terminalId, RESERVA)
    assert.equal(await stored(order.id, 'status'), 'received')

    // The store's board shows whose it is.
    const board = await client.get(`/api/v1/stores/${store.id}/orders`).loginAs(attendant)
    board.assertBodyContains({
      data: [{ id: order.id, partner: { id: partner.id, name: 'Açaí da Praça' } }],
    })

    // The kitchen knows whose it is.
    const queue = await client.get(`/api/v1/stores/${store.id}/kitchen/queue`).loginAs(cook)
    queue.assertBodyContains({
      data: [
        { units: [{ orderId: order.id, partnerName: 'Açaí da Praça', cancelRequested: false }] },
      ],
    })

    await prepareAll(client, menu, cook, order.id)
    const ready = await Notification.query().where({
      userId: person.id,
      type: 'partner.order_ready',
    })
    assert.lengthOf(ready, 1)

    const earlyDeliver = await client
      .post(`/api/v1/stores/${store.id}/partner/orders/${order.id}/deliver`)
      .loginAs(person)
    earlyDeliver.assertStatus(409)

    const handed = await client
      .post(`/api/v1/stores/${store.id}/orders/${order.id}/complete`)
      .loginAs(attendant)
    handed.assertStatus(200)
    const told = await Notification.query().where({
      userId: person.id,
      type: 'partner.order_handed_over',
    })
    assert.lengthOf(told, 1)

    const board2 = await client.get(`/api/v1/stores/${store.id}/partner/orders`).loginAs(person)
    board2.assertBodyContains({
      data: [{ id: order.id, stage: 'with_partner', can: { deliver: true } }],
    })
    const delivered = await client
      .post(`/api/v1/stores/${store.id}/partner/orders/${order.id}/deliver`)
      .loginAs(person)
    const again = await client
      .post(`/api/v1/stores/${store.id}/partner/orders/${order.id}/deliver`)
      .loginAs(person)
    delivered.assertBodyContains({ data: { stage: 'delivered' } })
    again.assertStatus(200)

    const before = await client
      .get(`/api/v1/stores/${store.id}/partner/commissions`)
      .loginAs(person)
    before.assertBodyContains({
      data: {
        rule: { type: 'percent', value: 10 },
        totals: { toReceive: { orders: 1, amount: 3 }, received: { orders: 0, amount: 0 } },
      },
    })

    const businessDate = await stored(order.id, 'businessDate')
    const today = businessDate.toISODate()
    const settled = await client
      .post(`/api/v1/stores/${store.id}/partners/${partner.id}/settlements`)
      .json({ until: today, note: 'Pix' })
      .loginAs(manager)
    settled.assertStatus(200)
    settled.assertBodyContains({ data: { ordersCount: 1, total: 3 } })
    const nothingLeft = await client
      .post(`/api/v1/stores/${store.id}/partners/${partner.id}/settlements`)
      .json({ until: today })
      .loginAs(manager)
    nothingLeft.assertStatus(409)

    const after = await client.get(`/api/v1/stores/${store.id}/partner/commissions`).loginAs(person)
    after.assertBodyContains({
      data: { totals: { toReceive: { orders: 0 }, received: { orders: 1, amount: 3 } } },
    })

    // The managers' table: the period's numbers per partner, filtered and sorted.
    const period = `${today}~${today}`
    const table = await client
      .get(`/api/v1/stores/${store.id}/partners`)
      .qs({ page: 1, perPage: 10, createdAt: period, sort: 'sales:desc', facets: 1 })
      .loginAs(manager)
    table.assertBodyContains({
      data: [
        { id: partner.id, period: { orders: 1, sales: 30, commission: 3 }, toPay: { amount: 0 } },
      ],
      meta: { total: 1, facets: { status: { active: 1 } } },
    })
    const paused = await client
      .get(`/api/v1/stores/${store.id}/partners`)
      .qs({ page: 1, status: 'paused' })
      .loginAs(manager)
    paused.assertBodyContains({ data: [], meta: { total: 0 } })
    const plain = await client.get(`/api/v1/stores/${store.id}/partners`).loginAs(manager)
    plain.assertBodyContains({ data: [{ id: partner.id, name: 'Açaí da Praça' }] })

    // The overview: the period against the one before, day by day.
    const stats = await client
      .get(`/api/v1/stores/${store.id}/partners/${partner.id}/stats`)
      .qs({ from: today, to: today })
      .loginAs(manager)
    stats.assertBodyContains({
      data: {
        current: { orders: 1, sales: 30, commission: 3, averageTicket: 30 },
        previous: { orders: 0 },
        daily: [{ date: today, orders: 1, sales: 30, commission: 3 }],
        totals: { received: { orders: 1 } },
      },
    })

    // The sales table: by where the commission is, with its counts.
    const sales = await client
      .get(`/api/v1/stores/${store.id}/partners/${partner.id}/sales`)
      .qs({ page: 1, createdAt: period, settlement: 'paid', facets: 1 })
      .loginAs(manager)
    sales.assertBodyContains({
      data: [{ id: order.id, settlement: 'paid', commissionAmount: 3 }],
      meta: { total: 1, commissionTotal: 3, facets: { settlement: { paid: 1 } } },
    })
    const toPay = await client
      .get(`/api/v1/stores/${store.id}/partners/${partner.id}/sales`)
      .qs({ page: 1, settlement: 'to_pay' })
      .loginAs(manager)
    toPay.assertBodyContains({ data: [], meta: { total: 0 } })

    // Another store's manager sees none of it.
    const other = await partnerStore()
    for (const path of [
      `partners/${partner.id}/stats?from=${today}&to=${today}`,
      `partners/${partner.id}/sales?page=1`,
    ]) {
      const response = await client.get(`/api/v1/stores/${store.id}/${path}`).loginAs(other.manager)
      response.assertStatus(403)
    }
    const byAttendant = await client
      .get(`/api/v1/stores/${store.id}/partners/${partner.id}/stats?from=${today}&to=${today}`)
      .loginAs(attendant)
    byAttendant.assertStatus(403)

    const undone = await client
      .delete(
        `/api/v1/stores/${store.id}/partners/${partner.id}/settlements/${settled.body().data.id}`
      )
      .loginAs(manager)
    undone.assertStatus(200)
    assert.isNull(await stored(order.id, 'partnerSettlementId'))
  })

  test('a new commission rule applies to new orders and the partner is told', async ({
    client,
    assert,
  }) => {
    const menu = await partnerStore()
    const { store, manager, person, partner } = menu
    const first = await sell(client, menu, person)

    const changed = await client
      .put(`/api/v1/stores/${store.id}/partners/${partner.id}`)
      .json({ ...partnerInput, commissionType: 'per_unit', commissionValue: 2 })
      .loginAs(manager)
    changed.assertStatus(200)
    const second = await sell(client, menu, person, 3)

    assert.equal(await stored(first.id, 'commissionAmount'), 3)
    assert.equal(second.commissionAmount, 6)
    const told = await Notification.query().where({
      userId: person.id,
      type: 'partner.commission_changed',
    })
    assert.lengthOf(told, 1)
  })

  test('cancelling within the window; past it a manager answers the request', async ({
    client,
    assert,
  }) => {
    const menu = await partnerStore()
    const { store, manager, attendant, cook, person, partner } = menu
    await lendMachine(client, menu, manager, partner.id)
    const base = `/api/v1/stores/${store.id}/partner/orders`

    // Unpaid: dropped.
    const unpaid = await sell(client, menu, person)
    const dropped = await client.post(`${base}/${unpaid.id}/cancel`).loginAs(person)
    dropped.assertBodyContains({ data: { stage: 'cancelled' } })

    // Paid, kitchen not started (until_kitchen): cancelled and refunded.
    const paid = await sell(client, menu, person)
    await payOnMachine(client, menu, person, paid.id)
    const cancelled = await client.post(`${base}/${paid.id}/cancel`).loginAs(person)
    cancelled.assertBodyContains({ data: { stage: 'cancelled' } })
    await runJob(RefundOrder, { orderId: paid.id })
    assert.lengthOf(fake.refunds, 1)

    // Made: the partner asks.
    const made = await sell(client, menu, person)
    await payOnMachine(client, menu, person, made.id)
    await prepareAll(client, menu, cook, made.id)
    const refused = await client.post(`${base}/${made.id}/cancel`).loginAs(person)
    refused.assertStatus(409)
    refused.assertBodyContains({ code: 'E_CANCEL_REQUIRES_APPROVAL' })

    const asked = await client
      .post(`${base}/${made.id}/cancel-request`)
      .json({ reason: 'Cliente desistiu' })
      .loginAs(person)
    const askedAgain = await client
      .post(`${base}/${made.id}/cancel-request`)
      .json({ reason: 'Cliente desistiu' })
      .loginAs(person)
    asked.assertBodyContains({ data: { cancelRequest: { status: 'pending' } } })
    askedAgain.assertStatus(200)
    const managersTold = await Notification.query().where({
      userId: manager.id,
      type: 'order.cancel_requested',
    })
    assert.lengthOf(managersTold, 1)
    const attendantsTold = await Notification.query().where({
      userId: attendant.id,
      type: 'order.cancel_requested',
    })
    assert.lengthOf(attendantsTold, 0)

    // The counter can't hand it over meanwhile.
    const handOver = await client
      .post(`/api/v1/stores/${store.id}/orders/${made.id}/complete`)
      .loginAs(attendant)
    handOver.assertStatus(409)
    handOver.assertBodyContains({ code: 'E_CANCEL_REQUESTED' })

    const pending = await client.get(`/api/v1/stores/${store.id}/cancel-requests`).loginAs(manager)
    const requestId = pending.body().data[0].id
    const byAttendant = await client
      .post(`/api/v1/stores/${store.id}/orders/${made.id}/cancel-requests/${requestId}/reject`)
      .json({})
      .loginAs(attendant)
    byAttendant.assertStatus(403)
    const rejected = await client
      .post(`/api/v1/stores/${store.id}/orders/${made.id}/cancel-requests/${requestId}/reject`)
      .json({ note: 'Já está pronto, vamos entregar' })
      .loginAs(manager)
    rejected.assertBodyContains({ data: { status: 'rejected' } })
    const partnerTold = await Notification.query().where({
      userId: person.id,
      type: 'order.cancel_decided',
    })
    assert.lengthOf(partnerTold, 1)

    // Asked again, approved: cancelled and refunded.
    const second = await client
      .post(`${base}/${made.id}/cancel-request`)
      .json({ reason: 'Cliente foi embora' })
      .loginAs(person)
    const secondId = second.body().data.cancelRequest.id
    const approved = await client
      .post(`/api/v1/stores/${store.id}/orders/${made.id}/cancel-requests/${secondId}/approve`)
      .json({})
      .loginAs(manager)
    approved.assertBodyContains({ data: { status: 'approved' } })
    assert.equal(await stored(made.id, 'status'), 'cancelled')
  })

  test("a partner never sees nor charges another partner's orders", async ({ client }) => {
    const menu = await partnerStore()
    const { store, person } = menu
    const other = await addPartner(store, 'Banca do Zé')
    const order = await sell(client, menu, person)

    const shown = await client
      .get(`/api/v1/stores/${store.id}/partner/orders/${order.id}`)
      .loginAs(other.person)
    const charged = await client
      .post(`/api/v1/stores/${store.id}/partner/orders/${order.id}/point-charges`)
      .json({ paymentType: 'debit_card' })
      .loginAs(other.person)
    const cancelled = await client
      .post(`/api/v1/stores/${store.id}/partner/orders/${order.id}/cancel`)
      .loginAs(other.person)
    const list = await client.get(`/api/v1/stores/${store.id}/partner/orders`).loginAs(other.person)

    shown.assertStatus(404)
    charged.assertStatus(404)
    cancelled.assertStatus(404)
    list.assertBodyContains({ data: [] })
  })
})
