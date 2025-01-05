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
      intervals: { label: string; duration: object; upperBound?: object }[]
    ) => {
      const currentTotal = await safeQuery(queryCallback(model).count('* as total').firstOrFail())

      const deltas = await Promise.all(
        intervals.map(
          async ({ label, duration, upperBound }): Promise<{ value: number; interval: string }> => {
            const query = queryCallback(model).andWhere(
              'createdAt',
              '>=',
              DateTime.now().minus(duration).toSQL()
            )

            if (upperBound) {
              query.andWhere('createdAt', '<', DateTime.now().minus(upperBound).toSQL())
            }

            const result = await safeQuery(query.count('* as total').first())

            return { value: Number(result?.$extras.total), interval: label }
          }
        )
      )

      return {
        total: Number(currentTotal.$extras.total),
        message: generateDynamicMessage(deltas, intervals),
      }
    }

    const generateDynamicMessage = (
      deltas: { value: number; interval: string }[],
      intervals: { label: string; duration: object }[]
    ) => {
      const mostRelevant = deltas.sort((a, b) => {
        if (Math.abs(b.value) !== Math.abs(a.value)) {
          return Math.abs(b.value) - Math.abs(a.value)
        }

        const aIndex = intervals.findIndex((int) => int.label === a.interval)
        const bIndex = intervals.findIndex((int) => int.label === b.interval)
        return aIndex - bIndex
      })[0]

      const mostRelevantIndex = intervals.findIndex((int) => int.label === mostRelevant.interval)
      if (mostRelevantIndex > 0) {
        const previousInterval = intervals[mostRelevantIndex - 1]
        const previousDelta = deltas.find((delta) => delta.interval === previousInterval.label)

        if (previousDelta && mostRelevant.value < previousDelta.value + 5) {
          return `+${previousDelta.value} ${previousDelta.interval}`
        }
      }

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
      { label: 'ontem', duration: { days: 1 }, upperBound: { hours: 1 } },
      { label: 'na última semana', duration: { weeks: 1 }, upperBound: { days: 1 } },
      { label: 'no último mês', duration: { months: 1 }, upperBound: { weeks: 1 } },
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

  public async chart({ params }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.id)

    const startDate = DateTime.now().minus({ months: 3 }).startOf('day')
    const endDate = DateTime.now().startOf('day')

    const dateSequence = []
    let currentDate = startDate
    while (currentDate <= endDate) {
      dateSequence.push(currentDate.toSQLDate())
      currentDate = currentDate.plus({ days: 1 })
    }

    const results = await StoreViews.query()
      .where('storeId', storeId)
      .andWhere('createdAt', '>=', startDate.toSQL())
      .orderBy('createdAt', 'asc')

    const groupedResults = results.reduce(
      (acc: Record<string, { date: string; desktop: number; mobile: number }>, row) => {
        const date = row.createdAt.toSQLDate()
        const platform = row.platform
        if (date) {
          if (!acc[date]) {
            acc[date] = { date, desktop: 0, mobile: 0 }
          }
          acc[date][platform] += 1
        }
        return acc
      },
      {}
    )

    const finalResults = dateSequence.map((date) => {
      return groupedResults[date] || { date, desktop: 0, mobile: 0 }
    })

    return finalResults
  }
}
