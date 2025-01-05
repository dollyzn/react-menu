import type { HttpContext } from '@adonisjs/core/http'
import Addon from '#models/addon'
import Category from '#models/category'
import Item from '#models/item'
import StoreViews from '#models/store_views'
import { storeExistValidator } from '#validators/common'
import { DateTime } from 'luxon'
import type { LucidModel, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'

export default class DashboardController {
  public async overview({ params }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.id)

    const fetchMetricData = async (
      model: LucidModel,
      queryCallback: (model: LucidModel) => ModelQueryBuilderContract<typeof model>,
      intervals: { label: string; duration: object }[]
    ) => {
      const currentTotal = await safeQuery(queryCallback(model).count('* as total').firstOrFail())

      const deltas = await Promise.all(
        intervals.map(async ({ label, duration }): Promise<{ value: number; interval: string }> => {
          const result = await safeQuery(
            queryCallback(model)
              .andWhere('createdAt', '>=', DateTime.now().minus(duration).toSQL())
              .count('* as total')
              .first()
          )

          return { value: Number(result?.$extras.total), interval: label }
        })
      )

      return {
        total: Number(currentTotal.$extras.total),
        message: generateDynamicMessage(deltas),
      }
    }

    const generateDynamicMessage = (deltas: { value: number; interval: string }[]) => {
      const mostRelevant = deltas.sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0]

      if (mostRelevant.value > 0) return `+${mostRelevant.value} ${mostRelevant.interval}`
      if (mostRelevant.value === 0) return `Sem alterações ${mostRelevant.interval}`
      return `${mostRelevant.value} ${mostRelevant.interval}`
    }

    const safeQuery = async <T>(
      query: Promise<T>,
      defaultValue: T = { $extras: { total: 0 } } as unknown as T
    ): Promise<T> => {
      try {
        return await query
      } catch {
        return defaultValue
      }
    }

    const intervals = [
      { label: 'na última hora', duration: { hours: 1 } },
      { label: 'ontem', duration: { days: 1 } },
      { label: 'na última semana', duration: { weeks: 1 } },
      { label: 'no último mês', duration: { months: 1 } },
    ]

    const [accesses, categories, items, addons] = await Promise.all([
      fetchMetricData(StoreViews, (model) => model.query().where('storeId', storeId), intervals),
      fetchMetricData(Category, (model) => model.query().where('storeId', storeId), intervals),
      fetchMetricData(
        Item,
        (model) =>
          model
            .query()
            .whereIn('category_id', Category.query().select('id').where('storeId', storeId)),
        intervals
      ),
      fetchMetricData(Addon, (model) => model.query().where('storeId', storeId), intervals),
    ])

    return { accesses, categories, items, addons }
  }

  public async recentItems({ params }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.id)

    return Item.query()
      .whereHas('category', (query) => {
        query.where('storeId', storeId)
      })
      .preload('category', (query) => {
        query.select('id', 'name')
      })
      .limit(10)
      .orderBy('createdAt', 'desc')
      .select('id', 'categoryId', 'name', 'price', 'createdAt')
  }
}
