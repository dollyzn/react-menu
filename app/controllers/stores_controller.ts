import type { HttpContext } from '@adonisjs/core/http'
import { uuidValidator } from '#validators/common'
import {
  storeValidator,
  updateImagesValidator,
  updateStatusValidator,
  updateValidator,
} from '#validators/store'
import drive from '@adonisjs/drive/services/main'
import Store from '#models/store'
import { cuid } from '@adonisjs/core/helpers'

export default class StoresController {
  async index({}: HttpContext) {
    return Store.query()
  }

  async show({ params }: HttpContext) {
    const id = await uuidValidator.validate(params.id)

    return Store.findOrFail(id)
  }

  async store({ request }: HttpContext) {
    const data = await request.validateUsing(storeValidator)

    return Store.create(data)
  }

  async update({ params, request }: HttpContext) {
    const id = await uuidValidator.validate(params.id)

    const store = await Store.findOrFail(id)

    const data = await request.validateUsing(updateValidator)

    store.merge(data)

    return store.save()
  }

  async updateImages({ params, request }: HttpContext) {
    const id = await uuidValidator.validate(params.id)

    const store = await Store.findOrFail(id)

    const images = await request.validateUsing(updateImagesValidator)

    if (images.banner) {
      if (store.bannerUrl) {
        const fileName = store.bannerUrl.split('/').pop()
        const key = `banners/${fileName}`
        if (fileName) await drive.use().delete(key)
      }

      const key = `banners/${store.id}_${cuid()}.${images.banner.extname}`

      await images.banner.moveToDisk(key)

      store.merge({ bannerUrl: await drive.use().getUrl(key) })
    }

    if (images.photo) {
      if (store.photoUrl) {
        const fileName = store.photoUrl.split('/').pop()
        const key = `photos/${fileName}`
        if (fileName) await drive.use().delete(key)
      }

      const key = `photos/${store.id}_${cuid()}.${images.photo.extname}`

      await images.photo.moveToDisk(key)

      store.merge({ photoUrl: await drive.use().getUrl(key) })
    }

    await store.save()

    return store
  }

  async updateStatus({ params, request }: HttpContext) {
    const id = await uuidValidator.validate(params.id)

    const { status } = await request.validateUsing(updateStatusValidator)

    const store = await Store.findOrFail(id)

    store.merge({ status })

    await store.save()

    return store
  }

  async destroy({ params }: HttpContext) {
    const id = await uuidValidator.validate(params.id)

    const store = await Store.findOrFail(id)

    await store.delete()

    return store
  }
}
