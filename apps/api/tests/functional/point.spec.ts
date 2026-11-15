import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import type { ApiClient } from '@japa/api-client'
import app from '@adonisjs/core/services/app'
import { createHmac } from 'node:crypto'
import AppException from '#exceptions/app_exception'
import StoreRole from '#enums/store_role'
import Order from '#models/order'
import Payment from '#models/payment'
import type Store from '#models/store'
import MercadoPagoClient, { type MercadoPagoOrder } from '#payments/mercado_pago_client'
import type { MercadoPagoTerminal, PointOrderInput } from '#payments/point'
import { createMenuStore, createUser, linkUser } from '#tests/helpers/fixtures'
import { fakeQueue, runJob } from '#tests/helpers/queue'
import RefundOrder from '#jobs/refund_order'
import RefundDuplicatePayment from '#jobs/refund_duplicate_payment'
import SettlePointCharge from '#jobs/settle_point_charge'
import ExpireUnpaidOrder from '#jobs/expire_unpaid_order'
import Ingredient from '#models/ingredient'
import OrderService from '#services/order_service'
import OrderChannel from '#enums/order_channel'
import PaymentMethod from '#enums/payment_method'

const TOKEN = 'TEST-1234567890-abcdef' // gitleaks:allow (fake test credential)
const SECRET = 'webhook-secret-123'
const BALCAO = 'NEWLAND_N950__N950NCB400655765'
const RESERVA = 'PAX_Q92__Q92-1734068575'

/** Mercado Pago's Point side: machines, charges on them, their outcomes. */
class FakePoint extends MercadoPagoClient {
  terminals: MercadoPagoTerminal[] = [
    { id: BALCAO, pos_id: 1, store_id: '1', operating_mode: 'STANDALONE' },
    { id: RESERVA, pos_id: 1, store_id: '1', operating_mode: 'STANDALONE' },
  ]
  charges: { input: PointOrderInput; idempotencyKey: string }[] = []
  orders = new Map<string, MercadoPagoOrder>()
  refunds: string[] = []
  private next = 2001

  async listTerminals() {
    return this.terminals
  }

  async setTerminalMode(_token: string, terminalId: string, mode: 'PDV' | 'STANDALONE') {
    this.terminals.find((terminal) => terminal.id === terminalId)!.operating_mode = mode
  }

  async createPointOrder(_token: string, input: PointOrderInput, idempotencyKey: string) {
    this.charges.push({ input, idempotencyKey })
    const id = `ORD${this.next++}`
    const order: MercadoPagoOrder = {
      id,
      status: 'created',
      status_detail: 'created',
      external_reference: input.external_reference,
      transactions: { payments: [{ id: `PAY${id}`, status: 'created' }] },
    }
    this.orders.set(id, order)
    return order
  }

  /** What the machine reports: paid, refused, or on its screen. */
  set(id: string, status: string, detail: string) {
    const order = this.orders.get(id)!
    order.status = status
    order.status_detail = detail
    order.transactions!.payments![0].status = status
    order.transactions!.payments![0].status_detail = detail
  }

  async getOrder(_token: string, orderId: string) {
    return this.orders.get(orderId)!
  }

  async cancelOrder(_token: string, orderId: string) {
    const order = this.orders.get(orderId)!
    if (order.status === 'at_terminal') {
      throw new AppException('on the machine', 409, 'E_CANCEL_ON_TERMINAL')
    }
    this.set(orderId, 'canceled', 'canceled_by_api')
    return order
  }

  async refundOrder(_token: string, orderId: string) {
    this.refunds.push(orderId)
  }
}

function signature(dataId: string, requestId: string) {
  const ts = '1700000000'
  const v1 = createHmac('sha256', SECRET)
    .update(`id:${dataId};request-id:${requestId};ts:${ts};`)
    .digest('hex')
  return `ts=${ts},v1=${v1}`
}

/** The order's status as stored now. */
async function statusOf(orderId: string) {
  const order = await Order.findOrFail(orderId)
  return order.status
}

async function pointStore() {
  const menu = await createMenuStore()
  menu.store.merge({ mercadoPagoAccessToken: TOKEN, mercadoPagoWebhookSecret: SECRET })
  await menu.store.save()
  const manager = await createUser()
  const attendant = await createUser()
  await linkUser(menu.store, manager, StoreRole.MANAGER)
  await linkUser(menu.store, attendant, StoreRole.ATTENDANT)
  return { ...menu, manager, attendant }
}

test.group('Mercado Pago Point (card machine)', (group) => {
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

  async function enable(
    client: ApiClient,
    store: Store,
    manager: Awaited<ReturnType<typeof createUser>>
  ) {
    const response = await client
      .post(`/api/v1/stores/${store.id}/point/terminals`)
      .json({ terminalId: BALCAO, name: 'Balcão' })
      .loginAs(manager)
    response.assertStatus(200)
  }

  async function posOrder(
    client: ApiClient,
    store: Store,
    itemId: string,
    user: Awaited<ReturnType<typeof createUser>>
  ) {
    const response = await client
      .post(`/api/v1/stores/${store.id}/orders`)
      .json({ customer: { name: 'Mesa 3' }, lines: [{ itemId, quantity: 2 }] })
      .loginAs(user)
    response.assertStatus(200)
    return response.body().data as { id: string; total: number }
  }

  test('managers list the machines and turn one on (PDV mode); others cannot', async ({
    client,
    assert,
  }) => {
    const { store, manager, attendant } = await pointStore()
    const other = await pointStore()

    const listed = await client.get(`/api/v1/stores/${store.id}/point/terminals`).loginAs(manager)
    const byAttendant = await client
      .post(`/api/v1/stores/${store.id}/point/terminals`)
      .json({ terminalId: BALCAO, name: 'Balcão' })
      .loginAs(attendant)
    const byOtherStore = await client
      .post(`/api/v1/stores/${store.id}/point/terminals`)
      .json({ terminalId: BALCAO, name: 'Balcão' })
      .loginAs(other.manager)
    const unknown = await client
      .post(`/api/v1/stores/${store.id}/point/terminals`)
      .json({ terminalId: 'OTHER__1', name: 'X' })
      .loginAs(manager)
    await enable(client, store, manager)
    const pos = await client.get(`/api/v1/stores/${store.id}/point`).loginAs(attendant)

    listed.assertBodyContains({
      data: [{ id: BALCAO, model: 'NEWLAND N950', serial: 'N950NCB400655765', enabled: false }],
    })
    byAttendant.assertStatus(403)
    assert.include([403, 404], byOtherStore.status())
    unknown.assertStatus(404)
    assert.equal(fake.terminals[0].operating_mode, 'PDV')
    pos.assertBodyContains({
      data: {
        available: true,
        terminals: [{ id: BALCAO, name: 'Balcão' }],
        paymentTypes: ['credit_card', 'debit_card'],
        maxInstallments: 1,
        printTicket: true,
      },
    })
  })

  test('a POS order is charged on the machine; the webhook marks it paid', async ({
    client,
    assert,
  }) => {
    const { store, carne, manager, attendant } = await pointStore()
    await enable(client, store, manager)
    const order = await posOrder(client, store, carne.id, attendant)

    const charged = await client
      .post(`/api/v1/stores/${store.id}/orders/${order.id}/point-charges`)
      .header('idempotency-key', 'pos-key-1')
      .json({ paymentType: 'debit_card' })
      .loginAs(attendant)
    const again = await client
      .post(`/api/v1/stores/${store.id}/orders/${order.id}/point-charges`)
      .json({ paymentType: 'credit_card' })
      .loginAs(attendant)

    charged.assertStatus(200)
    charged.assertBodyContains({ data: { status: 'pending', terminalId: BALCAO } })
    // Charging the same order again picks the waiting charge back up.
    again.assertBodyContains({ data: { id: charged.body().data.id, resumed: true } })
    assert.lengthOf(fake.charges, 1)
    const [sent] = fake.charges
    assert.equal(sent.idempotencyKey, 'pos-key-1')
    assert.equal(sent.input.type, 'point')
    assert.equal(sent.input.transactions.payments[0].amount, (30).toFixed(2))
    assert.deepEqual(sent.input.config, {
      point: { terminal_id: BALCAO, print_on_terminal: 'seller_ticket' },
      payment_method: { default_type: 'debit_card' },
    })
    assert.match(sent.input.external_reference, new RegExp(`^${order.id}_[a-f0-9]{8}$`))

    // The customer pays on the machine; Mercado Pago notifies.
    fake.set('ORD2001', 'processed', 'accredited')
    const webhook = await client
      .post(`/api/v1/webhooks/mercado-pago/${store.id}`)
      .header('x-signature', signature('ORD2001', 'req-1'))
      .header('x-request-id', 'req-1')
      .json({ type: 'order', action: 'order.processed', data: { id: 'ORD2001' } })
    const followed = await client
      .get(`/api/v1/stores/${store.id}/orders/${order.id}/point-charges/${charged.body().data.id}`)
      .loginAs(attendant)

    webhook.assertStatus(200)
    followed.assertBodyContains({ data: { status: 'approved', statusDetail: 'accredited' } })
    const paid = await Order.findOrFail(order.id)
    assert.equal(paid.paymentStatus, 'paid')
    assert.equal(paid.paymentMethod, 'point')
    assert.equal(paid.status, 'received')

    // Cancelled after paying on the machine: refunded by itself.
    await client.post(`/api/v1/stores/${store.id}/orders/${order.id}/cancel`).loginAs(manager)
    await runJob(RefundOrder, { orderId: order.id })
    assert.deepEqual(fake.refunds, ['ORD2001'])
  })

  test('items added after paying on the machine: charged there too, only the difference', async ({
    client,
    assert,
  }) => {
    const { store, carne, coca, manager, attendant } = await pointStore()
    await enable(client, store, manager)
    const order = await posOrder(client, store, carne.id, attendant)
    const base = `/api/v1/stores/${store.id}/orders/${order.id}`
    const notify = (id: string, requestId: string) =>
      client
        .post(`/api/v1/webhooks/mercado-pago/${store.id}`)
        .header('x-signature', signature(id, requestId))
        .header('x-request-id', requestId)
        .json({ type: 'order', action: 'order.processed', data: { id } })

    await client
      .post(`${base}/point-charges`)
      .json({ paymentType: 'debit_card' })
      .loginAs(attendant)
    fake.set('ORD2001', 'processed', 'accredited')
    await notify('ORD2001', 'req-1')

    // A drink more, left to receive: the machine charges only it.
    const added = await client
      .post(`${base}/items`)
      .json({ lines: [{ itemId: coca.id, quantity: 1 }] })
      .loginAs(attendant)
    added.assertBodyContains({ data: { total: 36, amountDue: 6, paymentStatus: 'pending' } })
    await client
      .post(`${base}/point-charges`)
      .json({ paymentType: 'debit_card' })
      .loginAs(attendant)
    assert.equal(fake.charges[1].input.transactions.payments[0].amount, (6).toFixed(2))

    // While it waits on the machine, nothing else is added (it was sent for 6).
    const blocked = await client
      .post(`${base}/items`)
      .json({ lines: [{ itemId: coca.id, quantity: 1 }] })
      .loginAs(attendant)
    blocked.assertStatus(409)
    blocked.assertBodyContains({ code: 'E_CHARGE_WAITING' })

    fake.set('ORD2002', 'processed', 'accredited')
    await notify('ORD2002', 'req-2')
    // Mercado Pago tells of the first approval again: still the order's, not a duplicate.
    await notify('ORD2001', 'req-3')

    const paid = await Order.findOrFail(order.id)
    assert.equal(paid.paymentStatus, 'paid')
    assert.equal(paid.amountPaid, 36)
    assert.deepEqual(fake.refunds, [])
    const approved = await Payment.query().where('orderId', order.id).where('status', 'approved')
    assert.lengthOf(approved, 2)

    // Cancelled: both charges go back.
    await client.post(`${base}/cancel`).loginAs(manager)
    await runJob(RefundOrder, { orderId: order.id })
    assert.sameMembers(fake.refunds, ['ORD2001', 'ORD2002'])
  })

  test('a refused card leaves the order to be paid; it can be charged again', async ({
    client,
    assert,
  }) => {
    const { store, carne, manager, attendant } = await pointStore()
    await enable(client, store, manager)
    const order = await posOrder(client, store, carne.id, attendant)
    const first = await client
      .post(`/api/v1/stores/${store.id}/orders/${order.id}/point-charges`)
      .json({ paymentType: 'debit_card' })
      .loginAs(attendant)

    // No webhook here (it can't reach a development machine): the POS asks.
    fake.set('ORD2001', 'failed', 'insufficient_amount')
    const checked = await client
      .get(
        `/api/v1/stores/${store.id}/orders/${order.id}/point-charges/${first.body().data.id}?check=1`
      )
      .loginAs(attendant)
    const second = await client
      .post(`/api/v1/stores/${store.id}/orders/${order.id}/point-charges`)
      .json({ paymentType: 'credit_card' })
      .loginAs(attendant)

    checked.assertBodyContains({
      data: { status: 'rejected', statusDetail: 'insufficient_amount' },
    })
    second.assertStatus(200)
    const unpaid = await Order.findOrFail(order.id)
    assert.equal(unpaid.paymentStatus, 'pending')
    assert.equal(unpaid.paymentMethod, 'counter')
  })

  test('kitchen after payment: a POS order charged on the machine waits for the approval', async ({
    client,
    assert,
  }) => {
    const { store, carne, manager, attendant } = await pointStore()
    await enable(client, store, manager)
    const off = await client.get(`/api/v1/stores/${store.id}/point`).loginAs(attendant)
    const turnedOn = await client
      .put(`/api/v1/stores/${store.id}/point/settings`)
      .json({
        paymentTypes: ['credit_card', 'debit_card'],
        maxInstallments: 1,
        printTicket: true,
        kitchenAfterPayment: true,
      })
      .loginAs(manager)
    off.assertBodyContains({ data: { kitchenAfterPayment: false } })
    turnedOn.assertBodyContains({ data: { kitchenAfterPayment: true } })

    const create = (payOnMachine?: boolean) =>
      client
        .post(`/api/v1/stores/${store.id}/orders`)
        .json({
          customer: { name: 'Mesa 3' },
          lines: [{ itemId: carne.id, quantity: 2 }],
          payOnMachine,
        })
        .loginAs(attendant)
    const held = await create(true)
    // "Receber depois" still goes at once.
    const later = await create()
    held.assertBodyContains({ data: { status: 'pending_payment', paymentStatus: 'pending' } })
    later.assertBodyContains({ data: { status: 'received' } })
    const heldId = held.body().data.id as string

    const queue = async () => {
      const response = await client.get(`/api/v1/stores/${store.id}/kitchen/queue`).loginAs(manager)
      return response.body().data
    }
    assert.notInclude(JSON.stringify(await queue()), heldId)

    await client
      .post(`/api/v1/stores/${store.id}/orders/${heldId}/point-charges`)
      .json({ paymentType: 'debit_card' })
      .loginAs(attendant)
    fake.set('ORD2001', 'processed', 'accredited')
    await client
      .post(`/api/v1/webhooks/mercado-pago/${store.id}`)
      .header('x-signature', signature('ORD2001', 'req-1'))
      .header('x-request-id', 'req-1')
      .json({ type: 'order', action: 'order.processed', data: { id: 'ORD2001' } })

    const paid = await Order.findOrFail(heldId)
    assert.equal(paid.status, 'received')
    assert.equal(paid.paymentStatus, 'paid')
    assert.include(JSON.stringify(await queue()), heldId)
  })

  test('kitchen after payment off: the machine order goes at once, as before', async ({
    client,
  }) => {
    const { store, carne, manager, attendant } = await pointStore()
    await enable(client, store, manager)
    const order = await client
      .post(`/api/v1/stores/${store.id}/orders`)
      .json({
        customer: { name: 'Mesa 3' },
        lines: [{ itemId: carne.id, quantity: 1 }],
        payOnMachine: true,
      })
      .loginAs(attendant)
    order.assertBodyContains({ data: { status: 'received' } })
  })

  test('kitchen after payment: a refused card leaves it waiting; received, discarded or expired', async ({
    client,
    assert,
  }) => {
    const { store, carne, manager, attendant } = await pointStore()
    const other = await pointStore()
    await enable(client, store, manager)
    store.pointKitchenAfterPayment = true
    await store.save()
    const create = async () => {
      const response = await client
        .post(`/api/v1/stores/${store.id}/orders`)
        .json({
          customer: { name: 'Mesa 3' },
          lines: [{ itemId: carne.id, quantity: 1 }],
          payOnMachine: true,
        })
        .loginAs(attendant)
      return response.body().data.id as string
    }
    const refuse = async (orderId: string, mercadoPagoId: string) => {
      const charge = await client
        .post(`/api/v1/stores/${store.id}/orders/${orderId}/point-charges`)
        .json({ paymentType: 'debit_card' })
        .loginAs(attendant)
      fake.set(mercadoPagoId, 'failed', 'insufficient_amount')
      await client
        .get(
          `/api/v1/stores/${store.id}/orders/${orderId}/point-charges/${charge.body().data.id}?check=1`
        )
        .loginAs(attendant)
    }

    // Paid in cash after the card was refused: now it goes to the kitchen.
    const cash = await create()
    await refuse(cash, 'ORD2001')
    assert.equal(await statusOf(cash), 'pending_payment')
    const received = await client
      .post(`/api/v1/stores/${store.id}/orders/${cash}/payment`)
      .json({ method: 'cash', amount: 15 })
      .loginAs(attendant)
    received.assertStatus(200)
    assert.equal(await statusOf(cash), 'received')

    // Dropped by the attendant (not while a charge waits on the machine).
    const dropped = await create()
    await client
      .post(`/api/v1/stores/${store.id}/orders/${dropped}/point-charges`)
      .json({ paymentType: 'debit_card' })
      .loginAs(attendant)
    const whileWaiting = await client
      .post(`/api/v1/stores/${store.id}/orders/${dropped}/cancel`)
      .loginAs(attendant)
    whileWaiting.assertStatus(409)
    whileWaiting.assertBodyContains({ code: 'E_CHARGE_WAITING' })
    fake.set('ORD2002', 'failed', 'insufficient_amount')
    const charge = await Payment.query().where('orderId', dropped).firstOrFail()
    await client
      .get(`/api/v1/stores/${store.id}/orders/${dropped}/point-charges/${charge.id}?check=1`)
      .loginAs(attendant)
    const byOtherStore = await client
      .post(`/api/v1/stores/${store.id}/orders/${dropped}/cancel`)
      .loginAs(other.attendant)
    const discarded = await client
      .post(`/api/v1/stores/${store.id}/orders/${dropped}/cancel`)
      .loginAs(attendant)
    assert.include([403, 404], byOtherStore.status())
    discarded.assertStatus(200)
    assert.equal(await statusOf(dropped), 'cancelled')

    // An order already in the kitchen stays the managers' to cancel.
    const inKitchen = await client
      .post(`/api/v1/stores/${store.id}/orders/${cash}/cancel`)
      .loginAs(attendant)
    inKitchen.assertStatus(403)
    inKitchen.assertBodyContains({ code: 'E_NOT_DISCARDABLE' })
    assert.equal(await statusOf(cash), 'received')

    // Left alone: cancelled by the unpaid-order expiry.
    const forgotten = await create()
    await refuse(forgotten, 'ORD2003')
    await runJob(ExpireUnpaidOrder, { orderId: forgotten })
    assert.equal(await statusOf(forgotten), 'cancelled')
  })

  test('kitchen after payment: the stock is checked before charging; attendants never drop online orders', async ({
    client,
    assert,
  }) => {
    const { store, carne, manager, attendant } = await pointStore()
    await enable(client, store, manager)
    store.merge({ pointKitchenAfterPayment: true, inventoryEnabled: true })
    await store.save()
    const ovo = await Ingredient.create({
      storeId: store.id,
      name: 'Ovo',
      unit: 'un',
      stockQuantity: 1,
      minStock: 0,
    })
    await carne.related('ingredients').attach({ [ovo.id]: { quantity: 1 } })

    // Held for the machine (its egg isn't taken yet)…
    const held = await client
      .post(`/api/v1/stores/${store.id}/orders`)
      .json({
        customer: { name: 'Mesa 3' },
        lines: [{ itemId: carne.id, quantity: 1 }],
        payOnMachine: true,
      })
      .loginAs(attendant)
    // …meanwhile the counter sells the last egg.
    const sold = await client
      .post(`/api/v1/stores/${store.id}/orders`)
      .json({
        customer: { name: 'Balcão' },
        lines: [{ itemId: carne.id, quantity: 1 }],
        counterMethod: 'cash',
      })
      .loginAs(attendant)
    const charge = await client
      .post(`/api/v1/stores/${store.id}/orders/${held.body().data.id}/point-charges`)
      .json({ paymentType: 'debit_card' })
      .loginAs(attendant)
    sold.assertStatus(200)
    charge.assertStatus(422)
    charge.assertBodyContains({ code: 'E_OUT_OF_STOCK' })
    assert.lengthOf(fake.charges, 0, 'nothing sent to the machine')

    // An online order waiting for the customer's Pix is the managers' to cancel.
    await ovo.merge({ stockQuantity: 5 }).save()
    const orders = await app.container.make(OrderService)
    const online = await orders.create(store.id, {
      channel: OrderChannel.ONLINE,
      paymentMethod: PaymentMethod.PIX,
      customer: { name: 'Ana', phone: '13999990000' },
      lines: [{ itemId: carne.id, quantity: 1 }],
    })
    const byAttendant = await client
      .post(`/api/v1/stores/${store.id}/orders/${online.id}/cancel`)
      .loginAs(attendant)
    byAttendant.assertStatus(403)
    assert.equal(await statusOf(online.id), 'pending_payment')
  })

  test('a charge is cancelled from the POS, or on the machine once it is there', async ({
    client,
    assert,
  }) => {
    const { store, carne, queijo, manager, attendant } = await pointStore()
    await enable(client, store, manager)
    const order = await posOrder(client, store, carne.id, attendant)
    const charge = await client
      .post(`/api/v1/stores/${store.id}/orders/${order.id}/point-charges`)
      .json({ paymentType: 'credit_card' })
      .loginAs(attendant)
    const cancelled = await client
      .post(
        `/api/v1/stores/${store.id}/orders/${order.id}/point-charges/${charge.body().data.id}/cancel`
      )
      .loginAs(attendant)

    const other = await posOrder(client, store, queijo.id, attendant)
    const onMachine = await client
      .post(`/api/v1/stores/${store.id}/orders/${other.id}/point-charges`)
      .json({ paymentType: 'credit_card' })
      .loginAs(attendant)
    fake.set('ORD2002', 'at_terminal', 'at_terminal')
    const refused = await client
      .post(
        `/api/v1/stores/${store.id}/orders/${other.id}/point-charges/${onMachine.body().data.id}/cancel`
      )
      .loginAs(attendant)

    cancelled.assertBodyContains({ data: { status: 'expired', statusDetail: 'canceled_by_api' } })
    refused.assertStatus(409)
    refused.assertBodyContains({ code: 'E_CANCEL_ON_TERMINAL' })
    const stillWaiting = await Payment.findOrFail(onMachine.body().data.id)
    assert.equal(stillWaiting.status, 'pending')
  })

  test('the machine takes one charge at a time; the POS lists the waiting ones', async ({
    client,
    assert,
  }) => {
    const { store, carne, queijo, manager, attendant } = await pointStore()
    await enable(client, store, manager)
    const first = await posOrder(client, store, carne.id, attendant)
    const second = await posOrder(client, store, queijo.id, attendant)
    const charge = await client
      .post(`/api/v1/stores/${store.id}/orders/${first.id}/point-charges`)
      .json({ paymentType: 'credit_card' })
      .loginAs(attendant)

    const busy = await client
      .post(`/api/v1/stores/${store.id}/orders/${second.id}/point-charges`)
      .json({ paymentType: 'credit_card' })
      .loginAs(attendant)
    const waiting = await client.get(`/api/v1/stores/${store.id}/point/charges`).loginAs(attendant)

    busy.assertStatus(409)
    busy.assertBodyContains({
      code: 'E_TERMINAL_BUSY',
      details: { orderId: first.id, paymentId: charge.body().data.id },
    })
    waiting.assertBodyContains({
      data: [{ id: charge.body().data.id, terminalName: 'Balcão', order: { id: first.id } }],
    })
    assert.lengthOf(waiting.body().data, 1)

    // Paid on the machine without a webhook: the next charge reads it and goes through.
    fake.set('ORD2001', 'processed', 'accredited')
    const freed = await client
      .post(`/api/v1/stores/${store.id}/orders/${second.id}/point-charges`)
      .json({ paymentType: 'credit_card' })
      .loginAs(attendant)
    freed.assertStatus(200)
    const paidFirst = await Order.findOrFail(first.id)
    assert.equal(paidFirst.paymentStatus, 'paid')
  })

  test('a charge approved after the order was paid another way is refunded', async ({
    client,
    assert,
  }) => {
    const { store, carne, manager, attendant } = await pointStore()
    await enable(client, store, manager)
    const order = await posOrder(client, store, carne.id, attendant)
    const charge = await client
      .post(`/api/v1/stores/${store.id}/orders/${order.id}/point-charges`)
      .json({ paymentType: 'credit_card' })
      .loginAs(attendant)
    // Paid in cash meanwhile, then the customer also pays on the machine.
    await client
      .post(`/api/v1/stores/${store.id}/orders/${order.id}/payment`)
      .json({ method: 'cash' })
      .loginAs(attendant)
    fake.set('ORD2001', 'processed', 'accredited')
    for (const requestId of ['req-1', 'req-2']) {
      await client
        .post(`/api/v1/webhooks/mercado-pago/${store.id}`)
        .header('x-signature', signature('ORD2001', requestId))
        .header('x-request-id', requestId)
        .json({ type: 'order', action: 'order.processed', data: { id: 'ORD2001' } })
    }
    await runJob(RefundDuplicatePayment, { paymentId: charge.body().data.id })

    assert.deepEqual(fake.refunds, ['ORD2001'])
    const payment = await Payment.findOrFail(charge.body().data.id)
    assert.equal(payment.status, 'refunded')
    const paid = await Order.findOrFail(order.id)
    assert.equal(paid.paymentStatus, 'paid')
    assert.equal(paid.paymentMethod, 'counter')
  })

  test('not handed over while the machine charges: its approval pays it, then it goes', async ({
    client,
    assert,
  }) => {
    const { store, coca, manager, attendant } = await pointStore()
    await enable(client, store, manager)
    const order = await posOrder(client, store, coca.id, attendant)
    await client
      .post(`/api/v1/stores/${store.id}/orders/${order.id}/point-charges`)
      .json({ paymentType: 'debit_card' })
      .loginAs(attendant)

    // Drinks only: ready at once, but not handed over before the machine answers.
    const early = await client
      .post(`/api/v1/stores/${store.id}/orders/${order.id}/complete`)
      .loginAs(attendant)
    early.assertStatus(409)
    early.assertBodyContains({ code: 'E_PAYMENT_REQUIRED' })
    const waiting = await Order.findOrFail(order.id)
    assert.equal(waiting.status, 'ready')
    assert.equal(waiting.paymentStatus, 'pending')

    fake.set('ORD2001', 'processed', 'accredited')
    await client
      .post(`/api/v1/webhooks/mercado-pago/${store.id}`)
      .header('x-signature', signature('ORD2001', 'req-1'))
      .header('x-request-id', 'req-1')
      .json({ type: 'order', action: 'order.processed', data: { id: 'ORD2001' } })

    const paid = await Order.findOrFail(order.id)
    assert.equal(paid.paymentStatus, 'paid')
    assert.equal(paid.paymentMethod, 'point')
    assert.deepEqual(fake.refunds, [])
    const handedOver = await client
      .post(`/api/v1/stores/${store.id}/orders/${order.id}/complete`)
      .loginAs(attendant)
    handedOver.assertStatus(200)
  })

  test('a charge paid without a webhook: charging again is refused, not sent twice', async ({
    client,
    assert,
  }) => {
    const { store, carne, manager, attendant } = await pointStore()
    await enable(client, store, manager)
    const order = await posOrder(client, store, carne.id, attendant)
    await client
      .post(`/api/v1/stores/${store.id}/orders/${order.id}/point-charges`)
      .json({ paymentType: 'credit_card' })
      .loginAs(attendant)
    fake.set('ORD2001', 'processed', 'accredited')

    const again = await client
      .post(`/api/v1/stores/${store.id}/orders/${order.id}/point-charges`)
      .json({ paymentType: 'credit_card' })
      .loginAs(attendant)

    again.assertStatus(409)
    again.assertBodyContains({ code: 'E_NOT_PAYABLE' })
    assert.lengthOf(fake.charges, 1)
    const paid = await Order.findOrFail(order.id)
    assert.equal(paid.paymentStatus, 'paid')
  })

  test('when a charge runs out of time it is read once more, then closed', async ({
    client,
    assert,
  }) => {
    const { store, carne, queijo, manager, attendant } = await pointStore()
    await enable(client, store, manager)
    const paidLate = await posOrder(client, store, carne.id, attendant)
    const forgotten = await posOrder(client, store, queijo.id, attendant)
    const first = await client
      .post(`/api/v1/stores/${store.id}/orders/${paidLate.id}/point-charges`)
      .json({ paymentType: 'credit_card' })
      .loginAs(attendant)
    // The webhook was lost: the deadline job finds the payment.
    fake.set('ORD2001', 'processed', 'accredited')
    await runJob(SettlePointCharge, { paymentId: first.body().data.id })
    const second = await client
      .post(`/api/v1/stores/${store.id}/orders/${forgotten.id}/point-charges`)
      .json({ paymentType: 'credit_card' })
      .loginAs(attendant)
    await runJob(SettlePointCharge, { paymentId: second.body().data.id })

    const late = await Order.findOrFail(paidLate.id)
    assert.equal(late.paymentStatus, 'paid')
    const closed = await Payment.findOrFail(second.body().data.id)
    assert.equal(closed.status, 'expired')
  })

  test('cancelling the order takes its charge off the machine', async ({ client, assert }) => {
    const { store, carne, manager, attendant } = await pointStore()
    await enable(client, store, manager)
    const order = await posOrder(client, store, carne.id, attendant)
    const charge = await client
      .post(`/api/v1/stores/${store.id}/orders/${order.id}/point-charges`)
      .json({ paymentType: 'credit_card' })
      .loginAs(attendant)

    await client.post(`/api/v1/stores/${store.id}/orders/${order.id}/cancel`).loginAs(manager)

    const cancelled = await Payment.findOrFail(charge.body().data.id)
    assert.equal(cancelled.status, 'expired')
    assert.equal(fake.orders.get('ORD2001')!.status, 'canceled')
  })

  test("another store's staff can't charge, follow or cancel this store's charges", async ({
    client,
    assert,
  }) => {
    const { store, carne, manager, attendant } = await pointStore()
    const other = await pointStore()
    await enable(client, store, manager)
    const order = await posOrder(client, store, carne.id, attendant)
    const charge = await client
      .post(`/api/v1/stores/${store.id}/orders/${order.id}/point-charges`)
      .json({ paymentType: 'credit_card' })
      .loginAs(attendant)
    const base = `/api/v1/stores/${store.id}/orders/${order.id}/point-charges`
    const id = charge.body().data.id

    const attempts = [
      await client.post(base).json({ paymentType: 'credit_card' }).loginAs(other.manager),
      await client.get(`${base}/${id}`).loginAs(other.manager),
      await client.post(`${base}/${id}/cancel`).loginAs(other.manager),
      await client.post(`${base}/${id}/simulate`).json({ approve: true }).loginAs(other.manager),
      await client.get(`/api/v1/stores/${store.id}/point/charges`).loginAs(other.manager),
      await client.get(`/api/v1/stores/${store.id}/point`).loginAs(other.manager),
    ]
    // Through the other store's own path, this store's order isn't found either.
    const throughOwnStore = await client
      .get(`/api/v1/stores/${other.store.id}/orders/${order.id}/point-charges/${id}`)
      .loginAs(other.manager)

    for (const response of attempts) assert.include([403, 404], response.status())
    throughOwnStore.assertStatus(404)
    const untouched = await Payment.findOrFail(id)
    assert.equal(untouched.status, 'pending')
  })

  test('the store settings bound what the POS may send', async ({ client }) => {
    const { store, carne, manager, attendant } = await pointStore()
    await enable(client, store, manager)
    const order = await posOrder(client, store, carne.id, attendant)

    const qrOff = await client
      .post(`/api/v1/stores/${store.id}/orders/${order.id}/point-charges`)
      .json({ paymentType: 'qr' })
      .loginAs(attendant)
    const tooMany = await client
      .post(`/api/v1/stores/${store.id}/orders/${order.id}/point-charges`)
      .json({ paymentType: 'credit_card', installments: 3 })
      .loginAs(attendant)
    const settings = await client
      .put(`/api/v1/stores/${store.id}/point/settings`)
      .json({
        paymentTypes: ['credit_card', 'debit_card', 'qr'],
        maxInstallments: 3,
        printTicket: false,
      })
      .loginAs(manager)
    const settingsByAttendant = await client
      .put(`/api/v1/stores/${store.id}/point/settings`)
      .json({ paymentTypes: ['qr'], maxInstallments: 1, printTicket: true })
      .loginAs(attendant)
    const allowed = await client
      .post(`/api/v1/stores/${store.id}/orders/${order.id}/point-charges`)
      .json({ paymentType: 'credit_card', installments: 3 })
      .loginAs(attendant)

    qrOff.assertStatus(422)
    tooMany.assertStatus(422)
    settings.assertBodyContains({ data: { maxInstallments: 3, printTicket: false } })
    settingsByAttendant.assertStatus(403)
    allowed.assertStatus(200)
  })

  test('no machine on, or a paid order: nothing is sent', async ({ client, assert }) => {
    const { store, carne, attendant } = await pointStore()
    const order = await posOrder(client, store, carne.id, attendant)

    const noMachine = await client
      .post(`/api/v1/stores/${store.id}/orders/${order.id}/point-charges`)
      .json({ paymentType: 'credit_card' })
      .loginAs(attendant)
    await client
      .post(`/api/v1/stores/${store.id}/orders/${order.id}/payment`)
      .json({ method: 'cash' })
      .loginAs(attendant)
    const paid = await client
      .post(`/api/v1/stores/${store.id}/orders/${order.id}/point-charges`)
      .json({ paymentType: 'credit_card' })
      .loginAs(attendant)

    noMachine.assertStatus(422)
    noMachine.assertBodyContains({ code: 'E_NO_TERMINAL' })
    paid.assertStatus(409)
    assert.lengthOf(fake.charges, 0)
  })
})
