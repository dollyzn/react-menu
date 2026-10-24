import db from '@adonisjs/lucid/services/db'
import { BUSINESS_TIMEZONE } from '#services/order_service'
import { DateTime } from 'luxon'
import { inject } from '@adonisjs/core'
import OrderStatus from '#enums/order_status'
import Store from '#models/store'
import InventoryService from '#services/inventory_service'

const money = (value: unknown) => Math.round(Number(value ?? 0) * 100) / 100
/** Orders that count as sales: they reached the kitchen. */
const NOT_SALES = [OrderStatus.PENDING_PAYMENT, OrderStatus.CANCELLED]

@inject()
export default class DashboardService {
  constructor(private inventory: InventoryService) {}

  /**
   * The store today, live: sales against the same weekday last week (up to
   * the same time), the pace per hour, the order queue, the kitchen time,
   * the online menu's visits and conversion, stock alerts and the menu's
   * health (paused, sold out, no photo).
   */
  async today(storeId: string) {
    const store = await Store.findOrFail(storeId)
    const now = DateTime.now().setZone(BUSINESS_TIMEZONE)
    const today = now.toISODate()!
    const lastWeek = now.minus({ weeks: 1 })
    const dayStart = now.startOf('day')

    const sales = (date: string, until?: DateTime) =>
      db
        .from('orders')
        .where('store_id', storeId)
        .where('business_date', date)
        .whereNotIn('status', NOT_SALES)
        .if(until, (query) => query.where('created_at', '<=', until!.toSQL()!))
    const totals = async (date: string, until?: DateTime) => {
      const [row] = await sales(date, until).count('* as orders').sum('total as revenue')
      return { orders: Number(row.orders), revenue: money(row.revenue) }
    }
    const perHour = (date: string) =>
      sales(date)
        .select(
          db.raw(`extract(hour from created_at at time zone ?)::int as hour`, [BUSINESS_TIMEZONE])
        )
        .sum('total as revenue')
        .groupByRaw('1')
    const visits = async (from: DateTime, to: DateTime) => {
      const [row] = await db
        .from('store_view_counts')
        .where('store_id', storeId)
        .where('hour', '>=', from.toUTC().toSQL()!)
        .where('hour', '<=', to.toUTC().toSQL()!)
        .sum('count as total')
      return Number(row?.total ?? 0)
    }
    const visitsFrom = dayStart.minus({ days: 13 })

    const [
      current,
      before,
      hoursToday,
      hoursLastWeek,
      online,
      queue,
      prep,
      visitsToday,
      visitsLastWeek,
      visitDays,
      top,
      lowStock,
      menu,
      capacities,
    ] = await Promise.all([
      totals(today),
      totals(lastWeek.toISODate()!, lastWeek),
      perHour(today),
      perHour(lastWeek.toISODate()!),
      sales(today).where('channel', 'online').count('* as orders').first(),
      db
        .from('orders')
        .where('store_id', storeId)
        .whereIn('status', [
          OrderStatus.PENDING_PAYMENT,
          OrderStatus.RECEIVED,
          OrderStatus.PREPARING,
          OrderStatus.READY,
        ])
        .where('business_date', '>=', now.minus({ days: 1 }).toISODate()!)
        .select('status')
        .count('* as orders')
        .groupBy('status'),
      // From reaching the kitchen (paid or taken at the counter) to ready.
      sales(today)
        .whereNotNull('ready_at')
        .select(
          db.raw(
            'avg(extract(epoch from ready_at - coalesce(stock_consumed_at, created_at))) / 60 as minutes'
          )
        )
        .count('* as orders')
        .first(),
      visits(dayStart, now),
      visits(lastWeek.startOf('day'), lastWeek),
      db
        .from('store_view_counts')
        .where('store_id', storeId)
        .where('hour', '>=', visitsFrom.toUTC().toSQL()!)
        .select(db.raw(`to_char(hour at time zone ?, 'YYYY-MM-DD') as date`, [BUSINESS_TIMEZONE]))
        .sum('count as total')
        .groupByRaw('1'),
      sales(today)
        .join('order_items', 'order_items.order_id', 'orders.id')
        .select('order_items.name')
        .sum('order_items.quantity as quantity')
        .groupBy('order_items.name')
        .orderBy('quantity', 'desc')
        .orderBy('order_items.name', 'asc')
        .limit(5),
      store.inventoryEnabled
        ? db
            .from('ingredients')
            .where('store_id', storeId)
            .where('min_stock', '>', 0)
            .whereRaw('stock_quantity <= min_stock')
            .select('id', 'name', 'unit', 'icon', 'stock_quantity', 'min_stock')
            .orderByRaw('stock_quantity / min_stock asc')
        : Promise.resolve([]),
      db
        .from('items')
        .join('categories', 'categories.id', 'items.category_id')
        .where('categories.store_id', storeId)
        .select('items.id', 'items.is_available', 'items.photo_url'),
      this.inventory.capacities(store),
    ])

    const cumulative = (rows: { hour: number; revenue: string }[]) => {
      const byHour = new Map(rows.map((row) => [Number(row.hour), Number(row.revenue)]))
      let total = 0
      return Array.from(
        { length: 24 },
        (_, hour) => (total = money(total + (byHour.get(hour) ?? 0)))
      )
    }
    const todayPace = cumulative(hoursToday)
    const lastWeekPace = cumulative(hoursLastWeek)
    const visitByDate = new Map(visitDays.map((row) => [row.date, Number(row.total)]))
    const count = (status: string) =>
      Number(queue.find((row) => row.status === status)?.orders ?? 0)
    const onlineOrders = Number(online?.orders ?? 0)

    return {
      date: today,
      generatedAt: now.toISO(),
      sales: {
        revenue: current.revenue,
        orders: current.orders,
        averageTicket: current.orders ? money(current.revenue / current.orders) : 0,
        lastWeek: before,
      },
      pace: Array.from({ length: 24 }, (_, hour) => ({
        hour,
        today: hour <= now.hour ? todayPace[hour] : null,
        lastWeek: lastWeekPace[hour],
      })),
      queue: {
        pendingPayment: count(OrderStatus.PENDING_PAYMENT),
        received: count(OrderStatus.RECEIVED),
        preparing: count(OrderStatus.PREPARING),
        ready: count(OrderStatus.READY),
      },
      kitchen: {
        averageMinutes:
          prep?.minutes === null || prep?.minutes === undefined
            ? null
            : Math.round(Number(prep.minutes)),
        orders: Number(prep?.orders ?? 0),
      },
      visits: {
        today: visitsToday,
        lastWeek: visitsLastWeek,
        onlineOrders,
        conversion: visitsToday ? Math.min(1, onlineOrders / visitsToday) : null,
        daily: Array.from({ length: 14 }, (_, offset) => {
          const date = visitsFrom.plus({ days: offset }).toISODate()!
          return { date, visits: visitByDate.get(date) ?? 0 }
        }),
      },
      topItems: top.map((row) => ({ name: row.name, quantity: Number(row.quantity) })),
      lowStock: lowStock.map((row) => ({
        id: row.id,
        name: row.name,
        unit: row.unit,
        icon: row.icon,
        stockQuantity: Number(row.stock_quantity),
        minStock: Number(row.min_stock),
      })),
      menu: {
        items: menu.length,
        paused: menu.filter((item) => !item.is_available).length,
        soldOut: menu.filter((item) => item.is_available && capacities.items.get(item.id) === 0)
          .length,
        withoutPhoto: menu.filter((item) => !item.photo_url).length,
      },
      store: { isOpen: store.isOpen, closesAt: store.closesAt, opensAt: store.opensAt },
    }
  }
}
