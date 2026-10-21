import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import testUtils from '@adonisjs/core/services/test_utils'
import StoreRole from '#enums/store_role'
import { createMenuStore, createUser, linkUser } from '#tests/helpers/fixtures'

test.group('Customers (POS autocomplete)', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  async function setup(client: ApiClient) {
    const attendant = await createUser()
    const cook = await createUser()
    const { store, carne } = await createMenuStore()
    await linkUser(store, attendant, StoreRole.ATTENDANT)
    await linkUser(store, cook, StoreRole.KITCHEN)
    const order = (name: string, phone: string) =>
      client
        .post(`/api/v1/stores/${store.id}/orders`)
        .json({ customer: { name, phone }, lines: [{ itemId: carne.id, quantity: 1 }] })
        .loginAs(attendant)
    await order('José Antônio', '(11) 98765-4321')
    await order('Josefa Lima', '(11) 91111-2222')
    await order('Josefa Lima', '(11) 91111-2222')
    const search = (term: string, user = attendant) =>
      client.get(`/api/v1/stores/${store.id}/customers?search=${encodeURI(term)}`).loginAs(user)
    return { store, attendant, cook, search }
  }

  test('finds by name without accents and by part of the phone', async ({ client, assert }) => {
    const { search } = await setup(client)

    const byName = await search('jose')
    byName.assertStatus(200)
    assert.sameMembers(
      byName.body().data.map((c: { name: string }) => c.name),
      ['José Antônio', 'Josefa Lima']
    )
    // Most recent first; repeated customers are counted.
    assert.equal(byName.body().data[0].name, 'Josefa Lima')
    assert.equal(byName.body().data[0].ordersCount, 2)
    assert.equal(byName.body().data[0].phone, '5511911112222')

    const byPhone = await search('4321')
    assert.deepEqual(
      byPhone.body().data.map((c: { name: string }) => c.name),
      ['José Antônio']
    )

    // A comma in the search must not break validation.
    const withComma = await search('Lima, Josefa')
    withComma.assertStatus(200)
    const tooShort = await search('j')
    assert.lengthOf(tooShort.body().data, 0)
  })

  test('only front of house, only its own store', async ({ client, assert }) => {
    const { store, cook, search } = await setup(client)
    const asCook = await search('jose', cook)
    asCook.assertStatus(403)

    const outsider = await createUser()
    const other = await createMenuStore()
    await linkUser(other.store, outsider, StoreRole.MANAGER)
    const response = await client
      .get(`/api/v1/stores/${store.id}/customers?search=jose`)
      .loginAs(outsider)
    response.assertStatus(403)
    assert.isUndefined(response.body().data)
  })
})
