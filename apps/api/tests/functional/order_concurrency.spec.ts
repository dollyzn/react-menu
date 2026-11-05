import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import app from '@adonisjs/core/services/app'
import StoreRole from '#enums/store_role'
import Ingredient from '#models/ingredient'
import Notification from '#models/notification'
import Order from '#models/order'
import OrderStatusHistory from '#models/order_status_history'
import type Store from '#models/store'
import type User from '#models/user'
import OrderService from '#services/order_service'
import { createMenuStore, createUser, linkUser } from '#tests/helpers/fixtures'
import { fakeQueue } from '#tests/helpers/queue'

/**
 * Real concurrency: no global transaction here (it would put every query on
 * one connection), so the data is committed and removed by hand.
 */
test.group('Order changes from two places at once', (group) => {
  let cleanup: { store?: Store; users: User[] } = { users: [] }
  group.each.setup(() => {
    fakeQueue()
    cleanup = { users: [] }
    return async () => {
      await cleanup.store?.delete()
      for (const user of cleanup.users) await user.delete()
    }
  })

  /** An online order waiting for payment, for a pastry that uses 1 dough. */
  async function pendingOnlineOrder(client: ApiClient) {
    const manager = await createUser()
    const menu = await createMenuStore()
    cleanup = { store: menu.store, users: [manager] }
    await linkUser(menu.store, manager, StoreRole.MANAGER)
    // Pix needs the store's Mercado Pago account (never called here).
    menu.store.merge({
      inventoryEnabled: true,
      mercadoPagoAccessToken: 'TEST-token',
      mercadoPagoWebhookSecret: 'secret',
    })
    await menu.store.save()
    const massa = await Ingredient.create({
      storeId: menu.store.id,
      name: 'Massa',
      unit: 'un',
      stockQuantity: 10,
      minStock: 1,
    })
    await menu.carne.related('ingredients').attach({ [massa.id]: { quantity: 1 } })

    const placed = await client.post(`/api/v1/public/menu/${menu.store.slug}/orders`).json({
      customer: { name: 'Ana', phone: '11987654321' },
      paymentMethod: 'pix',
      lines: [{ itemId: menu.carne.id, quantity: 2 }],
    })
    placed.assertStatus(200)
    const order = await Order.findByOrFail('publicToken', placed.body().data.publicToken)
    return { order, massa, manager }
  }

  test('two approvals at the same time enter the kitchen once', async ({ client, assert }) => {
    const { order, massa, manager } = await pendingOnlineOrder(client)
    const orders = await app.container.make(OrderService)

    // Both webhooks (topics "order" and "payment") load the order before either saves.
    const [first, second] = await Promise.all([
      Order.findOrFail(order.id),
      Order.findOrFail(order.id),
    ])
    await Promise.all([orders.markPaid(first), orders.markPaid(second)])

    await massa.refresh()
    assert.equal(massa.stockQuantity, 8, 'two pastries, consumed once')
    const received = await OrderStatusHistory.query().where({
      orderId: order.id,
      toStatus: 'received',
    })
    assert.lengthOf(received, 1)
    const notifications = await Notification.query().where('userId', manager.id)
    assert.lengthOf(notifications, 1)
  })

  test('cancelling twice at the same time gives the stock back once', async ({
    client,
    assert,
  }) => {
    const { order, massa } = await pendingOnlineOrder(client)
    const orders = await app.container.make(OrderService)
    await orders.markPaid(await Order.findOrFail(order.id))
    await massa.refresh()
    assert.equal(massa.stockQuantity, 8)

    // A double tap on "Cancelar" (two keys) racing each other.
    await Promise.all([
      orders.cancel(order.storeId, order.id),
      orders.cancel(order.storeId, order.id),
    ])

    await massa.refresh()
    assert.equal(massa.stockQuantity, 10)
  })
})
