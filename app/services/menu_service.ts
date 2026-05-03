import { inject } from '@adonisjs/core'
import { UAParser } from 'ua-parser-js'
import StoreRepository from '#repositories/store_repository'

@inject()
export default class MenuService {
  constructor(private storeRepo: StoreRepository) {}

  async getPublicMenu(slug: string | undefined, userAgent: string | null | undefined) {
    const store = await this.storeRepo.findForPublicMenu(slug)

    const { device } = UAParser(userAgent ?? undefined)
    const platform = device.is('mobile') ? 'mobile' : 'desktop'

    await store.incrementViews(platform)
    await store.loadStoreViewsCount()

    return store
  }
}
