import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
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
import type { Catalog, CatalogStoreProfile, RecipeLine } from '#catalog/types'
import { blurPlaceholder } from '#helpers/image_placeholder'

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
            photoBlur: definition.photo && photos ? await photos.blur(definition.photo) : null,
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
            allowRepeat: definition.allowRepeat ?? false,
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
              photoBlur: source.photo && photos ? await photos.blur(source.photo) : null,
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

  /**
   * The store's description, address, Instagram, logo and banner, where the
   * store left them empty (what was typed or uploaded in the panel stays).
   * Answers the fields it filled.
   */
  async applyProfile(store: Store, profile: CatalogStoreProfile) {
    const filled: string[] = []
    for (const field of ['description', 'address', 'instagramUrl'] as const) {
      if (store[field]) continue
      store[field] = profile[field]
      filled.push(field)
    }
    for (const [field, blurField, file, folder] of [
      ['photoUrl', 'photoBlur', profile.logo, 'photos'],
      ['bannerUrl', 'bannerBlur', profile.banner, 'banners'],
    ] as const) {
      if (store[field]) continue
      const path = app.makePath('database/data', file)
      store[field] = await storeFile(`${folder}/${store.id}_catalog${extname(file)}`, path)
      store[blurField] = await blurPlaceholder(path)
      filled.push(field)
    }
    await store.save()
    return filled
  }

  /**
   * Photos from a local folder (outside git: the store's own or ones it
   * chose), matched by the item's or add-on's name as a slug
   * ("Pastel de Palmito" -> pastel-de-palmito.webp|jpg|jpeg|png). Replaces
   * empty and catalog photos; photos uploaded in the panel only with `force`.
   */
  async applyLocalPhotos(store: Store, dir: string, options: { force?: boolean } = {}) {
    const files = new Map<string, string>()
    for (const file of await readdir(dir)) {
      const ext = extname(file).toLowerCase()
      if (['.webp', '.jpg', '.jpeg', '.png'].includes(ext))
        files.set(file.slice(0, -ext.length), file)
    }
    const replaceable = (url: string | null) =>
      options.force || !url || url.includes('/menu/catalog-') || url.includes('/menu/local-')
    const applied: string[] = []
    const skipped: string[] = []
    const items = await Item.query().whereHas('category', (query) =>
      query.where('storeId', store.id)
    )
    const addons = await Addon.query().where('storeId', store.id)
    for (const record of [...items, ...addons]) {
      const file = files.get(photoSlug(record.name))
      if (!file) continue
      if (!replaceable(record.photoUrl)) {
        skipped.push(record.name)
        continue
      }
      const content = await readFile(join(dir, file))
      const hash = createHash('sha256').update(content).digest('hex').slice(0, 8)
      record.photoUrl = await storeFile(
        `menu/local-${photoSlug(record.name)}-${hash}${extname(file).toLowerCase()}`,
        join(dir, file)
      )
      record.photoBlur = await blurPlaceholder(content)
      await record.save()
      applied.push(record.name)
    }
    const used = new Set([...items, ...addons].map((record) => photoSlug(record.name)))
    const unmatched = [...files.keys()].filter((slug) => !used.has(slug))
    return { applied, skipped, unmatched }
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
  private urls = new Map<string, string>()
  private blurs = new Map<string, string | null>()

  get count() {
    return this.urls.size
  }

  async url(file: string) {
    const cached = this.urls.get(file)
    if (cached) return cached
    const url = await storeFile(`menu/catalog-${file}`, this.path(file))
    this.urls.set(file, url)
    return url
  }

  /** The blurred preview of a photo, made on first use. */
  async blur(file: string) {
    if (!this.blurs.has(file)) this.blurs.set(file, await blurPlaceholder(this.path(file)))
    return this.blurs.get(file) ?? null
  }

  private path(file: string) {
    return app.makePath('database/data/menu-photos', file)
  }
}

/** "Pastel de Palmito" -> "pastel-de-palmito" (the photo's file name). */
export function photoSlug(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Puts a file on the Drive disk and answers its public URL. Outside an HTTP
 * server (seeders, Ace) the local disk has no route to build the URL from,
 * so its /uploads path on APP_URL.
 */
async function storeFile(key: string, path: string) {
  const disk = drive.use()
  await disk.put(key, await readFile(path))
  try {
    return await disk.getUrl(key)
  } catch {
    return `${env.get('APP_URL').replace(/\/$/, '')}/uploads/${key}`
  }
}
