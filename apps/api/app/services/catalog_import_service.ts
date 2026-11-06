import { readFile } from 'node:fs/promises'
import app from '@adonisjs/core/services/app'
import drive from '@adonisjs/drive/services/main'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import AppException from '#exceptions/app_exception'
import IngredientUnit from '#enums/ingredient_unit'
import StockMovementType from '#enums/stock_movement_type'
import Addon from '#models/addon'
import Category from '#models/category'
import Ingredient from '#models/ingredient'
import Item from '#models/item'
import OptionGroup from '#models/option_group'
import StockMovement from '#models/stock_movement'
import type Store from '#models/store'
import env from '#start/env'
import { suggestIngredientIcon } from '#kitchen/ingredient_icons'
import type { Catalog, RecipeLine } from '#catalog/types'

export type ImportSummary = {
  categories: number
  items: number
  addons: number
  groups: number
  ingredients: number
  photos: number
}

/**
 * Loads a catalog (menu, add-ons, choice groups, stock and recipes) into a
 * store that has none yet, in one transaction. Turns stock tracking on.
 */
export default class CatalogImportService {
  /** Refuses a store that already has a menu, add-ons, groups or stock. */
  async assertEmpty(store: Store) {
    const [categories, addons, groups, ingredients] = await Promise.all(
      ['categories', 'addons', 'option_groups', 'ingredients'].map((table) =>
        db.from(table).where('store_id', store.id).first()
      )
    )
    if (categories || addons || groups || ingredients) {
      throw new AppException(
        `A loja "${store.name}" já tem cardápio, adicionais, grupos ou estoque: o catálogo só entra numa loja vazia.`,
        409,
        'E_STORE_NOT_EMPTY'
      )
    }
  }

  async import(
    store: Store,
    catalog: Catalog,
    options: { photos?: boolean; note?: string } = {}
  ): Promise<ImportSummary> {
    await this.assertEmpty(store)
    const photos = options.photos === false ? null : new PhotoStore()
    const note = options.note ?? 'Estoque inicial'

    return await db.transaction(async (trx) => {
      const ingredients = new Map<string, Ingredient>()
      const addStock = async (name: string, unit: IngredientUnit, stock: number, min: number) => {
        const ingredient = await Ingredient.create(
          {
            storeId: store.id,
            name,
            unit,
            icon: suggestIngredientIcon(name),
            minStock: min,
            stockQuantity: stock,
          },
          { client: trx }
        )
        await StockMovement.create(
          {
            storeId: store.id,
            ingredientId: ingredient.id,
            type: StockMovementType.ADJUSTMENT,
            quantity: stock,
            note,
          },
          { client: trx }
        )
        ingredients.set(name, ingredient)
      }
      for (const ingredient of catalog.ingredients) {
        await addStock(ingredient.name, ingredient.unit, ingredient.stock, ingredient.min)
      }
      for (const category of catalog.categories) {
        for (const item of category.items) {
          if (item.stock)
            await addStock(item.name, IngredientUnit.UNIT, item.stock.stock, item.stock.min)
        }
      }
      const recipe = (lines: RecipeLine[], owner: string) =>
        Object.fromEntries(
          lines.map(([name, quantity]) => {
            const ingredient = ingredients.get(name)
            if (!ingredient)
              throw new Error(`Catalog: "${owner}" uses unknown stock item "${name}"`)
            return [ingredient.id, { quantity }]
          })
        )

      const addons = new Map<string, Addon>()
      for (const definition of catalog.addons) {
        const addon = await Addon.create(
          {
            storeId: store.id,
            name: definition.name,
            description: definition.description ?? null,
            price: definition.price,
            photoUrl: definition.photo && photos ? await photos.url(definition.photo) : null,
          },
          { client: trx }
        )
        await addon.related('ingredients').attach(recipe(definition.recipe, definition.name))
        addons.set(definition.key, addon)
      }
      const addonFor = (key: string, owner: string) => {
        const addon = addons.get(key)
        if (!addon) throw new Error(`Catalog: "${owner}" uses unknown add-on "${key}"`)
        return addon
      }

      const groups = new Map<string, OptionGroup>()
      for (const definition of catalog.groups) {
        const group = await OptionGroup.create(
          {
            storeId: store.id,
            name: definition.name,
            minChoices: definition.minChoices,
            maxChoices: definition.maxChoices,
            pickPrices: definition.pickPrices ?? null,
          },
          { client: trx }
        )
        await group
          .related('options')
          .attach(
            Object.fromEntries(
              definition.options.map((key, order) => [
                addonFor(key, definition.name).id,
                { order, price: definition.optionPrice ?? null },
              ])
            )
          )
        groups.set(definition.key, group)
      }

      let items = 0
      for (const [categoryOrder, definition] of catalog.categories.entries()) {
        const category = await Category.create(
          {
            storeId: store.id,
            name: definition.name,
            description: definition.description ?? null,
            order: categoryOrder + 1,
            requiresPreparation: definition.requiresPreparation ?? true,
          },
          { client: trx }
        )
        for (const [itemOrder, source] of definition.items.entries()) {
          const price = source.price ?? definition.price
          if (price === undefined) throw new Error(`Catalog: "${source.name}" has no price`)
          const item = await Item.create(
            {
              categoryId: category.id,
              name: source.name,
              description: source.description || null,
              price,
              order: itemOrder + 1,
              photoUrl: source.photo && photos ? await photos.url(source.photo) : null,
            },
            { client: trx }
          )
          if (source.recipe.length) {
            await item.related('ingredients').attach(recipe(source.recipe, source.name))
          }
          if (source.groups.length) {
            await item.related('optionGroups').attach(
              Object.fromEntries(
                source.groups.map((key, order) => {
                  const group = groups.get(key)
                  if (!group)
                    throw new Error(`Catalog: "${source.name}" uses unknown group "${key}"`)
                  return [group.id, { order }]
                })
              )
            )
          }
          if (source.addons.length) {
            await item
              .related('addons')
              .attach(source.addons.map((key) => addonFor(key, source.name).id))
          }
          items++
        }
      }

      await this.enableInventory(store, trx)
      return {
        categories: catalog.categories.length,
        items,
        addons: addons.size,
        groups: groups.size,
        ingredients: ingredients.size,
        photos: photos?.count ?? 0,
      }
    })
  }

  private async enableInventory(store: Store, trx: TransactionClientContract) {
    store.useTransaction(trx)
    store.inventoryEnabled = true
    await store.save()
  }
}

/**
 * The catalog's photos (database/data/menu-photos), stored once on Drive
 * like an upload from the panel and shared by every item that uses them.
 * Under `menu/`, so deleting an item's photo never removes a shared file.
 */
class PhotoStore {
  private urls = new Map<number, string>()

  get count() {
    return this.urls.size
  }

  async url(photoId: number) {
    const cached = this.urls.get(photoId)
    if (cached) return cached
    const file = `pexels-${photoId}.webp`
    const key = `menu/catalog-${file}`
    const disk = drive.use()
    await disk.put(key, await readFile(app.makePath('database/data/menu-photos', file)))
    const url = await this.publicUrl(key)
    this.urls.set(photoId, url)
    return url
  }

  /**
   * The disk's URL; outside an HTTP server (seeders, Ace) the local disk has
   * no route to build it from, so its /uploads path on APP_URL.
   */
  private async publicUrl(key: string) {
    try {
      return await drive.use().getUrl(key)
    } catch {
      return `${env.get('APP_URL').replace(/\/$/, '')}/uploads/${key}`
    }
  }
}
