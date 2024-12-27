import Item from '#models/item'
import { uuidValidator } from '#validators/common'
import { categoryExistValidator, storeValidator, updateValidator } from '#validators/item'
import type { HttpContext } from '@adonisjs/core/http'

export default class ItemsController {
  async index({ params }: HttpContext) {
    const categoryId = await categoryExistValidator.validate(params.id)

    return Item.query().where('categoryId', categoryId)
  }

  async show({ params }: HttpContext) {
    const id = await uuidValidator.validate(params.id)

    const item = await Item.query()
      .where('id', id)
      .preload('addons')
      .preload('category')
      .firstOrFail()
    await item.incrementViews()

    return item
  }

  async store({ request, params }: HttpContext) {
    const categoryId = await categoryExistValidator.validate(params.categoryId)

    const data = await request.validateUsing(storeValidator)

    return Item.create({ categoryId, ...data })
  }

  async update({ params, request }: HttpContext) {
    const id = await uuidValidator.validate(params.id)

    const item = await Item.findOrFail(id)

    const data = await request.validateUsing(updateValidator)
    item.merge(data)

    return item.save()
  }

  async destroy({ params }: HttpContext) {
    const id = await uuidValidator.validate(params.id)

    const item = await Item.findOrFail(id)

    await item.delete()

    return item
  }
}
