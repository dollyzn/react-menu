import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import OrderStatus from '#enums/order_status'
import StockMovementType from '#enums/stock_movement_type'
import { BUSINESS_TIMEZONE } from '#services/order_service'

/** Orders that count as sales: they reached the kitchen (paid online, or taken at the counter). */
const NOT_SALES = [OrderStatus.PENDING_PAYMENT, OrderStatus.CANCELLED]

const money = (value: unknown) => Math.round(Number(value ?? 0) * 100) / 100

export type ReportPeriod = { from: string; to: string }

/**
 * Sales reports of a store for a period of business days (inclusive):
 * totals compared with the previous period of the same length, sales per
 * day and hour, best sellers, add-ons/choices, payment and channel mix,
 * and the stock the sales consumed. Everything is aggregated in SQL.
 */
export default class ReportService {
  async sales(storeId: string, period: ReportPeriod) {
    const from = DateTime.fromISO(period.from, { zone: BUSINESS_TIMEZONE })
    const to = DateTime.fromISO(period.to, { zone: BUSINESS_TIMEZONE })
    const days = Math.round(to.diff(from, 'days').days) + 1
    const previous = {
      from: from.minus({ days }).toISODate()!,
      to: from.minus({ days: 1 }).toISODate()!,
    }

    const sales = (range: ReportPeriod) =>
      db
        .from('orders')
        .where('store_id', storeId)
        .whereBetween('business_date', [range.from, range.to])
        .whereNotIn('status', NOT_SALES)

    const totals = async (range: ReportPeriod) => {
      const [row] = await sales(range).count('* as orders').sum('total as revenue')
      return { orders: Number(row.orders), revenue: money(row.revenue) }
    }

    const [
      current,
      before,
      cancelled,
      units,
      daily,
      hourly,
      items,
      addons,
      payments,
      channels,
      stock,
    ] = await Promise.all([
      totals(period),
      totals(previous),
      db
        .from('orders')
        .where('store_id', storeId)
        .whereBetween('business_date', [period.from, period.to])
        .where('status', OrderStatus.CANCELLED)
        .count('* as orders')
        .sum('total as value')
        .first(),
      sales(period)
        .join('order_items', 'order_items.order_id', 'orders.id')
        .sum('order_items.quantity as units')
        .first(),
      sales(period)
        .select(db.raw(`to_char(business_date, 'YYYY-MM-DD') as date`))
        .count('* as orders')
        .sum('total as revenue')
        .groupBy('business_date'),
      sales(period)
        .select(
          db.raw(`extract(hour from created_at at time zone ?)::int as hour`, [BUSINESS_TIMEZONE])
        )
        .count('* as orders')
        .groupByRaw('1'),
      sales(period)
        .join('order_items', 'order_items.order_id', 'orders.id')
        .select('order_items.name')
        .sum('order_items.quantity as quantity')
        .sum('order_items.total as revenue')
        .groupBy('order_items.name')
        .orderBy('quantity', 'desc')
        .orderBy('order_items.name', 'asc'),
      sales(period)
        .join('order_items', 'order_items.order_id', 'orders.id')
        .join('order_item_addons', 'order_item_addons.order_item_id', 'order_items.id')
        .select('order_item_addons.name')
        .sum('order_items.quantity as quantity')
        .select(db.raw('sum(order_items.quantity * order_item_addons.unit_price) as revenue'))
        .groupBy('order_item_addons.name')
        .orderBy('quantity', 'desc')
        .orderBy('order_item_addons.name', 'asc')
        .limit(15),
      sales(period)
        .select('payment_method as method')
        .count('* as orders')
        .sum('total as revenue')
        .groupBy('payment_method'),
      sales(period)
        .select('channel')
        .count('* as orders')
        .sum('total as revenue')
        .groupBy('channel'),
      // Net consumption in the period: what sales took, minus what cancellations put back.
      db
        .from('stock_movements')
        .join('ingredients', 'ingredients.id', 'stock_movements.ingredient_id')
        .where('stock_movements.store_id', storeId)
        .whereIn('stock_movements.type', [
          StockMovementType.CONSUMPTION,
          StockMovementType.REVERSAL,
        ])
        .whereRaw('(stock_movements.created_at at time zone ?)::date between ? and ?', [
          BUSINESS_TIMEZONE,
          period.from,
          period.to,
        ])
        .select('ingredients.id', 'ingredients.name', 'ingredients.unit', 'ingredients.icon')
        .select(db.raw('-sum(stock_movements.quantity) as consumed'))
        .groupBy('ingredients.id', 'ingredients.name', 'ingredients.unit', 'ingredients.icon')
        .havingRaw('-sum(stock_movements.quantity) > 0')
        .orderBy('consumed', 'desc'),
    ])

    const byDate = new Map(daily.map((row) => [row.date, row]))
    const byHour = new Map(hourly.map((row) => [Number(row.hour), Number(row.orders)]))

    return {
      period: { ...period, days },
      previousPeriod: previous,
      summary: {
        revenue: current.revenue,
        orders: current.orders,
        averageTicket: current.orders ? money(current.revenue / current.orders) : 0,
        units: Number(units?.units ?? 0),
        cancelled: { orders: Number(cancelled?.orders ?? 0), value: money(cancelled?.value) },
        previous: before,
      },
      daily: Array.from({ length: days }, (_, offset) => {
        const date = from.plus({ days: offset }).toISODate()!
        const row = byDate.get(date)
        return { date, orders: Number(row?.orders ?? 0), revenue: money(row?.revenue) }
      }),
      hourly: Array.from({ length: 24 }, (_, hour) => ({ hour, orders: byHour.get(hour) ?? 0 })),
      items: items.map((row) => ({
        name: row.name,
        quantity: Number(row.quantity),
        revenue: money(row.revenue),
      })),
      addons: addons.map((row) => ({
        name: row.name,
        quantity: Number(row.quantity),
        revenue: money(row.revenue),
      })),
      payments: payments.map((row) => ({
        method: row.method,
        orders: Number(row.orders),
        revenue: money(row.revenue),
      })),
      channels: channels.map((row) => ({
        channel: row.channel,
        orders: Number(row.orders),
        revenue: money(row.revenue),
      })),
      stock: stock.map((row) => ({
        ingredientId: row.id,
        name: row.name,
        unit: row.unit,
        icon: row.icon,
        consumed: Math.round(Number(row.consumed) * 1000) / 1000,
      })),
    }
  }
}
