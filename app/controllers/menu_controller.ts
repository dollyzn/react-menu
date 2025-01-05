import type { HttpContext } from '@adonisjs/core/http'
import Store from '#models/store'
import { storeExistValidator } from '#validators/menu'
import { UAParser } from 'ua-parser-js'

export default class MenuController {
  async show({ params, request }: HttpContext) {
    const slug = await storeExistValidator.validate(params.slug)

    const store = await Store.query()
      .preload('categories', (query) => {
        query
          .orderBy('order', 'asc')
          .preload('items', (query) => query.orderBy('order', 'asc').preload('addons'))
      })
      .where(slug ? { slug } : { is_default: true })
      .firstOrFail()

    const { device } = UAParser(request.header('user-agent'))
    const platform = device.is('mobile') ? 'mobile' : 'desktop'

    await store.incrementViews(platform)
    await store.loadStoreViewsCount()

    return store
  }
}
