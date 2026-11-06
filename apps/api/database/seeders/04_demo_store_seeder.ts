import { BaseSeeder } from '@adonisjs/lucid/seeders'
import env from '#start/env'
import StoreStatus from '#enums/store_status'
import Store from '#models/store'
import User from '#models/user'
import AppException from '#exceptions/app_exception'
import CatalogImportService from '#services/catalog_import_service'
import { JJ_PASTEIS, JJ_PASTEIS_PROFILE } from '#catalog/jj_pasteis'

/**
 * Demo data for local development and tests: JJ Pastéis as the default
 * store, linked to the bootstrap admin, with its real catalog (menu, groups,
 * stock and profile: app/catalog/jj_pasteis.ts, the same `node ace jj:setup`
 * loads in production). Never runs in production. Safe to run again: the
 * store and its catalog are created once, profile fields only where empty.
 */
export default class DemoStoreSeeder extends BaseSeeder {
  static environment = ['development', 'test']

  async run() {
    const store = (await Store.findBy('slug', 'jj-pasteis')) ?? (await this.createStore())
    const importer = new CatalogImportService()
    // Description, address, Instagram, logo and banner (only where empty).
    await importer.applyProfile(store, JJ_PASTEIS_PROFILE)
    try {
      await importer.import(store, JJ_PASTEIS, { note: 'Estoque inicial (demo)' })
    } catch (error) {
      // Already loaded (or edited in the panel): keep it.
      if (!(error instanceof AppException && error.code === 'E_STORE_NOT_EMPTY')) throw error
    }
  }

  private async createStore(): Promise<Store> {
    const admin = await User.findByOrFail('email', env.get('ADMIN_USER'))
    const store = await Store.create({
      name: 'JJ Pastéis',
      slug: 'jj-pasteis',
      status: StoreStatus.OPEN,
      // A demo number (the real one is set in the panel).
      phone: '5511912345678',
      pickupEtaMinutes: 15,
      isDefault: true,
    })
    await store.related('users').attach([admin.id])
    return store
  }
}
