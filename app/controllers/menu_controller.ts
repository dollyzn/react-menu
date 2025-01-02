import Store from '#models/store'
import { storeExistValidator } from '#validators/menu'
import type { HttpContext } from '@adonisjs/core/http'

export default class MenuController {
  async show({ params }: HttpContext) {
    const slug = await storeExistValidator.validate(params.slug)

    const store = await Store.query()
      .preload('categories', (query) => {
        query
          .orderBy('order', 'asc')
          .preload('items', (query) => query.orderBy('order', 'asc').preload('addons'))
      })
      .where(slug ? { slug } : { is_default: true })
      .firstOrFail()

    await store.incrementViews()

    return store
  }
}
