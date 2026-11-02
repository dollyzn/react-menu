import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import Addon from '#models/addon'
import Ingredient from '#models/ingredient'
import Item from '#models/item'
import OptionGroup from '#models/option_group'
import Store from '#models/store'

/** Grams of filling in an extra or a cheese of choice. */
const PORTION = 40

/** Add-ons the groups offer, with their own price and recipe (ingredient name). */
const OPTIONS: Record<string, { price: number; ingredient: string }> = {
  'Carne': { price: 3, ingredient: 'Carne moída' },
  'Frango': { price: 3, ingredient: 'Frango desfiado' },
  'Mussarela': { price: 3, ingredient: 'Mussarela' },
  'Catupiry': { price: 3, ingredient: 'Catupiry' },
  'Calabresa': { price: 3, ingredient: 'Calabresa' },
  'Presunto': { price: 3, ingredient: 'Presunto' },
  'Palmito': { price: 3, ingredient: 'Palmito' },
  'Cheddar': { price: 3, ingredient: 'Cheddar' },
  'Cream cheese': { price: 3, ingredient: 'Cream cheese' },
}

const GROUPS = [
  {
    // Replaces the old "Recheio Extra" add-on, whose filling went in the notes.
    name: 'Recheio extra',
    minChoices: 0,
    maxChoices: 3,
    price: 3,
    options: ['Carne', 'Frango', 'Mussarela', 'Catupiry', 'Calabresa', 'Presunto', 'Palmito'],
    categories: ['Pastéis Simples', 'Pastéis Especiais', 'Pastéis Selecionados', 'Pastéis Premium'],
    // Meat fillings make no sense here.
    except: ['Pastel Vegano', 'Pastel Vegetariano'],
  },
  {
    // The same Mussarela and Catupiry, free in this group.
    name: 'Escolha o queijo',
    minChoices: 1,
    maxChoices: 1,
    price: 0,
    options: ['Mussarela', 'Catupiry', 'Cheddar', 'Cream cheese'],
    categories: ['Pastéis Premium'],
    except: [],
  },
]

/** The generic add-on the "Recheio extra" group replaces. */
const LEGACY_EXTRA = 'Recheio Extra'

/**
 * Demo choice groups for JJ Pastéis (development only): an optional extra
 * filling (up to 3) on the savory pastries and a cheese of choice on the premium ones.
 * Runs after the inventory seeder so the new options get recipes. Skipped
 * when the store already has the groups.
 */
export default class DemoChoiceGroupsSeeder extends BaseSeeder {
  static environment = ['development', 'test']

  async run() {
    const store = await Store.findBy('slug', 'jj-pasteis')
    if (!store) return
    const existing = await OptionGroup.query()
      .where('storeId', store.id)
      .whereIn(
        'name',
        GROUPS.map((group) => group.name)
      )
      .first()
    if (existing) return

    await db.transaction(async (trx) => {
      const addons = await this.options(store, trx)
      const items = await Item.query({ client: trx })
        .whereHas('category', (category) => category.where('store_id', store.id))
        .preload('category')
        .preload('optionGroups')

      for (const definition of GROUPS) {
        const group = await OptionGroup.create(
          {
            storeId: store.id,
            name: definition.name,
            minChoices: definition.minChoices,
            maxChoices: definition.maxChoices,
          },
          { client: trx }
        )
        await group
          .related('options')
          .attach(
            Object.fromEntries(
              definition.options.map((name, order) => [
                addons.get(name)!.id,
                { order, price: definition.price },
              ])
            )
          )
        for (const item of items) {
          if (!definition.categories.includes(item.category.name)) continue
          if (definition.except.includes(item.name)) continue
          // Required groups (the cheese) come before the optional extra.
          const order = definition.minChoices > 0 ? -1 : item.optionGroups.length
          await item.related('optionGroups').attach({ [group.id]: { order } })
        }
      }

      // Past orders keep its name; the add-on itself goes away.
      await Addon.query({ client: trx }).where({ storeId: store.id, name: LEGACY_EXTRA }).delete()
    })
  }

  /** The options' add-ons by name, created (with their recipe) where missing. */
  private async options(store: Store, trx: TransactionClientContract) {
    const byName = new Map<string, Addon>()
    const ingredients = await Ingredient.query({ client: trx }).where('storeId', store.id)
    for (const [name, option] of Object.entries(OPTIONS)) {
      let addon = await Addon.query({ client: trx }).where({ storeId: store.id, name }).first()
      if (!addon) {
        addon = await Addon.create(
          { storeId: store.id, name, price: option.price },
          { client: trx }
        )
        const ingredient = ingredients.find((candidate) => candidate.name === option.ingredient)
        if (ingredient) {
          await addon.related('ingredients').attach({ [ingredient.id]: { quantity: PORTION } })
        }
      }
      byName.set(name, addon)
    }
    return byName
  }
}
