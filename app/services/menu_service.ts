import { inject } from '@adonisjs/core'
import { UAParser } from 'ua-parser-js'
import type Store from '#models/store'
import StoreRepository from '#repositories/store_repository'

@inject()
export default class MenuService {
  constructor(private storeRepo: StoreRepository) {}

  async getPublicMenu(slug: string | undefined, userAgent: string | null | undefined) {
    const store = await this.storeRepo.findForPublicMenu(slug)

    return this.trackMenuView(store, userAgent)
  }

  async getPublicMenuByStoreId(storeId: string, userAgent: string | null | undefined) {
    const store = await this.storeRepo.findForPublicMenuByStoreId(storeId)

    return this.trackMenuView(store, userAgent)
  }

  private async trackMenuView(store: Store, userAgent: string | null | undefined) {
    const { device } = UAParser(userAgent ?? undefined)
    const platform = device.is('mobile') ? 'mobile' : 'desktop'

    await store.incrementViews(platform)
    await store.loadStoreViewsCount()

    return store
  }
}
