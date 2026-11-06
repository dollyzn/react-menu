import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import app from '@adonisjs/core/services/app'
import { BaseSeeder } from '@adonisjs/lucid/seeders'
import drive from '@adonisjs/drive/services/main'
import env from '#start/env'
import StoreStatus from '#enums/store_status'
import Store from '#models/store'
import User from '#models/user'
import AppException from '#exceptions/app_exception'
import CatalogImportService from '#services/catalog_import_service'
import { JJ_PASTEIS } from '#catalog/jj_pasteis'

/** Store images, stored through Drive like an upload from the panel. */
const IMAGES = [
  { field: 'bannerUrl', file: 'jj-banner.jpg', folder: 'banners' },
  { field: 'photoUrl', file: 'jj-logo.png', folder: 'photos' },
] as const

/**
 * Demo data for local development and tests: JJ Pastéis as the default
 * store, linked to the bootstrap admin, with its real catalog (menu, groups,
 * stock: app/catalog/jj_pasteis.ts, the same `node ace jj:setup` loads in
 * production). Never runs in production. Safe to run again: the store and
 * its catalog are created once, images only where missing.
 */
export default class DemoStoreSeeder extends BaseSeeder {
  static environment = ['development', 'test']

  async run() {
    const store = (await Store.findBy('slug', 'jj-pasteis')) ?? (await this.createStore())
    await this.addImages(store)
    try {
      await new CatalogImportService().import(store, JJ_PASTEIS, { note: 'Estoque inicial (demo)' })
    } catch (error) {
      // Already loaded (or edited in the panel): keep it.
      if (!(error instanceof AppException && error.code === 'E_STORE_NOT_EMPTY')) throw error
    }
  }

  /** Public URL of a file on the fs disk (getUrl() needs the HTTP routes). */
  private uploadUrl(key: string) {
    return `${env.get('APP_URL').replace(/\/$/, '')}/uploads/${key}`
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
    const admin = await User.findByOrFail('email', env.get('ADMIN_USER'))
    const store = await Store.create({
      name: 'JJ Pastéis',
      slug: 'jj-pasteis',
      status: StoreStatus.OPEN,
      address: 'Praia do Boqueirão - Santos / SP',
      instagramUrl: 'https://www.instagram.com/jjpasteis',
      phone: '5511912345678',
      description: 'Pastéis feitos na hora, crocantes e bem recheados desde 1998.',
      pickupEtaMinutes: 15,
      isDefault: true,
    })
    await store.related('users').attach([admin.id])
    return store
  }
}
