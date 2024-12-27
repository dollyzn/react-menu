import Category from '#models/category'
import { storeValidator, updateValidator } from '#validators/category'
import { storeExistValidator, uuidValidator } from '#validators/common'
import type { HttpContext } from '@adonisjs/core/http'

export default class CategoriesController {
  async index({ params }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.id)

    return Category.query().preload('items').where('storeId', storeId)
  }

  async show({ params }: HttpContext) {
    const id = await uuidValidator.validate(params.id)

    return Category.findOrFail(id)
  }

  async store({ params, request }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)

    const data = await request.validateUsing(storeValidator)

    return Category.create({ storeId, ...data })
  }

  async update({ params, request }: HttpContext) {
    const id = await uuidValidator.validate(params.id)

    const category = await Category.findOrFail(id)

    const data = await request.validateUsing(updateValidator)
    category.merge(data)

    return category.save()
  }

  async destroy({ params }: HttpContext) {
    const id = await uuidValidator.validate(params.id)

    const category = await Category.findOrFail(id)

    await category.delete()

    return category
  }
}
