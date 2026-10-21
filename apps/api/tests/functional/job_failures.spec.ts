import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import StoreRole from '#enums/store_role'
import Notification from '#models/notification'
import Order from '#models/order'
import ExpireUnpaidOrder from '#jobs/expire_unpaid_order'
import RefundOrder from '#jobs/refund_order'
import { createMenuStore, createUser, linkUser } from '#tests/helpers/fixtures'
import { failJob, fakeQueue } from '#tests/helpers/queue'

test.group('Background job failures', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.setup(() => void fakeQueue())

  test('a job that gives up notifies the platform admins', async ({ assert }) => {
    const admin = await createUser({ superUser: true })
    const staff = await createUser()

    await failJob(
      ExpireUnpaidOrder,
      { orderId: '00000000-0000-0000-0000-000000000000' },
      new Error('database unreachable')
    )

    const [notice] = await Notification.query().where('userId', admin.id)
    assert.equal(notice.type, 'system.job_failed')
    assert.include(notice.body, 'ExpireUnpaidOrder')
    assert.include(notice.body, 'database unreachable')
    assert.lengthOf(await Notification.query().where('userId', staff.id), 0)
  })

  test("a refund that gives up tells the store's managers, linking the order", async ({
    client,
    assert,
  }) => {
    const { store, carne } = await createMenuStore()
    const manager = await createUser()
    const attendant = await createUser()
    await linkUser(store, manager, StoreRole.MANAGER)
    await linkUser(store, attendant, StoreRole.ATTENDANT)
    const placed = await client.post(`/api/v1/public/menu/${store.slug}/orders`).json({
      customer: { name: 'Ana', phone: '11987654321' },
      paymentMethod: 'counter',
      lines: [{ itemId: carne.id, quantity: 1 }],
    })
    const order = await Order.findByOrFail('publicToken', placed.body().data.publicToken)

    await failJob(RefundOrder, { orderId: order.id }, new Error('gateway down'))

    const [notice] = await Notification.query()
      .where('userId', manager.id)
      .where('type', 'order.refund_failed')
    assert.equal(notice.title, `Reembolso do pedido #${order.number} não concluído`)
    assert.include(notice.url!, `pedido=${order.id}`)
    assert.lengthOf(
      await Notification.query().where('userId', attendant.id).where('type', 'order.refund_failed'),
      0
    )
  })
})
