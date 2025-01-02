import type { HttpContext } from '@adonisjs/core/http'
import { storeValidator, updateOrderValidator, updateValidator } from '#validators/category'
import { storeExistValidator, uuidValidator } from '#validators/common'
import Category from '#models/category'
import db from '@adonisjs/lucid/services/db'

export default class CategoriesController {
  async index({ params }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.id)

    return Category.query()
      .where('storeId', storeId)
      .withCount('items', (query) => {
        query.as('itemsCount')
      })
      .orderBy('order', 'asc')
  }

  async show({ params }: HttpContext) {
    const id = await uuidValidator.validate(params.id)

    return Category.findOrFail(id)
  }

  async store({ params, request }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)

    const data = await request.validateUsing(storeValidator)

    const maxOrderResult = await Category.query()
      .where('storeId', storeId)
      .max('order as maxOrder')
      .first()

    const maxOrder = maxOrderResult ? Number(maxOrderResult.$extras.maxOrder) : 0
    const nextOrder = maxOrder + 1

    return Category.create({ storeId, order: nextOrder, ...data })
  }

  async update({ params, request }: HttpContext) {
    const id = await uuidValidator.validate(params.id)

    const category = await Category.findOrFail(id)

    const data = await request.validateUsing(updateValidator)
    category.merge(data)

    return category.save()
  }

  public async updateOrder({ request, response }: HttpContext) {
    const { id, order } = await request.validateUsing(updateOrderValidator)

    const item = await Category.query().where('id', id).firstOrFail()

    const trx = await db.transaction()

    try {
      if (order < item.order) {
        await trx
          .from('categories')
          .where('store_id', item.storeId)
          .andWhereBetween('order', [order, item.order - 1])
          .increment('order', 1)
      } else if (order > item.order) {
        await trx
          .from('categories')
          .where('store_id', item.storeId)
          .andWhereBetween('order', [item.order + 1, order])
          .decrement('order', 1)
      }

      item.merge({ order: order })
      await item.useTransaction(trx).save()

      await trx.commit()

      return Category.query()
        .where('storeId', item.storeId)
        .select('id', 'order', 'updatedAt')
        .orderBy('order', 'asc')
    } catch (error) {
      await trx.rollback()
      return response.status(500).send({
        message: 'Ocorreu um erro ao atualizar ordem',
      })
    }
  }

  async destroy({ params }: HttpContext) {
    const id = await uuidValidator.validate(params.id)

    const category = await Category.findOrFail(id)

    await category.delete()

    return category
  }
}
