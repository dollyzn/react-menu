import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import StoreRole from '#enums/store_role'
import Addon from '#models/addon'
import Order from '#models/order'
import { createMenuStore, createUser, linkUser } from '#tests/helpers/fixtures'

const customer = { name: 'Ana', phone: '11987654321' }

/** A group's options at the add-ons' own prices (or the given one for all). */
const options = (addons: Addon[], price: number | null = null) =>
  addons.map((addon) => ({ addonId: addon.id, price }))

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
      options: options([mussarela, cheddar]),
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
      .json({ ...cheese, options: options([other.cheddar]) })
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
    const list = await client.get(url).qs({ name: 'quei', sort: 'name:asc' }).loginAs(manager)
    assert.lengthOf(list.body().data, 1)
    assert.equal(list.body().data[0].itemsCount, 1, 'used by the meat pastry')
    assert.properties(list.body().meta, ['total', 'perPage', 'currentPage'])
    const none = await client.get(url).qs({ name: 'molho' }).loginAs(manager)
    assert.lengthOf(none.body().data, 0)
  })

  test('orders must fill required groups, within their maximum', async ({ client, assert }) => {
    const { store, manager, carne, catupiry, mussarela, cheddar } = await storeWithCheeseChoice()
    const groupResponse = await client
      .post(`/api/v1/stores/${store.id}/option-groups`)
      .json({
        name: 'Queijo',
        minChoices: 1,
        maxChoices: 1,
        options: options([mussarela, cheddar]),
      })
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
      .json({
        name: 'Queijo',
        minChoices: 1,
        maxChoices: 1,
        options: options([mussarela, cheddar]),
      })
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

  test('a group prices its options, and the order remembers the group of each pick', async ({
    client,
    assert,
  }) => {
    const { store, manager, carne, mussarela, cheddar } = await storeWithCheeseChoice()
    const groups = `/api/v1/stores/${store.id}/option-groups`
    // Cheddar is +R$ 2 on its own; as an extra filling it costs R$ 4, and the
    // same add-on is the free choice in "Queijo".
    const queijo = await client
      .post(groups)
      .json({
        name: 'Queijo',
        minChoices: 1,
        maxChoices: 1,
        options: options([mussarela, cheddar], 0),
      })
      .loginAs(manager)
    const extra = await client
      .post(groups)
      .json({
        name: 'Recheio extra',
        minChoices: 0,
        maxChoices: 1,
        options: [
          { addonId: cheddar.id, price: 4 },
          { addonId: mussarela.id, price: null },
        ],
      })
      .loginAs(manager)
    extra.assertStatus(200)
    extra.assertBodyContains({
      data: {
        options: [
          { id: cheddar.id, price: 2, groupPrice: 4 },
          { id: mussarela.id, groupPrice: null },
        ],
      },
    })
    const queijoId = queijo.body().data.id
    const extraId = extra.body().data.id
    await client
      .put(`/api/v1/stores/${store.id}/items/${carne.id}`)
      .json({ optionGroupIds: [queijoId, extraId] })
      .loginAs(manager)

    // The menu shows each group's price.
    const menu = await client.get(`/api/v1/public/menu/${store.slug}`)
    const listed = menu
      .body()
      .data.categories.flatMap((category: { items: object[] }) => category.items)
      .find((item: { id: string }) => item.id === carne.id)
    assert.deepEqual(
      listed.optionGroups.map((listedGroup: { options: { price: number }[] }) =>
        listedGroup.options.map((option) => option.price)
      ),
      [
        [0, 0],
        [4, 0],
      ]
    )

    // Cheddar free in "Queijo" and again as the extra filling (R$ 4).
    const ok = await client.post(`/api/v1/public/menu/${store.slug}/orders`).json({
      customer,
      paymentMethod: 'counter',
      lines: [
        {
          itemId: carne.id,
          quantity: 2,
          choices: [
            { groupId: queijoId, addonId: cheddar.id },
            { groupId: extraId, addonId: cheddar.id },
          ],
        },
      ],
    })
    ok.assertStatus(200)
    const placed = await Order.query()
      .where('publicToken', ok.body().data.publicToken)
      .preload('items', (items) => items.preload('addons'))
      .firstOrFail()
    assert.equal(placed.total, 2 * (carne.price + 0 + 4))
    assert.sameDeepMembers(
      placed.items[0].addons.map(({ name, groupName, unitPrice }) => ({
        name,
        groupName,
        unitPrice,
      })),
      [
        { name: 'Cheddar', groupName: 'Queijo', unitPrice: 0 },
        { name: 'Cheddar', groupName: 'Recheio extra', unitPrice: 4 },
      ]
    )
    const kitchen = await client.get(`/api/v1/stores/${store.id}/kitchen/queue`).loginAs(manager)
    assert.sameMembers(kitchen.body().data[0].addons, ['Queijo: Cheddar', 'Recheio extra: Cheddar'])

    // A pick in a group the item doesn't have is refused.
    const wrongGroup = await client.post(`/api/v1/public/menu/${store.slug}/orders`).json({
      customer,
      paymentMethod: 'counter',
      lines: [
        { itemId: carne.id, quantity: 1, choices: [{ groupId: extraId, addonId: carne.id }] },
      ],
    })
    wrongGroup.assertStatus(422)

    // Bags saved before choices send ids only: the first group offering it.
    const legacy = await client.post(`/api/v1/public/menu/${store.slug}/orders`).json({
      customer,
      paymentMethod: 'counter',
      lines: [{ itemId: carne.id, quantity: 1, addonIds: [mussarela.id] }],
    })
    legacy.assertStatus(200)

    // Changing the price on the group keeps the same options.
    const repriced = await client
      .put(`${groups}/${extraId}`)
      .json({
        name: 'Recheio extra',
        minChoices: 0,
        maxChoices: 1,
        options: options([cheddar, mussarela], 5),
      })
      .loginAs(manager)
    repriced.assertBodyContains({
      data: {
        options: [
          { id: cheddar.id, groupPrice: 5 },
          { id: mussarela.id, groupPrice: 5 },
        ],
      },
    })
  })

  test('a group priced by pick order: the 1st pick R$ 3, every later one R$ 5', async ({
    client,
    assert,
  }) => {
    const { store, manager, carne, mussarela, cheddar } = await storeWithCheeseChoice()
    const frango = await Addon.create({ storeId: store.id, name: 'Frango', price: 9 })
    const groups = `/api/v1/stores/${store.id}/option-groups`
    const definition = {
      name: 'Recheio extra',
      minChoices: 0,
      maxChoices: 3,
      pickPrices: [3, 5],
      options: options([mussarela, cheddar, frango]),
    }

    const created = await client.post(groups).json(definition).loginAs(manager)
    const tooManyPrices = await client
      .post(groups)
      .json({ ...definition, pickPrices: [3, 5, 5, 5] })
      .loginAs(manager)
    created.assertStatus(200)
    created.assertBodyContains({ data: { pickPrices: [3, 5] } })
    tooManyPrices.assertStatus(422)
    const groupId = created.body().data.id
    await client
      .put(`/api/v1/stores/${store.id}/items/${carne.id}`)
      .json({ optionGroupIds: [groupId] })
      .loginAs(manager)

    const menu = await client.get(`/api/v1/public/menu/${store.slug}`)
    const listed = menu
      .body()
      .data.categories.flatMap((category: { items: object[] }) => category.items)
      .find((item: { id: string }) => item.id === carne.id)
    assert.deepEqual(listed.optionGroups[0].pickPrices, [3, 5])

    // In the order chosen: Frango first (R$ 3, not its own R$ 9), then 5 and 5.
    const placed = await client.post(`/api/v1/public/menu/${store.slug}/orders`).json({
      customer,
      paymentMethod: 'counter',
      lines: [
        {
          itemId: carne.id,
          quantity: 1,
          choices: [
            { groupId, addonId: frango.id },
            { groupId, addonId: cheddar.id },
            { groupId, addonId: mussarela.id },
          ],
        },
      ],
    })
    const one = await client.post(`/api/v1/public/menu/${store.slug}/orders`).json({
      customer,
      paymentMethod: 'counter',
      lines: [{ itemId: carne.id, quantity: 2, choices: [{ groupId, addonId: cheddar.id }] }],
    })
    placed.assertStatus(200)
    const order = await Order.query()
      .where('publicToken', placed.body().data.publicToken)
      .preload('items', (items) => items.preload('addons'))
      .firstOrFail()
    assert.equal(order.total, carne.price + 3 + 5 + 5)
    assert.sameDeepMembers(
      order.items[0].addons.map(({ name, unitPrice }) => ({ name, unitPrice })),
      [
        { name: 'Frango', unitPrice: 3 },
        { name: 'Cheddar', unitPrice: 5 },
        { name: 'Mussarela', unitPrice: 5 },
      ]
    )
    const single = await Order.query()
      .where('publicToken', one.body().data.publicToken)
      .firstOrFail()
    assert.equal(single.total, 2 * (carne.price + 3))

    // Back to each option's price.
    const perOption = await client
      .put(`${groups}/${groupId}`)
      .json({ ...definition, pickPrices: null })
      .loginAs(manager)
    perOption.assertBodyContains({ data: { pickPrices: null } })
  })

  test('a group that allows repeats takes the same option twice', async ({ client, assert }) => {
    const { store, manager, carne, mussarela, cheddar } = await storeWithCheeseChoice()
    const groups = `/api/v1/stores/${store.id}/option-groups`
    // Two options, up to 3 picks: only possible with repeats.
    const repeatable = await client
      .post(groups)
      .json({
        name: 'Escolha 3 sabores',
        minChoices: 3,
        maxChoices: 3,
        allowRepeat: true,
        options: options([mussarela, cheddar]),
      })
      .loginAs(manager)
    const withoutRepeat = await client
      .post(groups)
      .json({
        name: 'Sem repetir',
        minChoices: 0,
        maxChoices: 3,
        options: options([mussarela, cheddar]),
      })
      .loginAs(manager)
    repeatable.assertStatus(200)
    repeatable.assertBodyContains({ data: { allowRepeat: true } })
    withoutRepeat.assertStatus(422)
    const groupId = repeatable.body().data.id
    await client
      .put(`/api/v1/stores/${store.id}/items/${carne.id}`)
      .json({ optionGroupIds: [groupId] })
      .loginAs(manager)

    const placed = await client.post(`/api/v1/public/menu/${store.slug}/orders`).json({
      customer,
      paymentMethod: 'counter',
      lines: [
        {
          itemId: carne.id,
          quantity: 1,
          choices: [
            { groupId, addonId: mussarela.id },
            { groupId, addonId: mussarela.id },
            { groupId, addonId: cheddar.id },
          ],
        },
      ],
    })
    placed.assertStatus(200)
    const order = await Order.query()
      .where('publicToken', placed.body().data.publicToken)
      .preload('items', (items) => items.preload('addons'))
      .firstOrFail()
    assert.equal(order.total, carne.price + 0 + 0 + 2)
    assert.equal(order.items[0].addons.filter((addon) => addon.name === 'Mussarela').length, 2)
    const kitchen = await client.get(`/api/v1/stores/${store.id}/kitchen/queue`).loginAs(manager)
    assert.sameMembers(kitchen.body().data[0].addons, [
      'Escolha 3 sabores: 2× Mussarela',
      'Escolha 3 sabores: Cheddar',
    ])

    // Without repeats a twice-sent option counts once (and misses the minimum).
    await client
      .put(`${groups}/${groupId}`)
      .json({
        name: 'Escolha 2 sabores',
        minChoices: 2,
        maxChoices: 2,
        allowRepeat: false,
        options: options([mussarela, cheddar]),
      })
      .loginAs(manager)
    const twice = await client.post(`/api/v1/public/menu/${store.slug}/orders`).json({
      customer,
      paymentMethod: 'counter',
      lines: [
        {
          itemId: carne.id,
          quantity: 1,
          choices: [
            { groupId, addonId: mussarela.id },
            { groupId, addonId: mussarela.id },
          ],
        },
      ],
    })
    twice.assertStatus(422)
    twice.assertBodyContains({ code: 'E_CHOICE_REQUIRED' })
  })

  test('older bags (ids only): a group option counts for its group, in the item order', async ({
    client,
    assert,
  }) => {
    const { store, manager, carne, catupiry, mussarela, cheddar } = await storeWithCheeseChoice()
    const groups = `/api/v1/stores/${store.id}/option-groups`
    // Catupiry is a free add-on of the item and also an option of both groups.
    const troca = await client
      .post(groups)
      .json({
        name: 'Queijo',
        minChoices: 1,
        maxChoices: 1,
        options: options([catupiry, mussarela], 0),
      })
      .loginAs(manager)
    const extra = await client
      .post(groups)
      .json({
        name: 'Recheio extra',
        minChoices: 0,
        maxChoices: 1,
        options: options([catupiry, cheddar], 4),
      })
      .loginAs(manager)
    await client
      .put(`/api/v1/stores/${store.id}/items/${carne.id}`)
      .json({ optionGroupIds: [troca.body().data.id, extra.body().data.id] })
      .loginAs(manager)

    const ok = await client.post(`/api/v1/public/menu/${store.slug}/orders`).json({
      customer,
      paymentMethod: 'counter',
      lines: [{ itemId: carne.id, quantity: 1, addonIds: [cheddar.id, catupiry.id] }],
    })
    ok.assertStatus(200)
    const placed = await Order.query()
      .where('publicToken', ok.body().data.publicToken)
      .preload('items', (items) => items.preload('addons', (addons) => addons.orderBy('id')))
      .firstOrFail()
    // Catupiry fills the required "Queijo" (free), Cheddar the extra (R$ 4),
    // saved in the item's group order whatever order the ids came in.
    assert.deepEqual(
      placed.items[0].addons.map(({ name, groupName, unitPrice }) => ({
        name,
        groupName,
        unitPrice,
      })),
      [
        { name: 'Catupiry', groupName: 'Queijo', unitPrice: 0 },
        { name: 'Cheddar', groupName: 'Recheio extra', unitPrice: 4 },
      ]
    )
  })
})
