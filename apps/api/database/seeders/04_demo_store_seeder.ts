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
  itens: { nome: string; descricao: string; preco: number; foto: string }[]
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
  }

  /** Never overwrites an image uploaded from the panel. */
  private async addImages(store: Store) {
    const disk = drive.use()
    for (const image of IMAGES) {
      if (store[image.field]) continue
      const key = `${image.folder}/${store.id}_seed${extname(image.file)}`
      await disk.put(key, await readFile(app.makePath('database/data', image.file)))
      // Same URL the fs disk serves (routeBasePath /uploads); getUrl() needs
      // the HTTP routes, which ace commands don't register.
      store[image.field] = `${env.get('APP_URL').replace(/\/$/, '')}/uploads/${key}`
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
          photoUrl: addon.foto,
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
            photoUrl: item.foto,
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
