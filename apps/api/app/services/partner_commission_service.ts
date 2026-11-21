import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { RawQueryBindings } from '@adonisjs/lucid/types/querybuilder'
import { DateTime } from 'luxon'
import type {
  PartnerCommissionTotals,
  PartnerListRow,
  PartnerSaleRow,
  PartnerSettlement as PartnerSettlementDto,
} from '@react-menu/contracts'
import AppException from '#exceptions/app_exception'
import OrderStatus from '#enums/order_status'
import PaymentStatus from '#enums/payment_status'
import { broadcastPartnerEvent } from '#helpers/realtime'
import PartnerSettlement from '#models/partner_settlement'
import StorePartner from '#models/store_partner'
import type User from '#models/user'
import PartnerService from '#services/partner_service'
import { containing } from '#helpers/like'
import type { SortSpec } from '#helpers/query_string_parser'

const money = (value: unknown) => Math.round(Number(value ?? 0) * 100) / 100

/** Where a sale's commission is: paid, to pay (handed over), or the order is still at the store. */
const SETTLEMENT_BUCKET = `case
  when o.partner_settlement_id is not null then 'paid'
  when o.status = 'completed' then 'to_pay'
  else 'in_store' end`

type SalesFilters = {
  createdAt?: string | string[]
  settlement?: string | string[]
  customerName?: string | string[]
}

/** A "from~to" business-day period (either side may be empty), as the data tables send it. */
function period(value?: string | string[]) {
  const [from, to] = ([value ?? []].flat()[0] ?? '~').split('~')
  // A real day only: anything else is no limit on that side (never a database error).
  const day = (part?: string) =>
    part && /^\d{4}-\d{2}-\d{2}$/.test(part) && DateTime.fromISO(part).isValid ? part : undefined
  return { from: day(from), to: day(to) }
}

/** Calendar math on "YYYY-MM-DD" (UTC noon: no timezone or DST shifts). */
function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

function daysBetween(from: string, to: string) {
  return (
    Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000) + 1
  )
}

/** Orders whose commission counts: paid, not cancelled (ADR 0024). */
function earning(query: ReturnType<typeof db.from>, storeId: string) {
  return query
    .where('o.store_id', storeId)
    .where('o.payment_status', PaymentStatus.PAID)
    .whereNot('o.status', OrderStatus.CANCELLED)
}

/**
 * A partner's commission (ADR 0024): worked out on each order when it is
 * placed; here only added up and marked paid (paid outside the system).
 *
 * - in progress: paid, the store hasn't handed it over yet;
 * - to receive: handed over, not settled;
 * - received: in a settlement.
 */
@inject()
export default class PartnerCommissionService {
  constructor(private partners: PartnerService) {}

  async totals(storeId: string, partnerIds: string[]) {
    const empty = (): PartnerCommissionTotals => ({
      inProgress: { orders: 0, amount: 0 },
      toReceive: { orders: 0, amount: 0 },
      received: { orders: 0, amount: 0 },
    })
    const result = new Map(partnerIds.map((id) => [id, empty()]))
    if (partnerIds.length === 0) return result

    const rows = await earning(db.from('orders as o'), storeId)
      .whereIn('o.partner_id', partnerIds)
      .select('o.partner_id')
      .select(
        db.raw(`case
          when o.partner_settlement_id is not null then 'received'
          when o.status = 'completed' then 'toReceive'
          else 'inProgress' end as bucket`)
      )
      .count('* as orders')
      .sum('o.commission_amount as amount')
      .groupBy('o.partner_id', 'bucket')
    for (const row of rows) {
      const totals = result.get(row.partner_id)!
      totals[row.bucket as keyof PartnerCommissionTotals] = {
        orders: Number(row.orders),
        amount: money(row.amount),
      }
    }
    return result
  }

  /** The partner's screen: the rule, the totals and the settlements. */
  async overview(storeId: string, partner: StorePartner) {
    const totals = await this.totals(storeId, [partner.id])
    return {
      rule: {
        type: partner.commissionType,
        value: partner.commissionValue,
        since: partner.commissionUpdatedAt.toISO()!,
      },
      totals: totals.get(partner.id)!,
      settlements: await this.settlements(storeId, partner.id),
    }
  }

  /**
   * The managers' partners table: name and status filters, the period's
   * sales and commission and what is still to pay on each row, sortable by
   * them. `createdAt` is a business-day period ("from~to", either side open).
   */
  async table(
    storeId: string,
    options: {
      page?: number
      perPage?: number
      sort: SortSpec
      filters: {
        name?: string | string[]
        status?: string | string[]
        createdAt?: string | string[]
      }
    },
    except?: 'status'
  ) {
    const { from, to } = period(options.filters.createdAt)
    const statuses = [options.filters.status ?? []].flat()
    const name = [options.filters.name ?? []].flat()[0]?.trim()

    const inPeriod = earning(db.from('orders as o'), storeId)
      .whereNotNull('o.partner_id')
      .if(from, (query) => query.where('o.business_date', '>=', from!))
      .if(to, (query) => query.where('o.business_date', '<=', to!))
      .groupBy('o.partner_id')
      .select('o.partner_id')
      .count('* as orders')
      .sum('o.total as sales')
      .sum('o.commission_amount as commission')
      .toSQL()
    const toPay = earning(db.from('orders as o'), storeId)
      .whereNotNull('o.partner_id')
      .where('o.status', OrderStatus.COMPLETED)
      .whereNull('o.partner_settlement_id')
      .groupBy('o.partner_id')
      .select('o.partner_id')
      .count('* as orders')
      .sum('o.commission_amount as amount')
      .toSQL()

    const query = db
      .from('store_partners as p')
      .joinRaw(
        `left join (${inPeriod.sql}) as per on per.partner_id = p.id`,
        inPeriod.bindings as unknown as RawQueryBindings
      )
      .joinRaw(
        `left join (${toPay.sql}) as due on due.partner_id = p.id`,
        toPay.bindings as unknown as RawQueryBindings
      )
      .where('p.store_id', storeId)
      .if(name, (scope) => scope.whereILike('p.name', containing(name!)))
      .if(except !== 'status' && statuses.length === 1, (scope) =>
        statuses[0] === 'paused'
          ? scope.whereNotNull('p.paused_at')
          : scope.whereNull('p.paused_at')
      )
    if (except === 'status') {
      const rows = await query
        .select(db.raw(`case when p.paused_at is null then 'active' else 'paused' end as status`))
        .count('* as total')
        .groupByRaw('1')
      return Object.fromEntries(rows.map((row) => [row.status, Number(row.total)]))
    }

    for (const { column, direction } of options.sort)
      query.orderByRaw(`${column} ${direction} nulls last`)
    const page = await query
      .orderBy('p.name', 'asc')
      .select(
        'p.id',
        'per.orders as period_orders',
        'per.sales as period_sales',
        'per.commission as period_commission',
        'due.orders as due_orders',
        'due.amount as due_amount'
      )
      .paginate(options.page ?? 1, options.perPage ?? 20)

    const rows = page.all()
    const models = rows.length
      ? await StorePartner.query().whereIn(
          'id',
          rows.map((row) => row.id)
        )
      : []
    const presented = await this.partners.present(storeId, models)
    const data: PartnerListRow[] = rows.map((row) => ({
      ...presented.find((partner) => partner.id === row.id)!,
      period: {
        orders: Number(row.period_orders ?? 0),
        sales: money(row.period_sales),
        commission: money(row.period_commission),
      },
      toPay: { orders: Number(row.due_orders ?? 0), amount: money(row.due_amount) },
    }))
    return { data, meta: page.getMeta() }
  }

  /** One partner's numbers for a period, against the period before, with a daily series. */
  async stats(storeId: string, partnerId: string, range: { from: string; to: string }) {
    await this.partners.findInStore(storeId, partnerId)
    const days = daysBetween(range.from, range.to)
    const previous = { from: addDays(range.from, -days), to: addDays(range.from, -1) }
    const sums = async ({ from, to }: { from: string; to: string }) => {
      const row = await earning(db.from('orders as o'), storeId)
        .where('o.partner_id', partnerId)
        .whereBetween('o.business_date', [from, to])
        .count('* as orders')
        .sum('o.total as sales')
        .sum('o.commission_amount as commission')
        .first()
      const orders = Number(row?.orders ?? 0)
      const sales = money(row?.sales)
      return {
        orders,
        sales,
        commission: money(row?.commission),
        averageTicket: orders ? money(sales / orders) : 0,
      }
    }
    const daily = await earning(db.from('orders as o'), storeId)
      .where('o.partner_id', partnerId)
      .whereBetween('o.business_date', [range.from, range.to])
      .groupBy('o.business_date')
      .select('o.business_date')
      .count('* as orders')
      .sum('o.total as sales')
      .sum('o.commission_amount as commission')
    const byDay = new Map(
      daily.map((row) => [DateTime.fromJSDate(row.business_date).toISODate()!, row])
    )
    const totals = await this.totals(storeId, [partnerId])
    return {
      period: range,
      current: await sums(range),
      previous: await sums(previous),
      daily: Array.from({ length: days }, (_, index) => {
        const date = addDays(range.from, index)
        const row = byDay.get(date)
        return {
          date,
          orders: Number(row?.orders ?? 0),
          sales: money(row?.sales),
          commission: money(row?.commission),
        }
      }),
      totals: totals.get(partnerId)!,
    }
  }

  /**
   * A partner's sales (paid, not cancelled), like the order history: the
   * period, where the commission is (to pay, paid, still at the store), the
   * number or customer, sortable; `except` leaves a filter out for its counts.
   */
  private salesQuery(
    storeId: string,
    partnerId: string,
    filters: SalesFilters,
    except?: 'settlement'
  ) {
    const { from, to } = period(filters.createdAt)
    const settlement = [filters.settlement ?? []].flat()
    const search = [filters.customerName ?? []].flat()[0]?.trim()
    const digits = search?.replace(/\D/g, '') ?? ''
    return earning(db.from('orders as o'), storeId)
      .where('o.partner_id', partnerId)
      .if(from, (query) => query.where('o.business_date', '>=', from!))
      .if(to, (query) => query.where('o.business_date', '<=', to!))
      .if(except !== 'settlement' && settlement.length > 0, (query) =>
        query.whereRaw(`(${SETTLEMENT_BUCKET}) = any(?)`, [settlement])
      )
      .if(search, (query) =>
        query.where((match) => {
          match.whereILike('o.customer_name', containing(search!))
          if (/^#?\d{1,5}$/.test(search!)) match.orWhere('o.number', Number(digits))
        })
      )
  }

  async sales(
    storeId: string,
    partnerId: string,
    options: { page?: number; perPage?: number; sort: SortSpec; filters: SalesFilters }
  ) {
    await this.partners.findInStore(storeId, partnerId)
    const query = this.salesQuery(storeId, partnerId, options.filters).leftJoin(
      'partner_settlements as s',
      's.id',
      'o.partner_settlement_id'
    )
    for (const { column, direction } of options.sort) query.orderBy(column, direction)
    const page = await query
      .orderBy('o.created_at', 'desc')
      .select(
        'o.id',
        'o.number',
        'o.business_date',
        'o.created_at',
        'o.customer_name',
        'o.status',
        'o.total',
        'o.commission_amount',
        'o.completed_at',
        'o.partner_delivered_at',
        'o.partner_settlement_id',
        's.paid_at as settled_at',
        db.raw(`${SETTLEMENT_BUCKET} as settlement`)
      )
      .paginate(options.page ?? 1, options.perPage ?? 20)

    const iso = (value: Date | null) => (value ? DateTime.fromJSDate(value).toISO() : null)
    const rows: PartnerSaleRow[] = page.all().map((row) => ({
      id: row.id,
      number: row.number,
      businessDate: DateTime.fromJSDate(row.business_date).toISODate()!,
      createdAt: iso(row.created_at)!,
      customerName: row.customer_name,
      status: row.status,
      total: money(row.total),
      commissionAmount: money(row.commission_amount),
      completedAt: iso(row.completed_at),
      partnerDeliveredAt: iso(row.partner_delivered_at),
      settlement: row.settlement,
      settlementId: row.partner_settlement_id,
      settledAt: iso(row.settled_at),
    }))
    // The whole filter's commission (every page): what "Marcar como pago" would settle.
    const sum = await this.salesQuery(storeId, partnerId, options.filters)
      .sum('o.commission_amount as total')
      .first()
    return { rows, meta: { ...page.getMeta(), commissionTotal: money(sum?.total) } }
  }

  /** How many sales each "Comissão" option would show (the table's counts). */
  async salesFacets(storeId: string, partnerId: string, filters: SalesFilters) {
    const rows = await this.salesQuery(storeId, partnerId, filters, 'settlement')
      .select(db.raw(`${SETTLEMENT_BUCKET} as settlement`))
      .count('* as total')
      .groupByRaw('1')
    return {
      settlement: Object.fromEntries(rows.map((row) => [row.settlement, Number(row.total)])),
    }
  }

  async settlements(storeId: string, partnerId: string): Promise<PartnerSettlementDto[]> {
    const settlements = await PartnerSettlement.query()
      .where({ storeId, partnerId })
      .preload('paidBy')
      .orderBy('paidAt', 'desc')
      .limit(100)
    return settlements.map((settlement) => this.present(settlement))
  }

  /**
   * Marks the commission of handed-over orders paid: the ones up to a
   * business day, or the ones picked (each must still be to receive).
   */
  async settle(
    storeId: string,
    partnerId: string,
    input: { until?: Date | string; orderIds?: string[]; note?: string | null },
    actor: User
  ) {
    const settlement = await db.transaction(async (trx) => {
      const partner = await this.partners.findInStore(storeId, partnerId, trx, { lock: true })
      const until = input.until ? asDate(input.until) : null
      const toReceive = (query: ReturnType<TransactionClientContract['from']>) =>
        earning(query, storeId)
          .where('o.partner_id', partner.id)
          .where('o.status', OrderStatus.COMPLETED)
          .whereNull('o.partner_settlement_id')

      const orders = await toReceive(trx.from('orders as o'))
        .if(until, (query) => query.where('o.business_date', '<=', until!))
        .if(input.orderIds?.length, (query) => query.whereIn('o.id', input.orderIds!))
        .forUpdate()
        .select('o.id', 'o.commission_amount')
      if (input.orderIds?.length && orders.length !== new Set(input.orderIds).size) {
        throw new AppException(
          'Algum pedido escolhido não tem comissão a pagar (já pago, cancelado ou ainda não entregue).',
          409,
          'E_NOT_SETTLEABLE'
        )
      }
      if (orders.length === 0) {
        throw new AppException('Não há comissão a pagar nesse período.', 409, 'E_NOTHING_TO_SETTLE')
      }

      const created = await PartnerSettlement.create(
        {
          storeId,
          partnerId: partner.id,
          until: until ? DateTime.fromISO(until) : null,
          ordersCount: orders.length,
          total: money(orders.reduce((sum, row) => sum + Number(row.commission_amount ?? 0), 0)),
          note: input.note?.trim() || null,
          paidAt: DateTime.now(),
          paidById: actor.id,
        },
        { client: trx }
      )
      await trx
        .from('orders')
        .whereIn(
          'id',
          orders.map((row) => row.id)
        )
        .update({ partner_settlement_id: created.id, updated_at: new Date() })
      return created
    })

    broadcastPartnerEvent({ type: 'partner.commission.changed', storeId, partnerId })
    await settlement.load('paidBy')
    return this.present(settlement)
  }

  /** A settlement recorded by mistake: its orders go back to "to receive". */
  async undo(storeId: string, partnerId: string, settlementId: string) {
    await db.transaction(async (trx) => {
      const settlement = await PartnerSettlement.query({ client: trx })
        .where({ id: settlementId, storeId, partnerId })
        .forUpdate()
        .first()
      if (!settlement) throw new AppException('Acerto não encontrado.', 404)
      await trx
        .from('orders')
        .where('partner_settlement_id', settlement.id)
        .update({ partner_settlement_id: null, updated_at: new Date() })
      await settlement.useTransaction(trx).delete()
    })
    broadcastPartnerEvent({ type: 'partner.commission.changed', storeId, partnerId })
  }

  private present(settlement: PartnerSettlement): PartnerSettlementDto {
    return {
      id: settlement.id,
      partnerId: settlement.partnerId,
      until: settlement.until?.toISODate() ?? null,
      ordersCount: settlement.ordersCount,
      total: settlement.total,
      note: settlement.note,
      paidAt: settlement.paidAt.toISO()!,
      paidBy: settlement.paidBy ? { id: settlement.paidBy.id, name: settlement.paidBy.name } : null,
    }
  }
}

/** A `YYYY-MM-DD` day as Vine gives it (a Date at local midnight) or as text. */
function asDate(value: Date | string) {
  if (typeof value === 'string') return value.slice(0, 10)
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
}
