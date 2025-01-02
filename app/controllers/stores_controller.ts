import Store from '#models/store'
import { uuidValidator } from '#validators/common'
import { storeValidator, updateStatusValidator, updateValidator } from '#validators/store'
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
