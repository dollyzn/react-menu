import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import StoreRole from '#enums/store_role'
import StoreStatus from '#enums/store_status'
import { createCategory, createStore, createUser, linkUser } from '#tests/helpers/fixtures'

test.group('Store roles', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('attendants and kitchen staff read the catalog but cannot change it', async ({ client }) => {
    const store = await createStore()
    const attendant = await createUser()
    const cook = await createUser()
    await linkUser(store, attendant, StoreRole.ATTENDANT)
    await linkUser(store, cook, StoreRole.KITCHEN)
    const category = await createCategory(store)

    for (const user of [attendant, cook]) {
      const list = await client.get(`/api/v1/stores/${store.id}/categories`).loginAs(user)
      const create = await client
        .post(`/api/v1/stores/${store.id}/categories`)
        .json({ name: 'Nova' })
        .loginAs(user)
      const update = await client
        .put(`/api/v1/stores/${store.id}/categories/${category.id}`)
        .json({ name: 'Renomeada' })
        .loginAs(user)
      const dashboard = await client
        .get(`/api/v1/stores/${store.id}/dashboard/overview`)
        .loginAs(user)

      list.assertStatus(200)
      create.assertStatus(403)
      update.assertStatus(403)
      dashboard.assertStatus(403)
    }
  })

  test('attendants can open the store, kitchen staff cannot', async ({ client }) => {
    const store = await createStore()
    const attendant = await createUser()
    const cook = await createUser()
    await linkUser(store, attendant, StoreRole.ATTENDANT)
    await linkUser(store, cook, StoreRole.KITCHEN)

    const byAttendant = await client
      .patch(`/api/v1/stores/${store.id}/status`)
      .json({ status: StoreStatus.OPEN })
      .loginAs(attendant)
    const byCook = await client
      .patch(`/api/v1/stores/${store.id}/status`)
      .json({ status: StoreStatus.CLOSED })
      .loginAs(cook)

    byAttendant.assertStatus(200)
    byCook.assertStatus(403)
  })

  test('managers keep full access', async ({ client }) => {
    const store = await createStore()
    const manager = await createUser()
    await linkUser(store, manager, StoreRole.MANAGER)

    const create = await client
      .post(`/api/v1/stores/${store.id}/categories`)
      .json({ name: 'Nova' })
      .loginAs(manager)

    create.assertStatus(200)
  })
})

test.group('Store settings', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  test('managers update operational settings', async ({ client, assert }) => {
    const store = await createStore()
    const manager = await createUser()
    await linkUser(store, manager, StoreRole.MANAGER)

    const response = await client
      .put(`/api/v1/stores/${store.id}`)
      .json({
        name: store.name,
        slug: store.slug,
        phone: '(11) 91234-5678',
        description: 'Pastéis crocantes',
        pickupEtaMinutes: 25,
        inventoryEnabled: true,
        counterPaymentEnabled: false,
      })
      .loginAs(manager)

    response.assertStatus(200)
    await store.refresh()
    assert.equal(store.phone, '11912345678')
    assert.equal(store.pickupEtaMinutes, 25)
    assert.isTrue(store.inventoryEnabled)
    assert.isFalse(store.counterPaymentEnabled)
  })
})
