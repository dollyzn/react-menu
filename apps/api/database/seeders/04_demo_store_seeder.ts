import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import app from '@adonisjs/core/services/app'
import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'
import drive from '@adonisjs/drive/services/main'
import env from '#start/env'
import StoreStatus from '#enums/store_status'
import Addon from '#models/addon'
import Category from '#models/category'
import Item from '#models/item'
import Store from '#models/store'
import User from '#models/user'

type MenuJson = {
  name: string
  description: string
  itens: { nome: string; descricao: string; preco: number }[]
}[]

/** The JSON category whose entries become add-ons instead of items. */
const ADDONS_CATEGORY = 'Adicionais'
/** Categories whose items accept the savory add-ons. */
const SAVORY_CATEGORIES = [
  'Pastéis Simples',
  'Pastéis Especiais',
  'Pastéis Selecionados',
  'Pastéis Premium',
]

/** Item and add-on photos (Pexels, see database/data/CREDITS.md). */
type PhotoManifest = { items: Record<string, number>; addons: Record<string, number> }

/** Store images, stored through Drive like an upload from the panel. */
const IMAGES = [
  { field: 'bannerUrl', file: 'jj-banner.jpg', folder: 'banners' },
  { field: 'photoUrl', file: 'jj-logo.png', folder: 'photos' },
] as const

/**
 * Demo data for local development: the JJ Pastéis menu as the default store,
 * linked to the bootstrap admin. Never runs in production. Safe to run again:
 * the menu is created once, and images are added only where missing.
 */
export default class DemoStoreSeeder extends BaseSeeder {
  static environment = ['development', 'test']

  async run() {
    const store = (await Store.findBy('slug', 'jj-pasteis')) ?? (await this.createStore())
    await this.addImages(store)
    await this.addMenuPhotos(store)
  }

  /** Public URL of a file on the fs disk (getUrl() needs the HTTP routes). */
  private uploadUrl(key: string) {
    return `${env.get('APP_URL').replace(/\/$/, '')}/uploads/${key}`
  }

  /**
   * Gives every item and add-on its photo, stored on Drive. Photos already on
   * Drive are kept; empty or external ones (older seeds) are replaced.
   */
  private async addMenuPhotos(store: Store) {
    const manifest: PhotoManifest = JSON.parse(
      await readFile(app.makePath('database/data/menu_photos.json'), 'utf-8')
    )
    const disk = drive.use()
    const urls = new Map<number, string>()
    const urlFor = async (photoId: number) => {
      if (!urls.has(photoId)) {
        const file = `pexels-${photoId}.webp`
        // Same file for every demo store (and e2e run): no duplicates on disk.
        const key = `menu/demo-${file}`
        await disk.put(key, await readFile(app.makePath('database/data/menu-photos', file)))
        urls.set(photoId, this.uploadUrl(key))
      }
      return urls.get(photoId)!
    }
    // Only files served by our own Drive disk count as uploaded.
    const needsPhoto = (url: string | null) => !url?.startsWith(this.uploadUrl(''))

    const items = await Item.query().whereHas('category', (query) =>
      query.where('storeId', store.id)
    )
    for (const item of items) {
      const photoId =
        manifest.items[`${item.name}|${item.description}`] ?? manifest.items[item.name]
      if (!photoId || !needsPhoto(item.photoUrl)) continue
      item.photoUrl = await urlFor(photoId)
      await item.save()
    }

    for (const addon of await Addon.query().where('storeId', store.id)) {
      const photoId = manifest.addons[addon.name]
      if (!photoId || !needsPhoto(addon.photoUrl)) continue
      addon.photoUrl = await urlFor(photoId)
      await addon.save()
    }
  }

  /** Never overwrites an image uploaded from the panel. */
  private async addImages(store: Store) {
    const disk = drive.use()
    for (const image of IMAGES) {
      if (store[image.field]) continue
      const key = `${image.folder}/${store.id}_seed${extname(image.file)}`
      await disk.put(key, await readFile(app.makePath('database/data', image.file)))
      store[image.field] = this.uploadUrl(key)
    }
    await store.save()
  }

  private async createStore(): Promise<Store> {
    const menu: MenuJson = JSON.parse(
      await readFile(app.makePath('database/data/jj_pasteis_menu.json'), 'utf-8')
    )
    const admin = await User.findByOrFail('email', env.get('ADMIN_USER'))

    return await db.transaction(async (trx) => {
      const store = await Store.create(
        {
          name: 'JJ Pastéis',
          slug: 'jj-pasteis',
          status: StoreStatus.OPEN,
          address: 'Rua das Flores, 123 - Centro',
          instagramUrl: 'https://www.instagram.com/jjpasteis',
          isDefault: true,
        },
        { client: trx }
      )
      await store.related('users').attach([admin.id])

      const addonsSource = menu.find((category) => category.name === ADDONS_CATEGORY)?.itens ?? []
      const addons = await Addon.createMany(
        addonsSource.map((addon) => ({
          storeId: store.id,
          name: addon.nome,
          description: addon.descricao,
          price: addon.preco,
        })),
        { client: trx }
      )

      const categories = menu.filter((category) => category.name !== ADDONS_CATEGORY)
      for (const [categoryIndex, source] of categories.entries()) {
        const category = await Category.create(
          {
            storeId: store.id,
            name: source.name,
            description: source.description || null,
            order: categoryIndex + 1,
          },
          { client: trx }
        )

        const items = await Item.createMany(
          source.itens.map((item, itemIndex) => ({
            categoryId: category.id,
            name: item.nome,
            description: item.descricao.trim() || null,
            price: item.preco,
            order: itemIndex + 1,
          })),
          { client: trx }
        )

        if (SAVORY_CATEGORIES.includes(source.name)) {
          for (const item of items) {
            await item.related('addons').attach(addons.map((addon) => addon.id))
          }
        }
      }
      return store
    })
  }
}
