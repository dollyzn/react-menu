import Store from '#models/store'
import { uuidValidator } from '#validators/common'
import { storeValidator, updateValidator } from '#validators/store'
import type { HttpContext } from '@adonisjs/core/http'

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

  async destroy({ params }: HttpContext) {
    const id = await uuidValidator.validate(params.id)

    const store = await Store.findOrFail(id)

    await store.delete()

    return store
  }
}
