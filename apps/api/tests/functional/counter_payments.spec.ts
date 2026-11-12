import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import StoreRole from '#enums/store_role'
import Order from '#models/order'
import { createMenuStore, createUser, linkUser } from '#tests/helpers/fixtures'

test.group('Counter payments', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  async function setup() {
    const { store, carne } = await createMenuStore()
    const cashier = await createUser({ name: 'Caio Caixa' })
    await linkUser(store, cashier, StoreRole.ATTENDANT)
    return { store, carne, cashier }
  }

  test('the POS sends an order already paid, recording how and who', async ({ client, assert }) => {
    const { store, carne, cashier } = await setup()
    const response = await client
      .post(`/api/v1/stores/${store.id}/orders`)
      .json({
        customer: { name: 'Balcão' },
        lines: [{ itemId: carne.id, quantity: 1 }],
        counterMethod: 'credit',
      })
      .loginAs(cashier)
    response.assertStatus(200)
    response.assertBodyContains({
      data: { paymentStatus: 'paid', paymentMethod: 'counter', counterMethod: 'credit' },
    })
    const order = await Order.findOrFail(response.body().data.id)
    assert.equal(order.paidById, cashier.id)
    assert.isNotNull(order.paidAt)
    assert.equal(order.status, 'received')

    // The detail names who received it, nothing else about them.
    const detail = await client
      .get(`/api/v1/stores/${store.id}/orders/${order.id}`)
      .loginAs(cashier)
    assert.deepEqual(detail.body().data.paidBy, { id: cashier.id, name: 'Caio Caixa' })

    // Left out: paid later (or on the card machine).
    const later = await client
      .post(`/api/v1/stores/${store.id}/orders`)
      .json({ customer: { name: 'Depois' }, lines: [{ itemId: carne.id, quantity: 1 }] })
      .loginAs(cashier)
    later.assertBodyContains({ data: { paymentStatus: 'pending', counterMethod: null } })

    const unknown = await client
      .post(`/api/v1/stores/${store.id}/orders`)
      .json({
        customer: { name: 'Vale' },
        lines: [{ itemId: carne.id, quantity: 1 }],
        counterMethod: 'voucher',
      })
      .loginAs(cashier)
    unknown.assertStatus(422)
  })

  test('"Receber pagamento" on an online "pagar na retirada" order needs how it was paid', async ({
    client,
    assert,
  }) => {
    const { store, carne, cashier } = await setup()
    const placed = await client.post(`/api/v1/public/menu/${store.slug}/orders`).json({
      customer: { name: 'Ana Souza', phone: '(11) 98765-4321' },
      paymentMethod: 'counter',
      lines: [{ itemId: carne.id, quantity: 1 }],
    })
    const order = await Order.findByOrFail('publicToken', placed.body().data.publicToken)
    const url = `/api/v1/stores/${store.id}/orders/${order.id}/payment`

    const withoutMethod = await client.post(url).json({}).loginAs(cashier)
    withoutMethod.assertStatus(422)

    const received = await client.post(url).json({ method: 'cash' }).loginAs(cashier)
    received.assertStatus(200)
    await order.refresh()
    assert.equal(order.paymentStatus, 'paid')
    assert.equal(order.paymentMethod, 'counter')
    assert.equal(order.counterMethod, 'cash')
    assert.equal(order.paidById, cashier.id)

    // Repeating it is a success that changes nothing.
    const again = await client.post(url).json({ method: 'pix' }).loginAs(cashier)
    again.assertStatus(200)
    await order.refresh()
    assert.equal(order.counterMethod, 'cash')
  })

  test("another store's member cannot receive its payments", async ({ client }) => {
    const { store, carne, cashier } = await setup()
    const sent = await client
      .post(`/api/v1/stores/${store.id}/orders`)
      .json({ customer: { name: 'Balcão' }, lines: [{ itemId: carne.id, quantity: 1 }] })
      .loginAs(cashier)
    const other = await createMenuStore()
    const outsider = await createUser()
    await linkUser(other.store, outsider, StoreRole.MANAGER)
    const cook = await createUser()
    await linkUser(store, cook, StoreRole.KITCHEN)
    const url = `/api/v1/stores/${store.id}/orders/${sent.body().data.id}/payment`

    const byOutsider = await client.post(url).json({ method: 'cash' }).loginAs(outsider)
    byOutsider.assertStatus(403)
    const byCook = await client.post(url).json({ method: 'cash' }).loginAs(cook)
    byCook.assertStatus(403)
  })
})
