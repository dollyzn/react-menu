import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'
import StoreStatus from '#enums/store_status'
import Ingredient from '#models/ingredient'
import Order from '#models/order'
import CatalogImportService from '#services/catalog_import_service'
import { JJ_PASTEIS, JJ_PASTEIS_PROFILE } from '#catalog/jj_pasteis'
import { createStore } from '#tests/helpers/fixtures'

type MenuOption = { id: string; name: string; price: number }
type MenuGroup = {
  id: string
  name: string
  minChoices: number
  maxChoices: number
  pickPrices: number[] | null
  options: MenuOption[]
}
type MenuItem = {
  id: string
  name: string
  price: number
  optionGroups: MenuGroup[]
  addons: MenuOption[]
}
type Menu = { categories: { name: string; items: MenuItem[] }[] }

const customer = { name: 'Ana', phone: '11987654321' }
const SIMPLE_EXTRAS = [
  'Carne moída',
  'Frango',
  'Calabresa',
  'Presunto',
  'Mussarela',
  'Catupiry',
  'Cheddar',
  'Cream cheese',
  'Brócolis',
  'Escarola',
]

/** A fresh store with the JJ catalog, opened, and its public menu. */
async function jjStore(client: { get: (url: string) => Promise<{ body(): { data: Menu } }> }) {
  const store = await createStore()
  store.merge({ status: StoreStatus.OPEN, isDefault: false })
  await store.save()
  await new CatalogImportService().import(store, JJ_PASTEIS, { photos: false })
  const response = await client.get(`/api/v1/public/menu/${store.slug}`)
  const menu = response.body().data
  const items = new Map(menu.categories.flatMap((c) => c.items).map((item) => [item.name, item]))
  const item = (name: string) => {
    const found = items.get(name)
    if (!found) throw new Error(`missing item ${name}`)
    return found
  }
  const group = (itemName: string, groupName: string) =>
    item(itemName).optionGroups.find((candidate) => candidate.name === groupName)
  return { store, menu, item, group }
}

test.group('JJ Pastéis catalog (spec of 2026-11-06)', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

  test('categories, base prices and who gets which group', async ({ client, assert }) => {
    const { menu, item, group: groupOf } = await jjStore(client)
    const byCategory = new Map(menu.categories.map((c) => [c.name, c.items]))

    // Base prices per category.
    for (const [category, price] of [
      ['Pastéis Simples', 18],
      ['Pastéis Especiais', 20],
      ['Pastéis Selecionados', 25],
      ['Pastéis Doces', 25],
      ['Pastéis Premium', 38],
    ] as const) {
      assert.isTrue(
        byCategory.get(category)!.every((entry) => entry.price === price),
        `${category} at R$ ${price}`
      )
    }

    // Simples: the 10 extras, up to 3, 1st R$ 3 then R$ 5.
    for (const pastry of byCategory.get('Pastéis Simples')!) {
      const extra = groupOf(pastry.name, 'Recheio extra')!
      assert.deepEqual(
        extra.options.map((o) => o.name),
        SIMPLE_EXTRAS
      )
      assert.include(extra, { minChoices: 0, maxChoices: 3 })
      assert.deepEqual(extra.pickPrices, [3, 5])
    }
    // Especiais: the 12 (with palmito and berinjela) at R$ 5 each.
    for (const pastry of byCategory.get('Pastéis Especiais')!) {
      const extra = groupOf(pastry.name, 'Recheio extra')!
      assert.deepEqual(
        extra.options.map((o) => o.name),
        [...SIMPLE_EXTRAS, 'Palmito', 'Berinjela']
      )
      assert.isNull(extra.pickPrices)
      assert.isTrue(extra.options.every((o) => o.price === 5))
    }
    // No extra fillings anywhere else.
    for (const category of [
      'Pastéis Selecionados',
      'Pastéis Premium',
      'Pastéis Doces',
      'Porções',
      'Porções de Mini Pastéis',
      'Bebidas',
    ]) {
      for (const entry of byCategory.get(category)!) {
        assert.isUndefined(groupOf(entry.name, 'Recheio extra'), `${entry.name} has no extras`)
      }
    }
    // Premium: only "Escolha o queijo", "Opcionais" and the add-ons.
    for (const pastry of byCategory.get('Pastéis Premium')!) {
      assert.deepEqual(
        pastry.optionGroups.map((g) => g.name),
        ['Escolha o queijo', 'Opcionais']
      )
      assert.isAbove(pastry.addons.length, 0)
    }

    // "Escolha o queijo": required, exactly 1, included in the price, on every
    // pastry that mentions cheese (not 4 Queijos, which has its four).
    for (const name of [
      'Pastel de Queijo',
      'Pastel de Pizza',
      'Pastel de Bauru',
      'Pastel de Carne com Queijo',
      'Pastel de Portuguesa',
      'Pastel Vegetariano',
      'Pastel Frango Supremo',
      'Pastel de Camarão com Queijo',
      'Pastel de Carne Seca com Queijo',
      'Pastel Romeu e Julieta',
    ]) {
      const cheese = groupOf(name, 'Escolha o queijo')
      assert.exists(cheese, name)
      assert.include(cheese!, { minChoices: 1, maxChoices: 1 })
      assert.isTrue(cheese!.options.every((o) => o.price === 0))
    }
    assert.isUndefined(groupOf('Pastel de 4 Queijos', 'Escolha o queijo'))
    assert.isUndefined(groupOf('Pastel de Carne', 'Escolha o queijo'))

    // "Opcionais": orégano or alho frito, at most 1.
    const optionals = groupOf('Pastel de Carne', 'Opcionais')!
    assert.deepEqual(
      optionals.options.map((o) => o.name),
      ['Orégano', 'Alho frito']
    )
    assert.include(optionals, { minChoices: 0, maxChoices: 1 })

    // "Adicionais": their own prices, none of the main fillings.
    assert.deepEqual(
      Object.fromEntries(item('Pastel de Salmão').addons.map((a) => [a.name, a.price])),
      { Bacon: 5, Ovo: 5, Azeitona: 3, Tomate: 3, Milho: 3, Ervilha: 3, Cebola: 3 }
    )
    assert.deepEqual(item('Pastel de Brigadeiro').addons, [])

    // Drinks.
    const drinks = Object.fromEntries(byCategory.get('Bebidas')!.map((d) => [d.name, d.price]))
    assert.include(drinks, {
      'Coca-Cola Original lata 350 ml': 10,
      'Coca-Cola Zero lata 350 ml': 10,
      'Coca-Cola Original 200 ml': 6,
      'Coca-Cola Original 600 ml': 15,
      'Guaraná Antarctica normal 600 ml': 15,
      'Suco Del Valle Manga lata 290 ml': 10,
      'Guaraviton Açaí 500 ml': 10,
      'H2O Limão 500 ml': 10,
      'Água mineral sem gás 500 ml': 6,
      'Água mineral com gás 500 ml': 8,
    })

    // Portions.
    assert.equal(item('Porção de Batata Frita').price, 60)
    assert.deepEqual(
      groupOf('Porção de Batata Frita', 'Cobertura')!.options.map((o) => [o.name, o.price]),
      [
        ['Cheddar + bacon', 20],
        ['Catupiry + bacon', 20],
        ['Cheddar + Catupiry + bacon', 25],
      ]
    )
    for (const [name, price, flavors] of [
      ['8 Mini Pastéis', 80, 2],
      ['12 Mini Pastéis', 100, 3],
      ['16 Mini Pastéis', 120, 4],
    ] as const) {
      assert.equal(item(name).price, price)
      const choice = groupOf(name, `Escolha ${flavors} sabores`)!
      assert.include(choice, { minChoices: flavors, maxChoices: flavors })
      assert.deepEqual(
        choice.options.map((o) => o.name),
        ['Escarola', 'Brócolis', 'Calabresa', 'Presunto', 'Queijo', 'Frango', 'Carne']
      )
    }
  })

  test('orders charge the spec totals and deduct the recipes once', async ({ client, assert }) => {
    const { store, item, group: groupOf } = await jjStore(client)
    const picks = (itemName: string, groupName: string, names: string[]) => {
      const choice = groupOf(itemName, groupName)!
      return names.map((name) => ({
        groupId: choice.id,
        addonId: choice.options.find((o) => o.name === name)!.id,
      }))
    }
    const order = async (lines: object[]) => {
      const response = await client
        .post(`/api/v1/public/menu/${store.slug}/orders`)
        .json({ customer, paymentMethod: 'counter', lines })
      response.assertStatus(200)
      return await Order.findByOrFail('publicToken', response.body().data.publicToken)
    }
    const stock = async (name: string) => {
      const ingredient = await Ingredient.query().where({ storeId: store.id, name }).firstOrFail()
      return ingredient.stockQuantity
    }

    // Simples: 18 → 21 → 26 → 31.
    const simple = item('Pastel de Carne')
    for (const [count, total] of [
      [0, 18],
      [1, 21],
      [2, 26],
      [3, 31],
    ] as const) {
      const placed = await order([
        {
          itemId: simple.id,
          quantity: 1,
          choices: picks(
            'Pastel de Carne',
            'Recheio extra',
            ['Frango', 'Catupiry', 'Escarola'].slice(0, count)
          ),
        },
      ])
      assert.equal(placed.total, total, `Simples with ${count} extras`)
    }

    // Especiais: 20 → 35 with 3; the cheese is included, bacon + R$ 5.
    const special = item('Pastel de Frango com Queijo')
    const specialOrder = await order([
      {
        itemId: special.id,
        quantity: 1,
        choices: [
          ...picks('Pastel de Frango com Queijo', 'Escolha o queijo', ['Catupiry']),
          ...picks('Pastel de Frango com Queijo', 'Recheio extra', [
            'Palmito',
            'Berinjela',
            'Carne moída',
          ]),
        ],
        addonIds: [special.addons.find((a) => a.name === 'Bacon')!.id],
      },
    ])
    assert.equal(specialOrder.total, 20 + 15 + 5)

    // Fries with the three-topping cover: 85.
    const fries = await order([
      {
        itemId: item('Porção de Batata Frita').id,
        quantity: 1,
        choices: picks('Porção de Batata Frita', 'Cobertura', ['Cheddar + Catupiry + bacon']),
      },
    ])
    assert.equal(fries.total, 85)

    // 12 minis with 3 flavors: R$ 100, 12 mini doughs, 4 of each flavor.
    const doughBefore = await stock('Massa de mini pastel')
    const meatBefore = await stock('Carne moída')
    const minis = await order([
      {
        itemId: item('12 Mini Pastéis').id,
        quantity: 1,
        choices: picks('12 Mini Pastéis', 'Escolha 3 sabores', ['Carne', 'Queijo', 'Frango']),
      },
    ])
    assert.equal(minis.total, 100)
    assert.equal(await stock('Massa de mini pastel'), doughBefore - 12)
    assert.equal(await stock('Carne moída'), meatBefore - 80)

    // A can deducts its own SKU, never the 200 ml bottle.
    const can = await stock('Coca-Cola Original lata 350 ml')
    const bottle = await stock('Coca-Cola Original 200 ml')
    await order([{ itemId: item('Coca-Cola Original lata 350 ml').id, quantity: 2 }])
    assert.equal(await stock('Coca-Cola Original lata 350 ml'), can - 2)
    assert.equal(await stock('Coca-Cola Original 200 ml'), bottle)

    // The cheese of choice is the only cheese a "com queijo" pastry deducts.
    const mussarela = await stock('Mussarela')
    const catupiry = await stock('Catupiry')
    await order([
      {
        itemId: item('Pastel de Carne com Queijo').id,
        quantity: 1,
        choices: picks('Pastel de Carne com Queijo', 'Escolha o queijo', ['Catupiry']),
      },
    ])
    assert.equal(await stock('Mussarela'), mussarela)
    assert.equal(await stock('Catupiry'), catupiry - 40)
  })

  test('the catalog only goes into an empty store', async ({ client, assert }) => {
    const { store } = await jjStore(client)
    await assert.rejects(
      () => new CatalogImportService().import(store, JJ_PASTEIS, { photos: false }),
      /só entra numa loja vazia/
    )
  })

  test('the profile fills what the store left empty, never what it typed', async ({ assert }) => {
    const store = await createStore()
    store.address = 'Endereço digitado no painel'
    await store.save()

    const filled = await new CatalogImportService().applyProfile(store, JJ_PASTEIS_PROFILE)

    await store.refresh()
    assert.sameMembers(filled, ['description', 'instagramUrl', 'photoUrl', 'bannerUrl'])
    assert.equal(store.address, 'Endereço digitado no painel')
    assert.include(store.description!, 'desde 2021')
    assert.match(store.bannerUrl!, /\/uploads\/banners\//)
    assert.match(store.photoUrl!, /\/uploads\/photos\//)
  })
})
