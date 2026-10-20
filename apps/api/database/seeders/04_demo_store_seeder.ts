import { readFile } from 'node:fs/promises'
import app from '@adonisjs/core/services/app'
import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'
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

/**
 * Demo data for local development: the JJ Pastéis menu as the default store,
 * linked to the bootstrap admin. Never runs in production; skipped if the
 * store already exists.
 */
export default class DemoStoreSeeder extends BaseSeeder {
  static environment = ['development', 'test']

  async run() {
    if (await Store.findBy('slug', 'jj-pasteis')) return

    const menu: MenuJson = JSON.parse(
      await readFile(app.makePath('database/data/jj_pasteis_menu.json'), 'utf-8')
    )
    const admin = await User.findByOrFail('email', env.get('ADMIN_USER'))

    await db.transaction(async (trx) => {
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
    })
  }
}
