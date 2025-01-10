import Addon from '#models/addon'
import { itemExistValidator, storeValidator, updateValidator } from '#validators/addon'
import { storeExistValidator, uuidValidator } from '#validators/common'
import type { HttpContext } from '@adonisjs/core/http'

export default class AddonsController {
  async index({}: HttpContext) {
    return Addon.query()
  }

  async indexByStore({ params }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.id)

    return Addon.query().where('storeId', storeId)
  }

  async indexByItem({ params }: HttpContext) {
    const itemId = await itemExistValidator.validate(params.id)

    return Addon.query().whereHas('items', (query) => query.where('id', itemId))
  }

  async show({ params }: HttpContext) {
    const id = await uuidValidator.validate(params.id)

    return Addon.findOrFail(id)
  }

  async store({ params, request }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)

    const data = await request.validateUsing(storeValidator)

    return Addon.create({ storeId, ...data })
  }

  async update({ params, request }: HttpContext) {
    const id = await uuidValidator.validate(params.id)

    const addons = await Addon.findOrFail(id)

    const data = await request.validateUsing(updateValidator)
    addons.merge(data)

    return addons.save()
  }

  async destroy({ params }: HttpContext) {
    const id = await uuidValidator.validate(params.id)

    const addons = await Addon.findOrFail(id)

    await addons.delete()

    return addons
  }
}
