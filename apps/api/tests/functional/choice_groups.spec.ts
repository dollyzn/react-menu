import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import StoreRole from '#enums/store_role'
import Addon from '#models/addon'
import Order from '#models/order'
import { createMenuStore, createUser, linkUser } from '#tests/helpers/fixtures'

const customer = { name: 'Ana', phone: '11987654321' }

/** A store whose meat pastry needs a cheese (choose 1: mussarela included, cheddar +R$ 2). */
async function storeWithCheeseChoice() {
  const menu = await createMenuStore()
  const manager = await createUser()
  await linkUser(menu.store, manager, StoreRole.MANAGER)
  const mussarela = await Addon.create({ storeId: menu.store.id, name: 'Mussarela', price: 0 })
  const cheddar = await Addon.create({ storeId: menu.store.id, name: 'Cheddar', price: 2 })
  return { ...menu, manager, mussarela, cheddar }
}

test.group('Choice groups', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('managers create groups from the store add-ons and attach them to items', async ({
    client,
    assert,
  }) => {
    const { store, manager, carne, mussarela, cheddar } = await storeWithCheeseChoice()
    const attendant = await createUser()
    await linkUser(store, attendant, StoreRole.ATTENDANT)
    const other = await storeWithCheeseChoice()
    const url = `/api/v1/stores/${store.id}/option-groups`
    const cheese = {
      name: 'Queijo',
      minChoices: 1,
      maxChoices: 1,
      addonIds: [mussarela.id, cheddar.id],
    }

    const created = await client.post(url).json(cheese).loginAs(manager)
    const tooMany = await client
      .post(url)
      .json({ ...cheese, maxChoices: 3 })
      .loginAs(manager)
    const minOverMax = await client
      .post(url)
      .json({ ...cheese, minChoices: 2, maxChoices: 1 })
      .loginAs(manager)
    const foreignAddon = await client
      .post(url)
      .json({ ...cheese, addonIds: [other.cheddar.id] })
      .loginAs(manager)
    const byAttendant = await client.post(url).json(cheese).loginAs(attendant)
    const byOtherStore = await client.get(url).loginAs(other.manager)

    created.assertStatus(200)
    created.assertBodyContains({
      data: {
        name: 'Queijo',
        minChoices: 1,
        maxChoices: 1,
        options: [{ id: mussarela.id }, { id: cheddar.id }],
      },
    })
    tooMany.assertStatus(422)
    minOverMax.assertStatus(422)
    foreignAddon.assertStatus(422)
    byAttendant.assertStatus(403)
    byOtherStore.assertStatus(403)

    const groupId = created.body().data.id
    const attached = await client
      .put(`/api/v1/stores/${store.id}/items/${carne.id}`)
      .json({ optionGroupIds: [groupId] })
      .loginAs(manager)
    attached.assertBodyContains({ data: { optionGroups: [{ id: groupId }] } })
    const foreignGroup = await client
      .put(`/api/v1/stores/${other.store.id}/items/${other.carne.id}`)
      .json({ optionGroupIds: [groupId] })
      .loginAs(other.manager)
    foreignGroup.assertStatus(422)
    const list = await client.get(url).loginAs(manager)
    assert.lengthOf(list.body().data, 1)
  })

  test('orders must fill required groups, within their maximum', async ({ client, assert }) => {
    const { store, manager, carne, catupiry, mussarela, cheddar } = await storeWithCheeseChoice()
    const groupResponse = await client
      .post(`/api/v1/stores/${store.id}/option-groups`)
      .json({ name: 'Queijo', minChoices: 1, maxChoices: 1, addonIds: [mussarela.id, cheddar.id] })
      .loginAs(manager)
    const groupId = groupResponse.body().data.id
    await client
      .put(`/api/v1/stores/${store.id}/items/${carne.id}`)
      .json({ optionGroupIds: [groupId] })
      .loginAs(manager)
    const order = (addonIds: string[]) =>
      client.post(`/api/v1/public/menu/${store.slug}/orders`).json({
        customer,
        paymentMethod: 'counter',
        lines: [{ itemId: carne.id, quantity: 2, addonIds }],
      })

    const none = await order([])
    const both = await order([mussarela.id, cheddar.id])
    // An add-on of the store, but neither in the item's groups nor its free add-ons.
    const milho = await Addon.create({ storeId: store.id, name: 'Milho', price: 1 })
    const notAnOption = await order([cheddar.id, milho.id])

    none.assertStatus(422)
    none.assertBodyContains({
      code: 'E_CHOICE_REQUIRED',
      error: 'Pastel de Carne: escolha 1 em "Queijo".',
    })
    both.assertStatus(422)
    notAnOption.assertStatus(422)

    // Cheddar (+R$ 2) and the free add-on still allowed alongside.
    const ok = await order([cheddar.id, catupiry.id])
    ok.assertStatus(200)
    const placed = await Order.query()
      .where('publicToken', ok.body().data.publicToken)
      .preload('items', (items) => items.preload('addons'))
      .firstOrFail()
    assert.equal(placed.total, 2 * (carne.price + cheddar.price + catupiry.price))
    assert.sameMembers(
      placed.items[0].addons.map((addon) => addon.name),
      ['Cheddar', 'Catupiry']
    )
  })

  test('the menu lists the groups; a required group with nothing left makes the item unavailable', async ({
    client,
    assert,
  }) => {
    const { store, manager, carne, mussarela, cheddar } = await storeWithCheeseChoice()
    const groupResponse = await client
      .post(`/api/v1/stores/${store.id}/option-groups`)
      .json({ name: 'Queijo', minChoices: 1, maxChoices: 1, addonIds: [mussarela.id, cheddar.id] })
      .loginAs(manager)
    await client
      .put(`/api/v1/stores/${store.id}/items/${carne.id}`)
      .json({ optionGroupIds: [groupResponse.body().data.id] })
      .loginAs(manager)

    const find = async () => {
      const response = await client.get(`/api/v1/public/menu/${store.slug}`)
      return response
        .body()
        .data.categories.flatMap((category: { items: object[] }) => category.items)
        .find((item: { id: string }) => item.id === carne.id)
    }
    const listed = await find()
    assert.equal(listed.optionGroups[0].name, 'Queijo')
    assert.deepEqual(
      listed.optionGroups[0].options.map((option: { name: string }) => option.name),
      ['Mussarela', 'Cheddar']
    )
    assert.isTrue(listed.isAvailable)

    for (const option of [mussarela, cheddar]) {
      option.isAvailable = false
      await option.save()
    }
    const soldOut = await find()
    assert.isFalse(soldOut.isAvailable)
  })
})
