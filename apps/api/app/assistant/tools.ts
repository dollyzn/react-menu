import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import vine from '@vinejs/vine'
import type { Infer } from '@vinejs/vine/types'
import { jsonSchema, tool, type JSONSchema7, type ToolSet } from 'ai'
import { DateTime } from 'luxon'
import type {
  AssistantApprovalPreview,
  AssistantFoundOrders,
  AssistantItemSales,
  AssistantItemSalesPeriod,
  AssistantGroupRule,
  AssistantMenuItems,
  AssistantOptionGroups,
  AssistantOrdersNow,
  AssistantPartners,
  AssistantCancelRequests,
  AssistantPayLater,
  AssistantSalesSummary,
  AssistantStockForecast,
  AssistantOrderDetails,
  AssistantStockStatus,
  AssistantStoreStatus,
} from '@react-menu/contracts'
import AppException from '#exceptions/app_exception'
import OrderStatus from '#enums/order_status'
import StockMovementType from '#enums/stock_movement_type'
import StoreRole from '#enums/store_role'
import StoreStatus from '#enums/store_status'
import { broadcastMenuChanged } from '#helpers/realtime'
import Addon from '#models/addon'
import Category from '#models/category'
import StorePartner from '#models/store_partner'
import CancelRequestService from '#services/cancel_request_service'
import OrderCancellationService from '#services/order_cancellation_service'
import PartnerCommissionService from '#services/partner_commission_service'
import Ingredient from '#models/ingredient'
import Item from '#models/item'
import OptionGroup, { optionPrice } from '#models/option_group'
import OptionGroupService from '#services/option_group_service'
import DashboardService from '#services/dashboard_service'
import InventoryService from '#services/inventory_service'
import ItemService from '#services/item_service'
import OrderService, { BUSINESS_TIMEZONE, type HistoryFilters } from '#services/order_service'
import PaymentService from '#services/payment_service'
import ReportService from '#services/report_service'
import StoreService from '#services/store_service'
import Order from '#models/order'
import type { ToolContext } from '#assistant/types'

/** Orders that count as sales (as in ReportService). */
const NOT_SALES = [OrderStatus.PENDING_PAYMENT, OrderStatus.CANCELLED]
const MAX_DAYS = 366

const money = (value: unknown) => Math.round(Number(value ?? 0) * 100) / 100
const round3 = (value: number) => Math.round(value * 1000) / 1000
const isoDate = vine
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/)

/** A business-day period, from ≤ to, up to a year. */
function period(from: string, to: string) {
  const start = DateTime.fromISO(from, { zone: BUSINESS_TIMEZONE })
  const end = DateTime.fromISO(to, { zone: BUSINESS_TIMEZONE })
  if (!start.isValid || !end.isValid) throw new ToolError('Data inválida: use AAAA-MM-DD.')
  if (end < start) throw new ToolError('A data final vem antes da inicial.')
  const days = Math.round(end.diff(start, 'days').days) + 1
  if (days > MAX_DAYS) throw new ToolError('Escolha um período de até um ano.')
  return { from: start.toISODate()!, to: end.toISODate()!, days, start }
}

/** A failure the model should read and explain (not a crash). */
/** Text for a LIKE pattern: the model's `%` and `_` match themselves. */
function likeText(text: string) {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`)
}

export class ToolError extends Error {}

const itemsLine = (order: Order) =>
  order.items.map((line) => `${line.quantity}× ${line.displayName ?? line.name}`).join(', ')

export type ToolDefinition = {
  name: string
  /** What the model reads to decide when to call it (pt-BR, like the people using it). */
  description: string
  inputSchema: JSONSchema7
  validate: (input: unknown) => Promise<any>
  /** Store roles allowed to use it. Everyone else gets "Sem permissão" (never the data). */
  roles: StoreRole[]
  /** Reads run right away. */
  run?: (input: any, ctx: ToolContext) => Promise<unknown>
  /**
   * Writes wait for the person's approval: `preview` reads what will change
   * (shown on the approval card), `apply` runs after the yes, with the
   * `state` the preview kept.
   */
  approval?: {
    preview: (
      input: any,
      ctx: ToolContext,
      toolCallId: string
    ) => Promise<{ preview: AssistantApprovalPreview; state: unknown }>
    apply: (input: any, ctx: ToolContext, state: any) => Promise<unknown>
  }
}

const object = (properties: Record<string, JSONSchema7>, required: string[] = []): JSONSchema7 => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
})
const dateField = (description: string): JSONSchema7 => ({
  type: 'string',
  format: 'date',
  description,
})
// As in the panel: attendants work the orders board and the POS (orders,
// menu, whether the store is open); stock, reports and store settings,
// opening and closing it included, are the managers'.
const managers = [StoreRole.MANAGER]
const everyone = [StoreRole.MANAGER, StoreRole.ATTENDANT]

/* ------------------------------------------------------------------ reads */

const salesSummaryInput = vine.create(vine.object({ from: isoDate, to: isoDate }))

const salesSummary: ToolDefinition = {
  name: 'sales_summary',
  description:
    'Relatório de vendas da loja num período de dias (inclusive): faturamento, pedidos, ticket médio, itens vendidos, cancelados, comparação com o período anterior de mesmo tamanho, vendas por dia e por hora, mais vendidos, adicionais, formas de pagamento e canais (online e PDV). Use para perguntas sobre vendas, faturamento, horário de pico e mais vendidos.',
  inputSchema: object(
    {
      from: dateField('Primeiro dia do período (AAAA-MM-DD, fuso da loja).'),
      to: dateField('Último dia do período, inclusive.'),
    },
    ['from', 'to']
  ),
  validate: (input) => salesSummaryInput.validate(input),
  roles: managers,
  async run(input: Infer<typeof salesSummaryInput>, ctx): Promise<AssistantSalesSummary> {
    const range = period(input.from, input.to)
    const reports = await app.container.make(ReportService)
    const report = await reports.sales(ctx.store.id, { from: range.from, to: range.to })
    return {
      period: report.period,
      previousPeriod: report.previousPeriod,
      summary: report.summary,
      daily: report.period.days <= 62 ? report.daily : null,
      hourly: report.hourly.filter((row) => row.orders > 0),
      topItems: report.items.slice(0, 10),
      topAddons: report.addons.slice(0, 5),
      payments: report.payments.map(({ method, paid, orders, revenue }) => ({
        method,
        paid,
        orders,
        revenue,
      })),
      channels: report.channels,
    }
  },
}

const itemSalesInput = vine.create(
  vine.object({
    query: vine.string().trim().minLength(2).maxLength(60),
    from: isoDate,
    to: isoDate,
    compareFrom: isoDate.clone().optional(),
    compareTo: isoDate.clone().optional(),
  })
)

async function itemSalesIn(storeId: string, query: string, from: string, to: string) {
  const range = period(from, to)
  const rows = await db
    .from('orders')
    .join('order_items', 'order_items.order_id', 'orders.id')
    .where('orders.store_id', storeId)
    .whereBetween('orders.business_date', [range.from, range.to])
    .whereNotIn('orders.status', NOT_SALES)
    .whereILike('order_items.name', `%${likeText(query)}%`)
    .select('order_items.name')
    .select(db.raw(`to_char(orders.business_date, 'YYYY-MM-DD') as date`))
    .sum('order_items.quantity as units')
    .sum('order_items.total as revenue')
    .groupBy('order_items.name', 'orders.business_date')
  const byDate = new Map<string, { units: number; revenue: number }>()
  for (const row of rows) {
    const day = byDate.get(row.date) ?? { units: 0, revenue: 0 }
    day.units += Number(row.units)
    day.revenue = money(day.revenue + Number(row.revenue))
    byDate.set(row.date, day)
  }
  const daily = Array.from({ length: range.days }, (_, offset) => {
    const date = range.start.plus({ days: offset }).toISODate()!
    return { date, ...(byDate.get(date) ?? { units: 0, revenue: 0 }) }
  })
  const result: AssistantItemSalesPeriod = {
    from: range.from,
    to: range.to,
    units: daily.reduce((sum, day) => sum + day.units, 0),
    revenue: money(daily.reduce((sum, day) => sum + day.revenue, 0)),
    daily: range.days <= 62 ? daily : [],
  }
  return { result, names: rows.map((row) => row.name as string) }
}

const itemSales: ToolDefinition = {
  name: 'item_sales',
  description:
    'Vendas de um item (ou de vários com o mesmo trecho no nome, ex.: "carne", "caldo") por dia num período, opcionalmente comparadas com outro período. Use para "quanto vendi de X", "X vendeu mais que semana passada?".',
  inputSchema: object(
    {
      query: { type: 'string', description: 'Trecho do nome do item, como aparece no cardápio.' },
      from: dateField('Primeiro dia (AAAA-MM-DD).'),
      to: dateField('Último dia, inclusive.'),
      compareFrom: dateField('Opcional: primeiro dia do período de comparação.'),
      compareTo: dateField('Opcional: último dia do período de comparação.'),
    },
    ['query', 'from', 'to']
  ),
  validate: (input) => itemSalesInput.validate(input),
  roles: managers,
  async run(input: Infer<typeof itemSalesInput>, ctx): Promise<AssistantItemSales> {
    const current = await itemSalesIn(ctx.store.id, input.query, input.from, input.to)
    const compared =
      input.compareFrom && input.compareTo
        ? await itemSalesIn(ctx.store.id, input.query, input.compareFrom, input.compareTo)
        : null
    return {
      query: input.query,
      matches: [...new Set([...current.names, ...(compared?.names ?? [])])].sort(),
      period: current.result,
      comparison: compared?.result ?? null,
    }
  },
}

const stockForecastInput = vine.create(
  vine.object({
    baseFrom: isoDate,
    baseTo: isoDate,
    days: vine.number().withoutDecimals().min(1).max(30),
  })
)

const STOCK_ORDER: Record<AssistantStockStatus, number> = { out: 0, short: 1, low: 2, ok: 3 }

const stockForecast: ToolDefinition = {
  name: 'stock_forecast',
  description:
    'Estoque de cada insumo agora e quanto vai precisar nos próximos dias, se as vendas repetirem um período base (ex.: base = o último sábado, days = 1 para "vai faltar algo no sábado?"). Status: out (acabou), short (não dá para o período), low (fica abaixo do mínimo), ok.',
  inputSchema: object(
    {
      baseFrom: dateField('Primeiro dia do período usado como base de consumo.'),
      baseTo: dateField('Último dia da base, inclusive.'),
      days: { type: 'integer', description: 'Quantos dias à frente prever (1 a 30).' },
    },
    ['baseFrom', 'baseTo', 'days']
  ),
  validate: (input) => stockForecastInput.validate(input),
  roles: managers,
  async run(input: Infer<typeof stockForecastInput>, ctx): Promise<AssistantStockForecast> {
    const base = period(input.baseFrom, input.baseTo)
    const empty = {
      enabled: false,
      base: { from: base.from, to: base.to, days: base.days },
      days: input.days,
      ingredients: [],
    }
    if (!ctx.store.inventoryEnabled) return empty

    // One after the other: inside a transaction they share one connection.
    const ingredients = await Ingredient.query().where('storeId', ctx.store.id).orderBy('name')
    const used = await db
      .from('stock_movements')
      .where('store_id', ctx.store.id)
      .whereIn('type', [StockMovementType.CONSUMPTION, StockMovementType.REVERSAL])
      .whereRaw('(created_at at time zone ?)::date between ? and ?', [
        BUSINESS_TIMEZONE,
        base.from,
        base.to,
      ])
      .select('ingredient_id')
      .select(db.raw('-sum(quantity) as consumed'))
      .groupBy('ingredient_id')
    const consumed = new Map(used.map((row) => [Number(row.ingredient_id), Number(row.consumed)]))
    return {
      ...empty,
      enabled: true,
      ingredients: ingredients
        .map((ingredient) => {
          const dailyUse = round3(Math.max(0, consumed.get(ingredient.id) ?? 0) / base.days)
          const need = round3(dailyUse * input.days)
          const stock = ingredient.stockQuantity
          const status: AssistantStockStatus =
            stock <= 0
              ? 'out'
              : stock < need
                ? 'short'
                : stock - need < ingredient.minStock
                  ? 'low'
                  : 'ok'
          return {
            id: ingredient.id,
            name: ingredient.name,
            unit: ingredient.unit,
            badge: ingredient.badge,
            stock,
            minStock: ingredient.minStock,
            dailyUse,
            need,
            status,
          }
        })
        .sort(
          (a, b) => STOCK_ORDER[a.status] - STOCK_ORDER[b.status] || a.name.localeCompare(b.name)
        ),
    }
  },
}

const noInput = vine.create(vine.object({}))

const ordersNow: ToolDefinition = {
  name: 'orders_now',
  description:
    'Quadro de pedidos de hoje que ainda não foram entregues (na fila, em preparo, prontos, e os do PDV esperando pagamento na maquininha): cliente, itens, há quantos minutos, se passou do tempo de retirada da loja e quanto falta receber.',
  inputSchema: object({}),
  validate: (input) => noInput.validate(input),
  roles: everyone,
  async run(_input, ctx): Promise<AssistantOrdersNow> {
    const orders = await app.container.make(OrderService)
    const now = DateTime.now()
    const today = await orders.list(ctx.store.id, {
      statuses: [
        OrderStatus.PENDING_PAYMENT,
        OrderStatus.RECEIVED,
        OrderStatus.PREPARING,
        OrderStatus.READY,
      ],
    })
    // Unpaid online orders aren't on the board; POS and partner orders held
    // for the machine are.
    const open = today.filter(
      (order) => order.status !== OrderStatus.PENDING_PAYMENT || order.channel !== 'online'
    )
    const eta = ctx.store.pickupEtaMinutes
    const counts: AssistantOrdersNow['counts'] = {}
    for (const order of open) counts[order.status] = (counts[order.status] ?? 0) + 1
    return {
      etaMinutes: eta,
      counts,
      orders: open.map((order) => {
        const minutes = Math.max(0, Math.floor(now.diff(order.createdAt, 'minutes').minutes))
        return {
          id: order.id,
          number: order.number,
          customerName: order.customerName,
          status: order.status,
          channel: order.channel,
          minutes,
          late:
            minutes > eta &&
            [OrderStatus.RECEIVED, OrderStatus.PREPARING].includes(
              order.status as typeof OrderStatus.RECEIVED
            ),
          items: itemsLine(order),
          amountDue: money(order.total - order.amountPaid),
          partnerName: order.partner?.name ?? null,
          cancelRequested: (order.cancelRequests ?? []).length > 0,
        }
      }),
    }
  },
}

const findOrdersInput = vine.create(
  vine.object({
    from: isoDate,
    to: isoDate,
    search: vine.string().trim().maxLength(80).optional(),
    status: vine.array(vine.enum(Object.values(OrderStatus))).optional(),
  })
)

const findOrders: ToolDefinition = {
  name: 'find_orders',
  description:
    'Busca no histórico de pedidos de um período (até 20, mais recentes primeiro): por nome do cliente, número do pedido ou parte do telefone, e por status. Use para "o pedido da Ana", "pedidos cancelados ontem".',
  inputSchema: object(
    {
      from: dateField('Primeiro dia (AAAA-MM-DD).'),
      to: dateField('Último dia, inclusive.'),
      search: { type: 'string', description: 'Opcional: nome, número (#12) ou parte do telefone.' },
      status: {
        type: 'array',
        description: 'Opcional: só estes status.',
        items: { type: 'string', enum: Object.values(OrderStatus) },
      },
    },
    ['from', 'to']
  ),
  validate: (input) => findOrdersInput.validate(input),
  roles: managers,
  async run(input: Infer<typeof findOrdersInput>, ctx): Promise<AssistantFoundOrders> {
    const range = period(input.from, input.to)
    const orders = await app.container.make(OrderService)
    const page = await orders.listHistory(ctx.store.id, {
      createdAt: `${range.from}~${range.to}`,
      customerName: input.search || undefined,
      status: input.status?.length ? input.status : undefined,
      page: 1,
      perPage: 20,
    } as HistoryFilters)
    return {
      total: page.total,
      orders: page.all().map((order) => ({
        id: order.id,
        number: order.number,
        date: order.businessDate.toISODate()!,
        customerName: order.customerName,
        status: order.status,
        channel: order.channel,
        paymentMethod: order.paymentMethod,
        total: order.total,
        items: itemsLine(order),
      })),
    }
  },
}

const payLaterOpen: ToolDefinition = {
  name: 'pay_later_open',
  description:
    'Pedidos em "Pagar depois" (fiado) ainda não recebidos, de qualquer dia: quantidade, total e quem deve mais. Os telefones vêm só com os últimos dígitos.',
  inputSchema: object({}),
  validate: (input) => noInput.validate(input),
  roles: managers,
  async run(_input, ctx): Promise<AssistantPayLater> {
    const orders = await app.container.make(OrderService)
    const summary = await orders.payLaterSummary(ctx.store.id)
    return {
      count: summary.count,
      total: summary.total,
      // The model provider doesn't need the customers' numbers.
      debtors: summary.debtors.map((debtor) => ({
        ...debtor,
        phone: debtor.phone ? `•• ${debtor.phone.slice(-4)}` : null,
      })),
    }
  },
}

const menuItemsInput = vine.create(
  vine.object({
    search: vine.string().trim().maxLength(60).optional(),
    category: vine.string().trim().maxLength(60).optional(),
  })
)

const menuItems: ToolDefinition = {
  name: 'menu_items',
  description:
    'Itens do cardápio (até 80): id, nome, categoria, preço, se está à venda, os grupos de escolha (ex.: "Escolha o queijo") e os adicionais que oferece e, quando a loja controla estoque, quantas unidades ainda dá para fazer. Use antes de alterar preços, pausar itens ou mexer nos grupos de um item, para ter os ids.',
  inputSchema: object({
    search: { type: 'string', description: 'Opcional: trecho do nome do item.' },
    category: { type: 'string', description: 'Opcional: trecho do nome da categoria.' },
  }),
  validate: (input) => menuItemsInput.validate(input),
  roles: everyone,
  async run(input: Infer<typeof menuItemsInput>, ctx): Promise<AssistantMenuItems> {
    const items = await Item.query()
      .whereHas('category', (category) => {
        category.where('store_id', ctx.store.id)
        if (input.category) category.whereILike('name', `%${likeText(input.category)}%`)
      })
      .if(input.search, (query) => query.whereILike('name', `%${likeText(input.search ?? '')}%`))
      .preload('category')
      .preload('optionGroups', (groups) => groups.orderBy('item_option_groups.order', 'asc'))
      .preload('addons')
      .orderBy('category_id')
      .orderBy('order')
      .limit(80)
    const inventory = await app.container.make(InventoryService)
    const { items: capacity } = await inventory.capacities(ctx.store)
    return {
      inventory: ctx.store.inventoryEnabled,
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category.name,
        price: item.price,
        isAvailable: item.isAvailable,
        stockLeft: capacity.get(item.id) ?? null,
        groups: item.optionGroups.map((group) => group.name),
        addons: item.addons.map((addon) => addon.name),
      })),
    }
  },
}

/* ------------------------------------------------------------------ writes */

const updateItemsInput = vine.create(
  vine.object({
    changes: vine
      .array(
        vine.object({
          itemId: vine.string().uuid(),
          price: vine.number().min(0.01).max(99999.99).optional(),
          isAvailable: vine.boolean().optional(),
        })
      )
      .minLength(1)
      .maxLength(50)
      .distinct('itemId'),
    summary: vine.string().trim().minLength(1).maxLength(160),
  })
)

const updateItems: ToolDefinition = {
  name: 'update_items',
  description:
    'Altera o preço e/ou pausa (isAvailable false) ou volta a vender (true) itens do cardápio. Pede aprovação: a pessoa vê o antes e o depois e confirma. Pegue os ids com menu_items. Preços finais em reais (ex.: 17.5), já calculados.',
  inputSchema: object(
    {
      changes: {
        type: 'array',
        items: object(
          {
            itemId: { type: 'string', format: 'uuid' },
            price: { type: 'number', description: 'Opcional: novo preço final.' },
            isAvailable: {
              type: 'boolean',
              description: 'Opcional: false pausa, true volta a vender.',
            },
          },
          ['itemId']
        ),
      },
      summary: {
        type: 'string',
        description: 'Uma linha dizendo o que muda ("+R$ 2 nos pastéis doces").',
      },
    },
    ['changes', 'summary']
  ),
  validate: (input) => updateItemsInput.validate(input),
  roles: managers,
  approval: {
    async preview(input: Infer<typeof updateItemsInput>, ctx, toolCallId) {
      const items = await Item.query()
        .whereIn(
          'id',
          input.changes.map((change) => change.itemId)
        )
        .whereHas('category', (category) => category.where('store_id', ctx.store.id))
      const byId = new Map(items.map((item) => [item.id, item]))
      const missing = input.changes.filter((change) => !byId.has(change.itemId))
      if (missing.length)
        throw new ToolError(
          `Itens não encontrados nesta loja: ${missing.map((c) => c.itemId).join(', ')}`
        )
      const rows = input.changes.map((change) => {
        const item = byId.get(change.itemId)!
        return {
          itemId: item.id,
          name: item.name,
          before: { price: item.price, isAvailable: item.isAvailable },
          after: {
            price: change.price === undefined ? item.price : money(change.price),
            isAvailable: change.isAvailable ?? item.isAvailable,
          },
        }
      })
      return {
        preview: { kind: 'update_items', toolCallId, summary: input.summary, rows },
        state: items.map((item) => ({ id: item.id, updatedAt: item.updatedAt.toISO() })),
      }
    },
    async apply(
      input: Infer<typeof updateItemsInput>,
      ctx,
      state: { id: string; updatedAt: string }[]
    ) {
      const seen = new Map(state.map((row) => [row.id, row.updatedAt]))
      const service = await app.container.make(ItemService)
      // All or nothing; rows already at these values count as done (a repeat).
      await service.bulkUpdateForStore(
        ctx.store.id,
        input.changes.map((change) => ({
          id: change.itemId,
          updatedAt: seen.get(change.itemId)!,
          price: change.price === undefined ? undefined : money(change.price),
          isAvailable: change.isAvailable,
        }))
      )
      return { updated: input.changes.length }
    },
  },
}

const recordStockInput = vine.create(
  vine.object({
    ingredientId: vine.number().withoutDecimals().positive(),
    type: vine.enum([
      StockMovementType.PURCHASE,
      StockMovementType.WASTE,
      StockMovementType.ADJUSTMENT,
    ]),
    quantity: vine.number().min(0).max(1_000_000),
    note: vine.string().trim().maxLength(200).optional(),
  })
)

const recordStock: ToolDefinition = {
  name: 'record_stock',
  description:
    'Lança uma movimentação de estoque de um insumo: purchase (compra: soma), waste (perda: tira) ou adjustment (contagem: o estoque passa a ser a quantidade). Pede aprovação. O id do insumo vem de stock_forecast. Quantidade na unidade do insumo.',
  inputSchema: object(
    {
      ingredientId: { type: 'integer' },
      type: { type: 'string', enum: ['purchase', 'waste', 'adjustment'] },
      quantity: { type: 'number', description: 'Na unidade do insumo (kg, un, l...).' },
      note: { type: 'string', description: 'Opcional: observação ("compra no atacado").' },
    },
    ['ingredientId', 'type', 'quantity']
  ),
  validate: (input) => recordStockInput.validate(input),
  roles: managers,
  approval: {
    async preview(input: Infer<typeof recordStockInput>, ctx, toolCallId) {
      const ingredient = await Ingredient.query()
        .where({ storeId: ctx.store.id, id: input.ingredientId })
        .first()
      if (!ingredient) throw new ToolError('Insumo não encontrado nesta loja.')
      const before = ingredient.stockQuantity
      const after =
        input.type === StockMovementType.PURCHASE
          ? before + input.quantity
          : input.type === StockMovementType.WASTE
            ? before - input.quantity
            : input.quantity
      return {
        preview: {
          kind: 'record_stock',
          toolCallId,
          name: ingredient.name,
          unit: ingredient.unit,
          type: input.type,
          quantity: input.quantity,
          before,
          after: round3(after),
          note: input.note ?? null,
        },
        state: null,
      }
    },
    async apply(input: Infer<typeof recordStockInput>, ctx) {
      const inventory = await app.container.make(InventoryService)
      const ingredient = await inventory.recordMovement(
        ctx.store.id,
        input.ingredientId,
        { type: input.type, quantity: input.quantity, note: input.note ?? 'Pelo assistente' },
        ctx.user.id
      )
      return {
        name: ingredient.name,
        unit: ingredient.unit,
        stockQuantity: ingredient.stockQuantity,
      }
    },
  },
}

const createMenuItemsInput = vine.create(
  vine.object({
    categories: vine
      .array(
        vine.object({
          name: vine.string().trim().minLength(2).maxLength(60),
          items: vine
            .array(
              vine.object({
                name: vine.string().trim().minLength(2).maxLength(120),
                price: vine.number().min(0.01).max(99999.99),
                description: vine.string().trim().maxLength(500).optional(),
              })
            )
            .minLength(1)
            .maxLength(60),
        })
      )
      .minLength(1)
      .maxLength(12),
  })
)

const sameName = (a: string, b: string) =>
  a.trim().toLocaleLowerCase('pt-BR') === b.trim().toLocaleLowerCase('pt-BR')

const createMenuItems: ToolDefinition = {
  name: 'create_menu_items',
  description:
    'Cria itens no cardápio, agrupados por categoria (usa a categoria com o mesmo nome se já existir, senão cria). Os itens entram pausados e sem foto, para a pessoa revisar e ativar. Use ao montar o cardápio a partir de uma foto ou lista. Pede aprovação.',
  inputSchema: object(
    {
      categories: {
        type: 'array',
        items: object(
          {
            name: { type: 'string' },
            items: {
              type: 'array',
              items: object(
                {
                  name: { type: 'string' },
                  price: { type: 'number', description: 'Preço em reais.' },
                  description: { type: 'string', description: 'Opcional, curta.' },
                },
                ['name', 'price']
              ),
            },
          },
          ['name', 'items']
        ),
      },
    },
    ['categories']
  ),
  validate: async (input) => {
    const data = await createMenuItemsInput.validate(input)
    if (data.categories.reduce((sum, category) => sum + category.items.length, 0) > 120) {
      throw new ToolError('No máximo 120 itens por vez.')
    }
    return data
  },
  roles: managers,
  approval: {
    async preview(input: Infer<typeof createMenuItemsInput>, ctx, toolCallId) {
      const existing = await Category.query().where('storeId', ctx.store.id)
      return {
        preview: {
          kind: 'create_menu_items',
          toolCallId,
          categories: input.categories.map((category) => ({
            name: category.name,
            isNew: !existing.some((row) => sameName(row.name, category.name)),
            items: category.items.map((item) => ({
              name: item.name,
              price: money(item.price),
              description: item.description ?? null,
            })),
          })),
        },
        state: null,
      }
    },
    async apply(input: Infer<typeof createMenuItemsInput>, ctx) {
      const created = await db.transaction(async (trx) => {
        let categories = 0
        let items = 0
        const existing = await Category.query({ client: trx })
          .where('storeId', ctx.store.id)
          .forUpdate()
        let nextCategoryOrder = Math.max(0, ...existing.map((row) => row.order)) + 1
        for (const draft of input.categories) {
          let category = existing.find((row) => sameName(row.name, draft.name))
          if (!category) {
            category = await Category.create(
              {
                storeId: ctx.store.id,
                name: draft.name,
                order: nextCategoryOrder++,
                requiresPreparation: true,
              },
              { client: trx }
            )
            existing.push(category)
            categories++
          }
          const current = await Item.query({ client: trx }).where('categoryId', category.id)
          let nextOrder = Math.max(0, ...current.map((row) => row.order)) + 1
          for (const item of draft.items) {
            // Already there (a repeated approval, or the same name): left alone.
            if (current.some((row) => sameName(row.name, item.name))) continue
            const row = await Item.create(
              {
                categoryId: category.id,
                name: item.name,
                price: money(item.price),
                description: item.description ?? null,
                isAvailable: false,
                order: nextOrder++,
              },
              { client: trx }
            )
            current.push(row)
            items++
          }
        }
        return { categories, items }
      })
      broadcastMenuChanged(ctx.store.id)
      return created
    },
  },
}

/* ------------------------------------------------- store, day and orders */

const storeStatus: ToolDefinition = {
  name: 'store_status',
  description:
    'Situação da loja agora: se está aberta para pedidos online, o status manual (open, closed, maintenance), se segue o horário de funcionamento, até quando fica aberta ou quando abre, e o tempo de retirada.',
  inputSchema: object({}),
  validate: (input) => noInput.validate(input),
  roles: everyone,
  async run(_input, ctx): Promise<AssistantStoreStatus> {
    await ctx.store.refresh()
    return {
      status: ctx.store.status,
      isOpen: ctx.store.isOpen,
      closesAt: ctx.store.closesAt,
      opensAt: ctx.store.opensAt,
      scheduleEnabled: ctx.store.scheduleEnabled,
      pickupEtaMinutes: ctx.store.pickupEtaMinutes,
    }
  },
}

const setStoreStatusInput = vine.create(
  vine.object({
    status: vine.enum([StoreStatus.OPEN, StoreStatus.CLOSED, StoreStatus.MAINTENANCE]),
  })
)

const setStoreStatus: ToolDefinition = {
  name: 'set_store_status',
  description:
    'Abre ou fecha a loja para pedidos online agora (open, closed, ou maintenance para "em manutenção"). Com horário de funcionamento ligado, "closed" fecha até o fim do horário atual e depois a loja volta a seguir o horário; "open" volta a seguir o horário. O PDV continua funcionando. Pede aprovação.',
  inputSchema: object({ status: { type: 'string', enum: ['open', 'closed', 'maintenance'] } }, [
    'status',
  ]),
  validate: (input) => setStoreStatusInput.validate(input),
  roles: managers,
  approval: {
    async preview(input: Infer<typeof setStoreStatusInput>, ctx, toolCallId) {
      await ctx.store.refresh()
      return {
        preview: {
          kind: 'store_status',
          toolCallId,
          before: { status: ctx.store.status, isOpen: ctx.store.isOpen },
          status: input.status,
          scheduleEnabled: ctx.store.scheduleEnabled,
        },
        state: null,
      }
    },
    async apply(input: Infer<typeof setStoreStatusInput>, ctx) {
      const stores = await app.container.make(StoreService)
      const store = await stores.updateStatus(ctx.store.id, input.status, ctx.user)
      return {
        status: store.status,
        isOpen: store.isOpen,
        closesAt: store.closesAt,
        opensAt: store.opensAt,
      }
    },
  },
}

const pickupTimeInput = vine.create(
  vine.object({ minutes: vine.number().withoutDecimals().min(1).max(240) })
)

const setPickupTime: ToolDefinition = {
  name: 'set_pickup_time',
  description:
    'Muda o tempo de retirada que a loja mostra aos clientes (em minutos, ex.: 25 num dia cheio). Também é o tempo que marca um pedido como atrasado. Pede aprovação.',
  inputSchema: object({ minutes: { type: 'integer', description: 'De 1 a 240.' } }, ['minutes']),
  validate: (input) => pickupTimeInput.validate(input),
  roles: managers,
  approval: {
    async preview(input: Infer<typeof pickupTimeInput>, ctx, toolCallId) {
      return {
        preview: {
          kind: 'pickup_time',
          toolCallId,
          before: ctx.store.pickupEtaMinutes,
          after: input.minutes,
        },
        state: null,
      }
    },
    async apply(input: Infer<typeof pickupTimeInput>, ctx) {
      const stores = await app.container.make(StoreService)
      await stores.update(ctx.store.id, { pickupEtaMinutes: input.minutes })
      return { pickupEtaMinutes: input.minutes }
    },
  },
}

const todayOverview: ToolDefinition = {
  name: 'today_overview',
  description:
    'Resumo do dia até agora (como a tela Visão geral): vendas comparadas ao mesmo dia da semana passada até este horário, fila de pedidos, tempo médio da cozinha, visitas e conversão do cardápio online, mais vendidos de hoje, insumos abaixo do mínimo e itens pausados ou esgotados.',
  inputSchema: object({}),
  validate: (input) => noInput.validate(input),
  roles: managers,
  async run(_input, ctx) {
    const dashboard = await app.container.make(DashboardService)
    const today = await dashboard.today(ctx.store.id)
    // The hour-by-hour pace and daily visits are for the page's charts.
    return {
      ...today,
      pace: undefined,
      visits: { ...today.visits, daily: [] },
    }
  },
}

const orderRef = {
  number: vine.number().withoutDecimals().positive(),
  date: isoDate.clone().optional(),
}
const orderDetailsInput = vine.create(vine.object(orderRef))

/** A store's order by its number on a business day (numbers start again each day). */
async function orderByNumber(ctx: ToolContext, number: number, date?: string) {
  const day = date ?? DateTime.now().setZone(BUSINESS_TIMEZONE).toISODate()!
  const order = await Order.query()
    .where({ storeId: ctx.store.id, number })
    .where('business_date', day)
    .preload('items', (items) => items.preload('addons').orderBy('id'))
    .preload('history', (history) => history.orderBy('id'))
    .preload('partner')
    .preload('cancelRequests', (requests) => requests.where('status', 'pending'))
    .first()
  if (!order) throw new ToolError(`Não achei o pedido #${number} de ${day}.`)
  return order
}

const maskPhone = (phone: string | null) => (phone ? `•• ${phone.slice(-4)}` : null)

const orderDetails: ToolDefinition = {
  name: 'order_details',
  description:
    'Detalhes de um pedido pelo número (de hoje, ou de outro dia com date): cliente, itens com adicionais e observações, status e quando mudou, canal, forma de pagamento, total, quanto já foi pago e quanto falta.',
  inputSchema: object(
    {
      number: { type: 'integer', description: 'O número do pedido (#12 → 12).' },
      date: dateField('Opcional: o dia do pedido (AAAA-MM-DD); padrão hoje.'),
    },
    ['number']
  ),
  validate: (input) => orderDetailsInput.validate(input),
  roles: managers,
  async run(input: Infer<typeof orderDetailsInput>, ctx): Promise<AssistantOrderDetails> {
    const order = await orderByNumber(ctx, input.number, input.date)
    return {
      id: order.id,
      number: order.number,
      date: order.businessDate.toISODate()!,
      customerName: order.customerName,
      customerPhone: maskPhone(order.customerPhone),
      status: order.status,
      channel: order.channel,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      payLater: Boolean(order.payLaterAt),
      total: order.total,
      amountPaid: order.amountPaid,
      amountDue: money(order.total - order.amountPaid),
      notes: order.notes,
      createdAt: order.createdAt.toISO()!,
      partnerName: order.partner?.name ?? null,
      cancelRequest: order.cancelRequests[0] ? { reason: order.cancelRequests[0].reason } : null,
      lines: order.items.map((line) => ({
        name: line.displayName ?? line.name,
        quantity: line.quantity,
        total: line.total,
        addons: line.addons.map((addon) =>
          addon.groupName ? `${addon.groupName}: ${addon.name}` : addon.name
        ),
        notes: line.notes,
      })),
      history: order.history.map((row) => ({ status: row.toStatus, at: row.createdAt.toISO()! })),
    }
  },
}

const cancelOrderInput = vine.create(vine.object(orderRef))

const cancelOrder: ToolDefinition = {
  name: 'cancel_order',
  description:
    'Cancela um pedido pelo número (de hoje, ou de outro dia com date). O estoque volta; o que foi pago online ou na maquininha integrada é estornado automaticamente; dinheiro recebido no balcão precisa ser devolvido à mão. Pede aprovação.',
  inputSchema: object(
    {
      number: { type: 'integer', description: 'O número do pedido.' },
      date: dateField('Opcional: o dia do pedido; padrão hoje.'),
    },
    ['number']
  ),
  validate: (input) => cancelOrderInput.validate(input),
  roles: managers,
  approval: {
    async preview(input: Infer<typeof cancelOrderInput>, ctx, toolCallId) {
      const order = await orderByNumber(ctx, input.number, input.date)
      if (order.status === OrderStatus.CANCELLED)
        throw new ToolError(`O pedido #${order.number} já está cancelado.`)
      if (order.status === OrderStatus.COMPLETED) {
        throw new ToolError(`O pedido #${order.number} já foi entregue: não dá para cancelar.`)
      }
      return {
        preview: {
          kind: 'cancel_order',
          toolCallId,
          number: order.number,
          customerName: order.customerName,
          status: order.status,
          total: order.total,
          amountPaid: order.amountPaid,
          items: itemsLine(order),
        },
        state: { orderId: order.id },
      }
    },
    async apply(_input, ctx, state: { orderId: string }) {
      // As the panel's "Cancelar": a charge waiting on the machine leaves it,
      // what a gateway took goes back, a partner who asked is told.
      const cancellation = await app.container.make(OrderCancellationService)
      const order = await cancellation.cancel(ctx.store.id, state.orderId, ctx.user)
      const payments = await app.container.make(PaymentService)
      const refunding = await payments.hasRefundable(order)
      return { number: order.number, status: order.status, refunding }
    },
  },
}

const itemDetailsInput = vine.create(
  vine.object({
    itemId: vine.string().uuid(),
    name: vine.string().trim().minLength(2).maxLength(120).optional(),
    description: vine.string().trim().maxLength(500).nullable().optional(),
  })
)

const updateItemDetails: ToolDefinition = {
  name: 'update_item_details',
  description:
    'Muda o nome e/ou a descrição de um item do cardápio (ex.: escrever descrições curtas e apetitosas). description null apaga a descrição. Pegue o id com menu_items. Pede aprovação.',
  inputSchema: object(
    {
      itemId: { type: 'string', format: 'uuid' },
      name: { type: 'string', description: 'Opcional: o novo nome.' },
      description: {
        type: ['string', 'null'],
        description: 'Opcional: a nova descrição (até 500 caracteres).',
      },
    },
    ['itemId']
  ),
  validate: async (input) => {
    const data = await itemDetailsInput.validate(input)
    if (data.name === undefined && data.description === undefined) {
      throw new ToolError('Diga o novo nome ou a nova descrição.')
    }
    return data
  },
  roles: managers,
  approval: {
    async preview(input: Infer<typeof itemDetailsInput>, ctx, toolCallId) {
      const item = await Item.query()
        .where('id', input.itemId)
        .whereHas('category', (category) => category.where('store_id', ctx.store.id))
        .first()
      if (!item) throw new ToolError('Item não encontrado nesta loja.')
      return {
        preview: {
          kind: 'item_details',
          toolCallId,
          before: { name: item.name, description: item.description },
          after: {
            name: input.name ?? item.name,
            description: input.description === undefined ? item.description : input.description,
          },
        },
        state: null,
      }
    },
    async apply(input: Infer<typeof itemDetailsInput>, ctx) {
      const items = await app.container.make(ItemService)
      const item = await items.update(ctx.store.id, input.itemId, {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
      })
      return { name: item.name, description: item.description }
    },
  },
}

/* ---------------------------------------------- choice groups and add-ons */

/** A group loaded with its options, as the cards show it. */
function ruleOf(group: OptionGroup): AssistantGroupRule {
  return {
    name: group.name,
    minChoices: group.minChoices,
    maxChoices: group.maxChoices,
    options: group.options.map((option) => ({ name: option.name, price: optionPrice(option) })),
  }
}

async function groupsInStore(storeId: string, ids: string[]) {
  if (ids.length === 0) return []
  const rows = await OptionGroup.query()
    .where('storeId', storeId)
    .whereIn('id', ids)
    .preload('options', (options) => options.orderBy('option_group_addons.order', 'asc'))
  if (rows.length !== new Set(ids).size) {
    throw new ToolError('Um dos grupos de escolha não existe nesta loja. Consulte option_groups.')
  }
  return rows
}

async function addonsInStore(storeId: string, ids: string[]) {
  if (ids.length === 0) return []
  const rows = await Addon.query().where('storeId', storeId).whereIn('id', ids)
  if (rows.length !== new Set(ids).size) {
    throw new ToolError('Um dos adicionais não existe nesta loja. Consulte option_groups.')
  }
  return rows
}

async function itemsInStore(storeId: string, ids: string[]) {
  const rows = await Item.query()
    .whereIn('id', ids)
    .whereHas('category', (category) => category.where('store_id', storeId))
    .preload('optionGroups', (groups) => groups.orderBy('item_option_groups.order', 'asc'))
    .preload('addons')
  if (rows.length !== new Set(ids).size) {
    throw new ToolError('Um dos itens não existe nesta loja. Consulte menu_items.')
  }
  return ids.map((id) => rows.find((row) => row.id === id)!)
}

/** A group as saved (rule and options with their prices here), to see whether it changed. */
const groupSnapshot = (group: OptionGroup) =>
  JSON.stringify({
    name: group.name,
    min: group.minChoices,
    max: group.maxChoices,
    options: group.options.map((option) => [option.id, option.$extras.pivot_price ?? null]),
  })

const CHANGED_SINCE =
  'Isso mudou depois do cartão de aprovação (alguém editou no painel). Consulte de novo e proponha outra vez.'

/** The service's own checks before a card is shown, as the model's error. */
async function validGroup(storeId: string, input: Parameters<OptionGroupService['validate']>[1]) {
  try {
    const service = await app.container.make(OptionGroupService)
    await service.validate(storeId, input)
  } catch (error) {
    if (error instanceof AppException) throw new ToolError(error.message)
    throw error
  }
}

/** Who offers a group: how many items, and the first names. */
async function itemsOfGroup(groupId: string) {
  const rows = await db
    .from('item_option_groups')
    .join('items', 'items.id', 'item_option_groups.item_id')
    .where('item_option_groups.option_group_id', groupId)
    .orderBy('items.name')
    .select('items.name')
  return { count: rows.length, names: rows.slice(0, 12).map((row) => row.name as string) }
}

const optionGroupsInput = vine.create(
  vine.object({ search: vine.string().trim().maxLength(80).optional() })
)

const optionGroups: ToolDefinition = {
  name: 'option_groups',
  description:
    'Grupos de escolha da loja (ex.: "Escolha o queijo", "Recheio extra", "Opcionais"): regra (mínimo 0 = opcional, mínimo 1+ = obrigatório; máximo), opções com preço e quais itens usam cada um; e todos os adicionais da loja (com ids). Use antes de editar um grupo, criar outro ou mudar os grupos/adicionais de um item. Um grupo é compartilhado: mudar a regra muda em todos os itens que o usam.',
  inputSchema: object({
    search: { type: 'string', description: 'Opcional: trecho do nome do grupo.' },
  }),
  validate: (input) => optionGroupsInput.validate(input),
  roles: managers,
  async run(input: Infer<typeof optionGroupsInput>, ctx): Promise<AssistantOptionGroups> {
    const groups = await OptionGroup.query()
      .where('storeId', ctx.store.id)
      .if(input.search, (query) => query.whereILike('name', `%${likeText(input.search ?? '')}%`))
      .preload('options', (options) => options.orderBy('option_group_addons.order', 'asc'))
      .orderBy('name')
      .limit(40)
    const result: AssistantOptionGroups['groups'] = []
    // One after the other (inside a transaction they share one connection).
    for (const group of groups) {
      result.push({
        id: group.id,
        name: group.name,
        minChoices: group.minChoices,
        maxChoices: group.maxChoices,
        allowRepeat: group.allowRepeat,
        pickPrices: group.pickPrices,
        options: group.options.map((option) => ({
          addonId: option.id,
          name: option.name,
          price: optionPrice(option),
        })),
        items: await itemsOfGroup(group.id),
      })
    }
    const addons = await Addon.query().where('storeId', ctx.store.id).orderBy('name').limit(150)
    return {
      groups: result,
      addons: addons.map((addon) => ({ id: addon.id, name: addon.name, price: addon.price })),
    }
  },
}

const optionInput = vine.object({
  addonId: vine.string().uuid(),
  price: vine.number().min(0).max(99999.99).nullable().optional(),
})

const updateOptionGroupInput = vine.create(
  vine.object({
    groupId: vine.string().uuid(),
    name: vine.string().trim().minLength(1).maxLength(120).optional(),
    minChoices: vine.number().withoutDecimals().min(0).max(20).optional(),
    maxChoices: vine.number().withoutDecimals().min(1).max(20).optional(),
    addOptions: vine.array(optionInput).maxLength(40).optional(),
    removeOptions: vine.array(vine.string().uuid()).maxLength(40).optional(),
  })
)

/** The group's input for OptionGroupService with the changes applied. */
function changedGroup(group: OptionGroup, input: Infer<typeof updateOptionGroupInput>) {
  const removed = new Set(input.removeOptions ?? [])
  const kept = group.options
    .filter((option) => !removed.has(option.id))
    .map((option) => ({
      addonId: option.id,
      price:
        option.$extras.pivot_price === null || option.$extras.pivot_price === undefined
          ? null
          : Number(option.$extras.pivot_price),
    }))
  const added = (input.addOptions ?? [])
    .filter((option) => !kept.some((row) => row.addonId === option.addonId))
    .map((option) => ({ addonId: option.addonId, price: option.price ?? null }))
  return {
    name: input.name ?? group.name,
    minChoices: input.minChoices ?? group.minChoices,
    maxChoices: input.maxChoices ?? group.maxChoices,
    allowRepeat: group.allowRepeat,
    pickPrices: group.pickPrices,
    replacesInName: group.replacesInName,
    options: [...kept, ...added],
  }
}

const updateOptionGroup: ToolDefinition = {
  name: 'update_option_group',
  description:
    'Edita um grupo de escolha: nome, mínimo (0 = opcional, 1+ = obrigatório), máximo, opções que entram (addOptions: adicionais da loja, com preço no grupo opcional; sem preço = o do adicional) ou saem (removeOptions). Vale para TODOS os itens que usam o grupo: se a pessoa quer mudar só para alguns itens, use create_option_group com copyFrom. Pegue os ids com option_groups. Pede aprovação.',
  inputSchema: object(
    {
      groupId: { type: 'string', format: 'uuid' },
      name: { type: 'string', description: 'Opcional: novo nome.' },
      minChoices: { type: 'integer', description: 'Opcional: mínimo de escolhas (0 = opcional).' },
      maxChoices: { type: 'integer', description: 'Opcional: máximo de escolhas.' },
      addOptions: {
        type: 'array',
        items: object(
          {
            addonId: { type: 'string', format: 'uuid' },
            price: { type: ['number', 'null'], description: 'Opcional: preço neste grupo.' },
          },
          ['addonId']
        ),
      },
      removeOptions: { type: 'array', items: { type: 'string', format: 'uuid' } },
    },
    ['groupId']
  ),
  validate: (input) => updateOptionGroupInput.validate(input),
  roles: managers,
  approval: {
    async preview(input: Infer<typeof updateOptionGroupInput>, ctx, toolCallId) {
      const [group] = await groupsInStore(ctx.store.id, [input.groupId])
      await addonsInStore(
        ctx.store.id,
        (input.addOptions ?? []).map((option) => option.addonId)
      )
      const next = changedGroup(group, input)
      await validGroup(ctx.store.id, next)
      const addons = await addonsInStore(
        ctx.store.id,
        next.options.map((option) => option.addonId)
      )
      return {
        preview: {
          kind: 'option_group',
          toolCallId,
          items: await itemsOfGroup(group.id),
          before: ruleOf(group),
          after: {
            name: next.name,
            minChoices: next.minChoices,
            maxChoices: next.maxChoices,
            options: next.options.map((option) => {
              const addon = addons.find((row) => row.id === option.addonId)!
              return { name: addon.name, price: option.price ?? addon.price }
            }),
          },
        },
        // What the card showed: applied as is, and only over the group it read.
        state: { before: groupSnapshot(group), next },
      }
    },
    async apply(
      input: Infer<typeof updateOptionGroupInput>,
      ctx,
      state: { before: string; next: ReturnType<typeof changedGroup> } | null
    ) {
      const [group] = await groupsInStore(ctx.store.id, [input.groupId])
      if (!state || groupSnapshot(group) !== state.before) throw new ToolError(CHANGED_SINCE)
      const service = await app.container.make(OptionGroupService)
      const saved = await service.update(ctx.store.id, group.id, state.next)
      return {
        name: saved.name,
        minChoices: saved.minChoices,
        maxChoices: saved.maxChoices,
        options: saved.options.length,
      }
    },
  },
}

type NewGroupState = {
  data: Awaited<ReturnType<typeof newGroup>>['data']
  items: { id: string; groups: string[] }[]
}

const createOptionGroupInput = vine.create(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(120),
    minChoices: vine.number().withoutDecimals().min(0).max(20),
    maxChoices: vine.number().withoutDecimals().min(1).max(20),
    copyFrom: vine.string().uuid().optional(),
    options: vine.array(optionInput).maxLength(40).optional(),
    itemIds: vine.array(vine.string().uuid()).maxLength(80).distinct().optional(),
    replaceGroupId: vine.string().uuid().optional(),
  })
)

/** The new group's input: copied (options, prices, name word) or from scratch. */
async function newGroup(storeId: string, input: Infer<typeof createOptionGroupInput>) {
  const [source] = input.copyFrom ? await groupsInStore(storeId, [input.copyFrom]) : []
  // An empty list (models fill optional arrays) copies the source's options too.
  const options = input.options?.length
    ? input.options.map((option) => ({ addonId: option.addonId, price: option.price ?? null }))
    : source?.options.map((option) => ({
        addonId: option.id,
        price:
          option.$extras.pivot_price === null || option.$extras.pivot_price === undefined
            ? null
            : Number(option.$extras.pivot_price),
      }))
  if (!options?.length)
    throw new ToolError('Diga as opções do grupo (options) ou copie um (copyFrom).')
  const data = {
    name: input.name,
    minChoices: input.minChoices,
    maxChoices: input.maxChoices,
    allowRepeat: source?.allowRepeat ?? false,
    // More prices by pick than picks allowed: only the first ones count.
    pickPrices: source?.pickPrices?.slice(0, input.maxChoices) ?? null,
    replacesInName: source?.replacesInName ?? null,
    options,
  }
  await validGroup(storeId, data)
  return { source, data }
}

const createOptionGroup: ToolDefinition = {
  name: 'create_option_group',
  description:
    'Cria um grupo de escolha e, opcionalmente, já o coloca em itens. copyFrom copia as opções, os preços e o resto de um grupo existente (ex.: uma versão opcional de "Escolha o queijo" só para os pastéis Premium: copyFrom = o grupo, minChoices 0, itemIds = os Premium, replaceGroupId = o grupo original, que sai desses itens e continua nos outros). Sem copyFrom, informe options (adicionais da loja). Pede aprovação.',
  inputSchema: object(
    {
      name: { type: 'string' },
      minChoices: { type: 'integer', description: '0 = opcional.' },
      maxChoices: { type: 'integer' },
      copyFrom: { type: 'string', format: 'uuid', description: 'Opcional: grupo a copiar.' },
      options: {
        type: 'array',
        description: 'Opcional se copyFrom: as opções (adicionais da loja).',
        items: object(
          {
            addonId: { type: 'string', format: 'uuid' },
            price: { type: ['number', 'null'], description: 'Opcional: preço neste grupo.' },
          },
          ['addonId']
        ),
      },
      itemIds: {
        type: 'array',
        items: { type: 'string', format: 'uuid' },
        description: 'Opcional: itens que passam a oferecer o grupo.',
      },
      replaceGroupId: {
        type: 'string',
        format: 'uuid',
        description: 'Opcional: grupo que o novo substitui nesses itens (na mesma posição).',
      },
    },
    ['name', 'minChoices', 'maxChoices']
  ),
  validate: (input) => createOptionGroupInput.validate(input),
  roles: managers,
  approval: {
    async preview(input: Infer<typeof createOptionGroupInput>, ctx, toolCallId) {
      const { source, data } = await newGroup(ctx.store.id, input)
      const addons = await addonsInStore(
        ctx.store.id,
        data.options.map((option) => option.addonId)
      )
      const items = input.itemIds?.length ? await itemsInStore(ctx.store.id, input.itemIds) : []
      const [replaced] = input.replaceGroupId
        ? await groupsInStore(ctx.store.id, [input.replaceGroupId])
        : []
      return {
        preview: {
          kind: 'new_option_group',
          toolCallId,
          group: {
            name: data.name,
            minChoices: data.minChoices,
            maxChoices: data.maxChoices,
            options: data.options.map((option) => {
              const addon = addons.find((row) => row.id === option.addonId)!
              return { name: addon.name, price: option.price ?? addon.price }
            }),
          },
          copyOf: source?.name ?? null,
          items: items.map((item) => item.name),
          replaces: replaced?.name ?? null,
        },
        // What the card showed: the group as is, and each item's groups as read.
        state: {
          data,
          items: items.map((item) => ({
            id: item.id,
            groups: item.optionGroups.map((row) => row.id),
          })),
        },
      }
    },
    async apply(input: Infer<typeof createOptionGroupInput>, ctx, state: NewGroupState | null) {
      if (!state) throw new ToolError(CHANGED_SINCE)
      const service = await app.container.make(OptionGroupService)
      const itemService = await app.container.make(ItemService)
      // All or nothing: the group and every item that takes it.
      const group = await db.transaction(async (trx) => {
        const items = state.items.length
          ? await itemsInStore(
              ctx.store.id,
              state.items.map((row) => row.id)
            )
          : []
        for (const item of items) {
          const read = state.items.find((row) => row.id === item.id)!.groups
          if (JSON.stringify(item.optionGroups.map((row) => row.id)) !== JSON.stringify(read)) {
            throw new ToolError(CHANGED_SINCE)
          }
        }
        const created = await service.create(ctx.store.id, state.data, trx)
        for (const item of items) {
          const current = item.optionGroups.map((row) => row.id)
          const at = input.replaceGroupId ? current.indexOf(input.replaceGroupId) : -1
          const next = at >= 0 ? current.toSpliced(at, 1, created.id) : [...current, created.id]
          await itemService.update(
            ctx.store.id,
            item.id,
            { optionGroupIds: [...new Set(next)] },
            trx
          )
        }
        return created
      })
      broadcastMenuChanged(ctx.store.id)
      return { id: group.id, name: group.name, items: state.items.length }
    },
  },
}

const itemExtrasInput = vine.create(
  vine.object({
    itemIds: vine.array(vine.string().uuid()).minLength(1).maxLength(50).distinct(),
    addGroupIds: vine.array(vine.string().uuid()).maxLength(10).optional(),
    removeGroupIds: vine.array(vine.string().uuid()).maxLength(10).optional(),
    addAddonIds: vine.array(vine.string().uuid()).maxLength(30).optional(),
    removeAddonIds: vine.array(vine.string().uuid()).maxLength(30).optional(),
  })
)

type Extras = { groups: string[]; addons: string[] }

/** An item's groups and add-ons now (ids, in order). */
const extrasOf = (item: Item): Extras => ({
  groups: item.optionGroups.map((row) => row.id),
  addons: item.addons.map((row) => row.id),
})

/** Same groups and add-ons, in the same order (saved state comes back from jsonb with its keys reordered). */
const sameExtras = (a: Extras, b: Extras) =>
  a.groups.join() === b.groups.join() && a.addons.join() === b.addons.join()

/** Each item's groups and add-ons after the change (ids, in order). */
function extrasAfter(item: Item, input: Infer<typeof itemExtrasInput>) {
  const dropGroups = new Set(input.removeGroupIds ?? [])
  const dropAddons = new Set(input.removeAddonIds ?? [])
  const groups = item.optionGroups.map((row) => row.id).filter((id) => !dropGroups.has(id))
  const addons = item.addons.map((row) => row.id).filter((id) => !dropAddons.has(id))
  return {
    groups: [...new Set([...groups, ...(input.addGroupIds ?? [])])],
    addons: [...new Set([...addons, ...(input.addAddonIds ?? [])])],
  }
}

const updateItemExtras: ToolDefinition = {
  name: 'update_item_extras',
  description:
    'Coloca ou tira grupos de escolha (addGroupIds/removeGroupIds) e adicionais avulsos (addAddonIds/removeAddonIds) de itens do cardápio (ex.: o grupo "Opcionais" com orégano e alho nas tirinhas). Prefira o grupo quando as opções já formam um; adicionais avulsos são os extras com preço próprio fora de grupos. Pegue os ids com menu_items e option_groups. Pede aprovação.',
  inputSchema: object(
    {
      itemIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
      addGroupIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
      removeGroupIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
      addAddonIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
      removeAddonIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
    },
    ['itemIds']
  ),
  validate: async (input) => {
    const data = await itemExtrasInput.validate(input)
    const changes = [data.addGroupIds, data.removeGroupIds, data.addAddonIds, data.removeAddonIds]
    if (!changes.some((list) => list?.length)) {
      throw new ToolError('Diga os grupos ou adicionais que entram ou saem.')
    }
    return data
  },
  roles: managers,
  approval: {
    async preview(input: Infer<typeof itemExtrasInput>, ctx, toolCallId) {
      const items = await itemsInStore(ctx.store.id, input.itemIds)
      const groups = await groupsInStore(ctx.store.id, [
        ...new Set([
          ...(input.addGroupIds ?? []),
          ...items.flatMap((item) => item.optionGroups.map((row) => row.id)),
        ]),
      ])
      const addons = await addonsInStore(ctx.store.id, [
        ...new Set([
          ...(input.addAddonIds ?? []),
          ...items.flatMap((item) => item.addons.map((row) => row.id)),
        ]),
      ])
      const groupName = (id: string) => groups.find((row) => row.id === id)!.name
      const state = items.map((item) => ({
        id: item.id,
        before: extrasOf(item),
        after: extrasAfter(item, input),
      }))
      const addonName = (id: string) => addons.find((row) => row.id === id)!.name
      return {
        preview: {
          kind: 'item_extras',
          toolCallId,
          rows: items.map((item) => {
            const after = extrasAfter(item, input)
            return {
              name: item.name,
              groups: {
                before: item.optionGroups.map((row) => row.name),
                after: after.groups.map(groupName),
              },
              addons: {
                before: item.addons.map((row) => row.name),
                after: after.addons.map(addonName),
              },
            }
          }),
        },
        // What the card showed: applied as is, only over what it read.
        state,
      }
    },
    async apply(
      input: Infer<typeof itemExtrasInput>,
      ctx,
      state: { id: string; before: Extras; after: Extras }[] | null
    ) {
      if (!state) throw new ToolError(CHANGED_SINCE)
      const service = await app.container.make(ItemService)
      await db.transaction(async (trx) => {
        const items = await itemsInStore(ctx.store.id, input.itemIds)
        for (const item of items) {
          const row = state.find((saved) => saved.id === item.id)
          if (!row || !sameExtras(extrasOf(item), row.before)) {
            throw new ToolError(CHANGED_SINCE)
          }
        }
        for (const row of state) {
          await service.update(
            ctx.store.id,
            row.id,
            { optionGroupIds: row.after.groups, addonIds: row.after.addons },
            trx
          )
        }
      })
      broadcastMenuChanged(ctx.store.id)
      return { items: state.length }
    },
  },
}

/* --------------------------------------------------------------- partners */

const ruleLabel = (type: string, value: number) =>
  type === 'percent'
    ? `${value.toLocaleString('pt-BR')}% de cada venda`
    : `R$ ${value.toFixed(2).replace('.', ',')} por unidade vendida`

const partnersInput = vine.create(
  vine.object({ from: isoDate.clone().optional(), to: isoDate.clone().optional() })
)

const partnersTool: ToolDefinition = {
  name: 'partners',
  description:
    'Parceiros da loja (quem vende o cardápio fora da loja, numa maquininha emprestada, por comissão): por parceiro, vendas e comissão num período (padrão: últimos 30 dias), a comissão a pagar (de todos os tempos, pedidos já entregues ao parceiro), a regra da comissão, se está pausado, maquininha e pessoas. Use para "quanto o parceiro vendeu", "quanto devo de comissão".',
  inputSchema: object({
    from: dateField('Opcional: primeiro dia (AAAA-MM-DD); padrão 30 dias atrás.'),
    to: dateField('Opcional: último dia, inclusive; padrão hoje.'),
  }),
  validate: (input) => partnersInput.validate(input),
  roles: managers,
  async run(input: Infer<typeof partnersInput>, ctx): Promise<AssistantPartners> {
    const today = DateTime.now().setZone(BUSINESS_TIMEZONE)
    const range = period(
      input.from ?? today.minus({ days: 29 }).toISODate()!,
      input.to ?? today.toISODate()!
    )
    const commissions = await app.container.make(PartnerCommissionService)
    const { data } = await commissions.table(ctx.store.id, {
      page: 1,
      perPage: 50,
      sort: [{ column: 'per.sales', direction: 'desc' }],
      filters: { createdAt: `${range.from}~${range.to}` },
    })
    return {
      period: { from: range.from, to: range.to },
      partners: data.map((row) => ({
        id: row.id,
        name: row.name,
        paused: Boolean(row.pausedAt),
        rule: ruleLabel(row.commissionType, row.commissionValue),
        machines: row.terminals.map((terminal) => terminal.name),
        people: row.membersCount,
        orders: row.period.orders,
        sales: row.period.sales,
        commission: row.period.commission,
        toPay: row.toPay,
      })),
    }
  },
}

const cancelRequestsTool: ToolDefinition = {
  name: 'cancel_requests',
  description:
    'Pedidos de cancelamento que parceiros fizeram e esperam um gerente: o pedido, o cliente, o parceiro e o motivo.',
  inputSchema: object({}),
  validate: (input) => noInput.validate(input),
  roles: managers,
  async run(_input, ctx): Promise<AssistantCancelRequests> {
    const service = await app.container.make(CancelRequestService)
    const pending = await service.listPending(ctx.store.id)
    const orders = await Order.query()
      .whereIn(
        'id',
        pending.map((request) => request.order.id)
      )
      .select('id', 'businessDate')
    return {
      requests: pending.map((request) => ({
        number: request.order.number,
        date: orders.find((order) => order.id === request.order.id)?.businessDate.toISODate() ?? '',
        customerName: request.order.customerName,
        partnerName: request.order.partner?.name ?? null,
        reason: request.reason,
        requestedBy: request.requestedBy?.name ?? null,
        status: request.order.status,
        total: request.order.total,
      })),
    }
  },
}

/** A partner by its name (or part of it), in this store. */
async function partnerByName(ctx: ToolContext, name: string) {
  const found = await StorePartner.query()
    .where('storeId', ctx.store.id)
    .whereILike('name', `%${likeText(name.trim())}%`)
    .orderBy('name')
  if (found.length === 0) throw new ToolError(`Não achei um parceiro "${name}".`)
  const exact = found.find((partner) => partner.name.toLowerCase() === name.trim().toLowerCase())
  if (!exact && found.length > 1) {
    throw new ToolError(
      `Mais de um parceiro parecido: ${found.map((p) => p.name).join(', ')}. Qual?`
    )
  }
  return exact ?? found[0]
}

const settleInput = vine.create(
  vine.object({
    partner: vine.string().trim().minLength(1).maxLength(80),
    until: isoDate,
    note: vine.string().trim().maxLength(300).optional(),
  })
)

const settlePartnerCommission: ToolDefinition = {
  name: 'settle_partner_commission',
  description:
    'Registra que a comissão de um parceiro foi paga (o pagamento em si é feito fora do sistema, por Pix ou dinheiro): todas as vendas já entregues ao parceiro até um dia, ainda não acertadas. Pede aprovação mostrando quantas vendas e o valor.',
  inputSchema: object(
    {
      partner: { type: 'string', description: 'O nome do parceiro (ou parte dele).' },
      until: dateField('Até que dia (AAAA-MM-DD), inclusive.'),
      note: { type: 'string', description: 'Opcional: observação ("Pix de sexta").' },
    },
    ['partner', 'until']
  ),
  validate: (input) => settleInput.validate(input),
  roles: managers,
  approval: {
    async preview(input: Infer<typeof settleInput>, ctx, toolCallId) {
      const partner = await partnerByName(ctx, input.partner)
      const commissions = await app.container.make(PartnerCommissionService)
      const { rows } = await commissions.sales(ctx.store.id, partner.id, {
        page: 1,
        perPage: 500,
        sort: [],
        filters: { createdAt: `~${input.until}`, settlement: 'to_pay' },
      })
      if (rows.length === 0) {
        throw new ToolError(`${partner.name} não tem comissão a pagar até ${input.until}.`)
      }
      const total = money(rows.reduce((sum, row) => sum + row.commissionAmount, 0))
      return {
        preview: {
          kind: 'settle_partner',
          toolCallId,
          partnerName: partner.name,
          until: input.until,
          orders: rows.length,
          total,
          note: input.note ?? null,
        },
        // Exactly the sales the card counted (a sale handed over meanwhile isn't in it).
        state: { partnerId: partner.id, orderIds: rows.map((row) => row.id), total },
      }
    },
    async apply(
      input: Infer<typeof settleInput>,
      ctx,
      state: { partnerId: string; orderIds: string[]; total: number } | null
    ) {
      if (!state) throw new ToolError(CHANGED_SINCE)
      const commissions = await app.container.make(PartnerCommissionService)
      try {
        const settlement = await commissions.settle(
          ctx.store.id,
          state.partnerId,
          { orderIds: state.orderIds, note: input.note ?? null },
          ctx.user
        )
        const partner = await StorePartner.findOrFail(state.partnerId)
        return {
          partnerName: partner.name,
          orders: settlement.ordersCount,
          total: settlement.total,
        }
      } catch (error) {
        if (error instanceof AppException && error.code === 'E_NOT_SETTLEABLE') {
          throw new ToolError(CHANGED_SINCE)
        }
        throw error
      }
    },
  },
}

const answerRequestInput = vine.create(
  vine.object({
    ...orderRef,
    approve: vine.boolean(),
    note: vine.string().trim().maxLength(300).optional(),
  })
)

const answerCancelRequest: ToolDefinition = {
  name: 'answer_cancel_request',
  description:
    'Responde o pedido de cancelamento que um parceiro fez para um pedido (pelo número, de hoje ou de outro dia com date): aprovar cancela o pedido (o que foi pago na maquininha é estornado sozinho); recusar mantém o pedido. O parceiro é avisado. Pede aprovação.',
  inputSchema: object(
    {
      number: { type: 'integer', description: 'O número do pedido.' },
      date: dateField('Opcional: o dia do pedido; padrão hoje.'),
      approve: {
        type: 'boolean',
        description: 'true: cancelar o pedido; false: recusar o pedido de cancelamento.',
      },
      note: { type: 'string', description: 'Opcional: um recado ao parceiro.' },
    },
    ['number', 'approve']
  ),
  validate: (input) => answerRequestInput.validate(input),
  roles: managers,
  approval: {
    async preview(input: Infer<typeof answerRequestInput>, ctx, toolCallId) {
      const order = await orderByNumber(ctx, input.number, input.date)
      const request = order.cancelRequests[0]
      if (!request) {
        throw new ToolError(`O pedido #${order.number} não tem pedido de cancelamento esperando.`)
      }
      return {
        preview: {
          kind: 'cancel_request',
          toolCallId,
          number: order.number,
          customerName: order.customerName,
          partnerName: order.partner?.name ?? null,
          reason: request.reason,
          approve: input.approve,
          amountPaid: order.amountPaid,
          note: input.note ?? null,
        },
        state: { orderId: order.id, requestId: request.id },
      }
    },
    async apply(
      input: Infer<typeof answerRequestInput>,
      ctx,
      state: { orderId: string; requestId: number } | null
    ) {
      if (!state) throw new ToolError(CHANGED_SINCE)
      const service = await app.container.make(CancelRequestService)
      const note = input.note ?? null
      if (input.approve)
        await service.approve(ctx.store.id, state.orderId, state.requestId, ctx.user, note)
      else await service.reject(ctx.store.id, state.orderId, state.requestId, ctx.user, note)
      return { number: input.number, approved: input.approve }
    },
  },
}

/**
 * Every tool, sent to the model in this order on every request (the list is
 * part of the cached prefix: never filter it per person; roles are enforced
 * when a tool runs).
 */
export const TOOLS: ToolDefinition[] = [
  salesSummary,
  itemSales,
  stockForecast,
  ordersNow,
  findOrders,
  payLaterOpen,
  menuItems,
  storeStatus,
  todayOverview,
  orderDetails,
  updateItems,
  updateItemDetails,
  optionGroups,
  updateOptionGroup,
  createOptionGroup,
  updateItemExtras,
  recordStock,
  createMenuItems,
  setStoreStatus,
  setPickupTime,
  cancelOrder,
  partnersTool,
  cancelRequestsTool,
  settlePartnerCommission,
  answerCancelRequest,
]

export const NO_PERMISSION = 'Sem permissão: só os gerentes da loja podem usar isso.'

/** Hooks of a request into its stream: the approval cards and what they read. */
export type ApprovalHooks = {
  /** Shows the card of a write (a `data-approval` part keyed by the call). */
  show: (toolCallId: string, preview: AssistantApprovalPreview, state: unknown) => void
  /** What the card's preview read (from the saved conversation), for the write. */
  stateOf: (toolCallId: string) => unknown
}

/**
 * The tools of one request (AI SDK `tool()`s bound to who is asking) and the
 * approvals of the writes. Inputs are validated with the VineJS schemas;
 * every call checks the role again, so the same list goes to every person
 * (it is part of the cached prefix).
 */
export function buildTools(ctx: ToolContext, hooks: ApprovalHooks) {
  const previewErrors = new Map<string, unknown>()
  const tools: ToolSet = {}
  const toolApproval: Record<
    string,
    (input: any, options: { toolCallId: string }) => Promise<'user-approval' | 'not-applicable'>
  > = {}

  for (const definition of TOOLS) {
    const allowed = definition.roles.includes(ctx.role)
    tools[definition.name] = tool({
      description: definition.description,
      inputSchema: jsonSchema<any>(definition.inputSchema, {
        validate: async (value) => {
          try {
            return { success: true, value: await definition.validate(value) }
          } catch (error) {
            return {
              success: false,
              error: new Error(toolErrorMessage(error) ?? 'Parâmetros inválidos.'),
            }
          }
        },
      }),
      execute: async (input: any, { toolCallId }: { toolCallId: string }) => {
        if (!allowed) throw new ToolError(NO_PERMISSION)
        if (!definition.approval) return await definition.run!(input, ctx)
        if (previewErrors.has(toolCallId)) throw previewErrors.get(toolCallId)
        return await definition.approval.apply(input, ctx, hooks.stateOf(toolCallId))
      },
    })

    const approval = definition.approval
    if (approval) {
      toolApproval[definition.name] = async (input, { toolCallId }) => {
        // Someone who can't write gets "Sem permissão" from execute, not a card.
        if (!allowed) return 'not-applicable'
        try {
          const { preview, state } = await approval.preview(input, ctx, toolCallId)
          hooks.show(toolCallId, preview, state)
          return 'user-approval'
        } catch (error) {
          // Nothing to approve (an item that isn't there): the call fails with the reason.
          previewErrors.set(toolCallId, error)
          return 'not-applicable'
        }
      }
    }
  }
  return { tools, toolApproval }
}

/** What the model reads when a tool fails (validation, permission, business rules). */
export function toolErrorMessage(error: unknown) {
  if (error instanceof ToolError) return error.message
  if (error instanceof AppException) return error.message
  const messages = (error as { messages?: { field: string; message: string }[] })?.messages
  if (Array.isArray(messages)) {
    return `Parâmetros inválidos: ${messages.map((m) => `${m.field}: ${m.message}`).join('; ')}`
  }
  return null
}
