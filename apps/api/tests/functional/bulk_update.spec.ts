import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import StoreRole from '#enums/store_role'
import type Addon from '#models/addon'
import type Item from '#models/item'
import { createMenuStore, createUser, linkUser } from '#tests/helpers/fixtures'

const change = (row: Item | Addon, values: { price?: number; isAvailable?: boolean }) => ({
  id: row.id,
  updatedAt: row.updatedAt.toISO()!,
  ...values,
})

async function menuWithManager() {
  const menu = await createMenuStore()
  const manager = await createUser()
  await linkUser(menu.store, manager, StoreRole.MANAGER)
  return { ...menu, manager }
}

test.group('Bulk edit (items and add-ons)', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('a manager changes prices and availability of many items at once', async ({
    client,
    assert,
  }) => {
    const { store, carne, queijo, manager } = await menuWithManager()

    const response = await client
      .post(`/api/v1/stores/${store.id}/items/bulk-update`)
      .json({
        changes: [
          change(carne, { price: 19.9 }),
          change(queijo, { price: 17.5, isAvailable: false }),
        ],
      })
      .loginAs(manager)

    response.assertStatus(200)
    response.assertBodyContains({ data: { updated: 2 }, message: '2 itens atualizados' })
    await carne.refresh()
    await queijo.refresh()
    assert.equal(carne.price, 19.9)
    assert.equal(queijo.price, 17.5)
    assert.isFalse(queijo.isAvailable)
  })

  test('nothing is saved when a row changed meanwhile; a repeated request succeeds', async ({
    client,
    assert,
  }) => {
    const { store, carne, queijo, manager } = await menuWithManager()
    const seen = [change(carne, { price: 20 }), change(queijo, { price: 20 })]

    // Someone else edits the cheese pastry after the dialog opened.
    await client
      .put(`/api/v1/stores/${store.id}/items/${queijo.id}`)
      .json({ price: 16 })
      .loginAs(manager)

    const stale = await client
      .post(`/api/v1/stores/${store.id}/items/bulk-update`)
      .json({ changes: seen })
      .loginAs(manager)
    stale.assertStatus(409)
    stale.assertBodyContains({ code: 'E_STALE_ROWS', details: { ids: [queijo.id] } })
    await carne.refresh()
    assert.notEqual(carne.price, 20, 'all or nothing')

    // Reloaded, saved; the same request again (a retry) is still a success.
    await queijo.refresh()
    const fresh = [change(carne, { price: 20 }), change(queijo, { price: 20 })]
    const first = await client
      .post(`/api/v1/stores/${store.id}/items/bulk-update`)
      .json({ changes: fresh })
      .loginAs(manager)
    const retry = await client
      .post(`/api/v1/stores/${store.id}/items/bulk-update`)
      .json({ changes: fresh })
      .loginAs(manager)
    first.assertBodyContains({ data: { updated: 2 } })
    retry.assertStatus(200)
    retry.assertBodyContains({ data: { updated: 0 } })
  })

  test('only managers, only their store, only valid prices', async ({ client }) => {
    const { store, carne, manager } = await menuWithManager()
    const attendant = await createUser()
    await linkUser(store, attendant, StoreRole.ATTENDANT)
    const other = await menuWithManager()

    const byAttendant = await client
      .post(`/api/v1/stores/${store.id}/items/bulk-update`)
      .json({ changes: [change(carne, { price: 1 })] })
      .loginAs(attendant)
    const otherStoresItem = await client
      .post(`/api/v1/stores/${store.id}/items/bulk-update`)
      .json({ changes: [change(other.carne, { price: 1 })] })
      .loginAs(manager)
    const byOtherManager = await client
      .post(`/api/v1/stores/${store.id}/items/bulk-update`)
      .json({ changes: [change(carne, { price: 1 })] })
      .loginAs(other.manager)
    const negative = await client
      .post(`/api/v1/stores/${store.id}/items/bulk-update`)
      .json({ changes: [change(carne, { price: -5 })] })
      .loginAs(manager)
    const tooPrecise = await client
      .post(`/api/v1/stores/${store.id}/items/bulk-update`)
      .json({ changes: [change(carne, { price: 9.999 })] })
      .loginAs(manager)

    byAttendant.assertStatus(403)
    otherStoresItem.assertStatus(409)
    byOtherManager.assertStatus(403)
    negative.assertStatus(422)
    tooPrecise.assertStatus(422)
  })

  test('add-ons are edited the same way', async ({ client, assert }) => {
    const { store, catupiry, manager } = await menuWithManager()

    const response = await client
      .post(`/api/v1/stores/${store.id}/addons/bulk-update`)
      .json({ changes: [change(catupiry, { price: 4.5, isAvailable: false })] })
      .loginAs(manager)

    response.assertStatus(200)
    response.assertBodyContains({ message: '1 adicional atualizado' })
    await catupiry.refresh()
    assert.equal(catupiry.price, 4.5)
    assert.isFalse(catupiry.isAvailable)
  })
})
