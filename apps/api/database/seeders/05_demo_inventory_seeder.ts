import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'
import IngredientUnit from '#enums/ingredient_unit'
import StockMovementType from '#enums/stock_movement_type'
import Addon from '#models/addon'
import Category from '#models/category'
import Ingredient from '#models/ingredient'
import Item from '#models/item'
import StockMovement from '#models/stock_movement'
import Store from '#models/store'
import { suggestIngredientIcon } from '#kitchen/ingredient_icons'

type Stock = { unit: IngredientUnit; stock: number; min: number }

/** Demo ingredients with opening stock (grams, units). */
const INGREDIENTS: Record<string, Stock> = {
  'Massa de pastel': { unit: IngredientUnit.UNIT, stock: 400, min: 80 },
  'Carne moída': { unit: IngredientUnit.GRAM, stock: 8000, min: 1500 },
  'Mussarela': { unit: IngredientUnit.GRAM, stock: 6000, min: 1000 },
  'Frango desfiado': { unit: IngredientUnit.GRAM, stock: 5000, min: 1000 },
  'Presunto': { unit: IngredientUnit.GRAM, stock: 3000, min: 500 },
  'Calabresa': { unit: IngredientUnit.GRAM, stock: 3000, min: 500 },
  'Brócolis': { unit: IngredientUnit.GRAM, stock: 2000, min: 400 },
  'Escarola': { unit: IngredientUnit.GRAM, stock: 2000, min: 400 },
  'Tomate': { unit: IngredientUnit.GRAM, stock: 2000, min: 400 },
  'Orégano': { unit: IngredientUnit.GRAM, stock: 300, min: 50 },
  'Ovo': { unit: IngredientUnit.UNIT, stock: 60, min: 12 },
  'Catupiry': { unit: IngredientUnit.GRAM, stock: 3000, min: 500 },
  'Cheddar': { unit: IngredientUnit.GRAM, stock: 2000, min: 400 },
  'Parmesão': { unit: IngredientUnit.GRAM, stock: 1000, min: 200 },
  'Cream cheese': { unit: IngredientUnit.GRAM, stock: 1500, min: 300 },
  'Bacon': { unit: IngredientUnit.GRAM, stock: 2000, min: 400 },
  'Milho': { unit: IngredientUnit.GRAM, stock: 1500, min: 300 },
  'Azeitona': { unit: IngredientUnit.GRAM, stock: 1000, min: 200 },
  'Palmito': { unit: IngredientUnit.GRAM, stock: 1500, min: 300 },
  'Beringela': { unit: IngredientUnit.GRAM, stock: 1500, min: 300 },
  'Camarão 7 barbas': { unit: IngredientUnit.GRAM, stock: 2000, min: 400 },
  'Camarão rosa': { unit: IngredientUnit.GRAM, stock: 1500, min: 300 },
  'Salmão': { unit: IngredientUnit.GRAM, stock: 1500, min: 300 },
  'Carne seca': { unit: IngredientUnit.GRAM, stock: 2000, min: 400 },
  'Molho rosé': { unit: IngredientUnit.GRAM, stock: 800, min: 150 },
  'Chocolate ao leite': { unit: IngredientUnit.GRAM, stock: 2000, min: 400 },
  'Chocolate branco': { unit: IngredientUnit.GRAM, stock: 1500, min: 300 },
  'KitKat': { unit: IngredientUnit.UNIT, stock: 40, min: 10 },
  'Doce de leite': { unit: IngredientUnit.GRAM, stock: 1500, min: 300 },
  'Goiabada': { unit: IngredientUnit.GRAM, stock: 1500, min: 300 },
  'Nutella': { unit: IngredientUnit.GRAM, stock: 1500, min: 300 },
  'Banana': { unit: IngredientUnit.UNIT, stock: 40, min: 10 },
  'Açúcar e canela': { unit: IngredientUnit.GRAM, stock: 800, min: 150 },
}

const MAIN = 80
const SECOND = 40
const CHEESE = 40

/** Filling per pastry name (the pastry dough is added to every pastry). */
const RECIPES: Record<string, [string, number][]> = {
  'Pastel de Carne': [['Carne moída', MAIN]],
  'Pastel de Queijo': [['Mussarela', MAIN]],
  'Pastel de Frango': [['Frango desfiado', MAIN]],
  'Pastel de Presunto': [['Presunto', MAIN]],
  'Pastel de Calabresa': [['Calabresa', MAIN]],
  'Pastel de Brócolis': [['Brócolis', MAIN]],
  'Pastel de Escarola': [['Escarola', MAIN]],
  'Pastel de Pizza': [
    ['Mussarela', MAIN],
    ['Tomate', 20],
    ['Orégano', 2],
  ],
  'Pastel de Calafrango': [
    ['Calabresa', SECOND],
    ['Frango desfiado', SECOND],
  ],
  'Pastel de Beringela': [['Beringela', MAIN]],
  'Pastel de Palmito': [
    ['Palmito', MAIN],
    ['Catupiry', 20],
  ],
  'Pastel de Bauru': [
    ['Presunto', SECOND],
    ['Mussarela', SECOND],
    ['Orégano', 2],
  ],
  'Pastel de Camarão': [
    ['Camarão 7 barbas', MAIN],
    ['Catupiry', 20],
  ],
  'Pastel de Carne Seca': [['Carne seca', MAIN]],
  'Pastel de Carne com Ovo': [
    ['Carne moída', MAIN],
    ['Ovo', 1],
  ],
  'Pastel de Carne com Queijo': [
    ['Carne moída', MAIN],
    ['Mussarela', CHEESE],
  ],
  'Pastel de FranBacon': [
    ['Frango desfiado', SECOND],
    ['Bacon', SECOND],
  ],
  'Pastel de Frango com Queijo': [
    ['Frango desfiado', MAIN],
    ['Mussarela', CHEESE],
  ],
  'Pastel de Brócolis com Queijo': [
    ['Brócolis', MAIN],
    ['Mussarela', CHEESE],
  ],
  'Pastel de Escarola com Queijo': [
    ['Escarola', MAIN],
    ['Mussarela', CHEESE],
  ],
  'Pastel de Presunto com Queijo': [
    ['Presunto', MAIN],
    ['Mussarela', CHEESE],
  ],
  'Pastel de Calabresa com Queijo': [
    ['Calabresa', MAIN],
    ['Mussarela', CHEESE],
  ],
  'Pastel de Portuguesa': [
    ['Ovo', 1],
    ['Mussarela', SECOND],
    ['Presunto', SECOND],
    ['Orégano', 2],
  ],
  'Pastel Vegetariano': [
    ['Brócolis', SECOND],
    ['Mussarela', SECOND],
    ['Tomate', 20],
    ['Azeitona', 15],
  ],
  'Pastel Vegano': [
    ['Brócolis', SECOND],
    ['Escarola', SECOND],
    ['Tomate', 20],
    ['Azeitona', 15],
  ],
  'Pastel de 4 Queijos': [
    ['Mussarela', 30],
    ['Catupiry', 30],
    ['Cheddar', 30],
    ['Parmesão', 15],
  ],
  'Pastel Frango Supremo': [
    ['Frango desfiado', MAIN],
    ['Mussarela', 30],
    ['Tomate', 20],
    ['Milho', 20],
  ],
  'Pastel de Camarão com Queijo': [
    ['Camarão 7 barbas', MAIN],
    ['Mussarela', CHEESE],
  ],
  'Pastel de Carne Seca com Queijo': [
    ['Carne seca', MAIN],
    ['Mussarela', CHEESE],
  ],
  'Pastel de Camarão Rosa': [
    ['Camarão rosa', MAIN],
    ['Molho rosé', 30],
    ['Mussarela', CHEESE],
  ],
  'Pastel de Salmão': [
    ['Salmão', MAIN],
    ['Cream cheese', CHEESE],
  ],
  'Pastel de Brigadeiro': [['Chocolate ao leite', MAIN]],
  'Pastel de KitKat': [
    ['Chocolate ao leite', 50],
    ['KitKat', 1],
  ],
  'Pastel de Doce de Leite': [['Doce de leite', MAIN]],
  'Pastel Romeu e Julieta': [
    ['Goiabada', 50],
    ['Mussarela', SECOND],
  ],
  'Pastel de Nutella': [['Nutella', MAIN]],
  'Pastel de Chocolate Branco': [['Chocolate branco', MAIN]],
  'Pastel de Banana com Canela': [
    ['Banana', 1],
    ['Açúcar e canela', 10],
  ],
}

const ADDON_RECIPES: Record<string, [string, number][]> = {
  'Catupiry Extra': [['Catupiry', 30]],
  'Queijo Extra': [['Mussarela', 30]],
  'Tomate': [['Tomate', 20]],
  'Milho': [['Milho', 20]],
  'Ovo': [['Ovo', 1]],
  'Bacon': [['Bacon', 20]],
}

/**
 * Demo stock and recipes for the JJ Pastéis store (development only). Drinks
 * are tracked as one-unit ingredients and skip the kitchen. Skipped when the
 * store already has ingredients.
 */
export default class DemoInventorySeeder extends BaseSeeder {
  static environment = ['development', 'test']

  async run() {
    const store = await Store.findBy('slug', 'jj-pasteis')
    if (!store) return
    if (await Ingredient.query().where('storeId', store.id).first()) return

    await db.transaction(async (trx) => {
      const byName = new Map<string, Ingredient>()
      const create = async (name: string, stock: Stock) => {
        const ingredient = await Ingredient.create(
          {
            storeId: store.id,
            name,
            unit: stock.unit,
            icon: suggestIngredientIcon(name),
            minStock: stock.min,
            stockQuantity: stock.stock,
          },
          { client: trx }
        )
        await StockMovement.create(
          {
            storeId: store.id,
            ingredientId: ingredient.id,
            type: StockMovementType.ADJUSTMENT,
            quantity: stock.stock,
            note: 'Estoque inicial (demo)',
          },
          { client: trx }
        )
        byName.set(name, ingredient)
        return ingredient
      }

      for (const [name, stock] of Object.entries(INGREDIENTS)) await create(name, stock)

      const items = await Item.query({ client: trx })
        .whereHas('category', (category) => category.where('store_id', store.id))
        .preload('category')
      const pivot = (lines: [string, number][]) =>
        Object.fromEntries(lines.map(([name, quantity]) => [byName.get(name)!.id, { quantity }]))

      for (const item of items) {
        const filling = RECIPES[item.name]
        if (filling) {
          await item.related('ingredients').attach(pivot([['Massa de pastel', 1], ...filling]))
        } else if (item.category.name === 'Bebidas') {
          // Two drinks share a name with different sizes; one stock line each.
          const label = `${item.name} (${item.description})`
          const drink = await create(label, { unit: IngredientUnit.UNIT, stock: 48, min: 12 })
          await item.related('ingredients').attach({ [drink.id]: { quantity: 1 } })
        }
      }

      const addons = await Addon.query({ client: trx }).where('storeId', store.id)
      for (const addon of addons) {
        const recipe = ADDON_RECIPES[addon.name]
        if (recipe) await addon.related('ingredients').attach(pivot(recipe))
      }

      await Category.query({ client: trx })
        .where({ storeId: store.id, name: 'Bebidas' })
        .update({ requiresPreparation: false })

      store.useTransaction(trx)
      store.merge({
        inventoryEnabled: true,
        phone: '5511912345678',
        description: 'Pastéis feitos na hora, crocantes e bem recheados desde 1998.',
        pickupEtaMinutes: 15,
      })
      await store.save()
    })
  }
}
