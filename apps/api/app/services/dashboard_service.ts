import Addon from '#models/addon'
import Category from '#models/category'
import Item from '#models/item'
import db from '@adonisjs/lucid/services/db'
import { BUSINESS_TIMEZONE } from '#services/order_service'
import { DateTime } from 'luxon'
import type { LucidModel, ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'

export default class DashboardService {
  async overview(storeId: string) {
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
      const orderedDeltas = deltas.sort((a, b) => {
        const aIndex = intervals.findIndex((int) => int.label === a.interval)
        const bIndex = intervals.findIndex((int) => int.label === b.interval)
        return aIndex - bIndex
      })

      const mostRelevant =
        orderedDeltas.find((delta) => delta.value > 0) || orderedDeltas[orderedDeltas.length - 1]

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

    /** Menu visits are aggregated per hour (store_view_counts): sum them. */
    const visitMetric = async () => {
      const sum = async (from?: DateTime, to?: DateTime) => {
        const query = db.from('store_view_counts').where('store_id', storeId)
        if (from) query.where('hour', '>=', from.startOf('hour').toSQL()!)
        if (to) query.where('hour', '<', to.startOf('hour').toSQL()!)
        const [row] = await query.sum('count as total')
        return Number(row?.total ?? 0)
      }
      const deltas = await Promise.all(
        intervals.map(async ({ label, duration, upperBound }) => ({
          interval: label,
          value: await sum(
            DateTime.now().minus(duration),
            upperBound ? DateTime.now().minus(upperBound) : undefined
          ),
        }))
      )
      return { total: await sum(), message: generateDynamicMessage(deltas, intervals) }
    }

    const [accesses, categories, items, addons] = await Promise.all([
      visitMetric(),
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

  async recentItems(storeId: string) {
    return Item.query()
      .whereHas('category', (query) => {
        query.where('storeId', storeId)
      })
      .preload('category', (query) => {
        query.select('id', 'name')
      })
      .limit(10)
      .orderBy('createdAt', 'desc')
      .select('id', 'categoryId', 'name', 'price', 'photoUrl', 'createdAt')
  }

  async chart(storeId: string) {
    const startDate = DateTime.now().setZone(BUSINESS_TIMEZONE).minus({ months: 3 }).startOf('day')
    const endDate = DateTime.now().setZone(BUSINESS_TIMEZONE).startOf('day')

    const dateSequence: string[] = []
    let currentDate = startDate
    while (currentDate <= endDate) {
      const sqlDate = currentDate.toSQLDate()
      if (sqlDate) dateSequence.push(sqlDate)
      currentDate = currentDate.plus({ days: 1 })
    }

    // Per business day (São Paulo) and platform.
    const rows = await db
      .from('store_view_counts')
      .where('store_id', storeId)
      .where('hour', '>=', startDate.toSQL()!)
      .select(db.raw(`to_char(hour at time zone ?, 'YYYY-MM-DD') as date`, [BUSINESS_TIMEZONE]))
      .select('platform')
      .sum('count as total')
      .groupBy('date', 'platform')

    const groupedResults: Record<string, { date: string; desktop: number; mobile: number }> = {}
    for (const row of rows as { date: string; platform: 'mobile' | 'desktop'; total: string }[]) {
      groupedResults[row.date] ??= { date: row.date, desktop: 0, mobile: 0 }
      groupedResults[row.date][row.platform] += Number(row.total)
    }

    return dateSequence.map((date) => {
      return groupedResults[date] || { date, desktop: 0, mobile: 0 }
    })
  }
}
