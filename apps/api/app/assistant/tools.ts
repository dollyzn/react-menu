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
  AssistantMenuItems,
  AssistantOrdersNow,
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
import Category from '#models/category'
import Ingredient from '#models/ingredient'
import Item from '#models/item'
import DashboardService from '#services/dashboard_service'
import InventoryService from '#services/inventory_service'
import ItemService from '#services/item_service'
import OrderService, { BUSINESS_TIMEZONE, type HistoryFilters } from '#services/order_service'
import PaymentService from '#services/payment_service'
import PointService from '#services/point_service'
import ReportService from '#services/report_service'
import StoreService from '#services/store_service'
import RefundOrder from '#jobs/refund_order'
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
            icon: ingredient.icon,
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
    // Unpaid online orders aren't on the board; POS orders held for the machine are.
    const open = today.filter(
      (order) => order.status !== OrderStatus.PENDING_PAYMENT || order.channel === 'pos'
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
    'Itens do cardápio (até 80): id, nome, categoria, preço, se está à venda e, quando a loja controla estoque, quantas unidades ainda dá para fazer. Use antes de alterar preços ou pausar itens, para ter os ids.',
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
      const orders = await app.container.make(OrderService)
      const order = await orders.cancel(ctx.store.id, state.orderId, ctx.user)
      // As the panel's "Cancelar": a charge waiting on the machine leaves it,
      // and what a gateway took goes back (a job with retries).
      const point = await app.container.make(PointService)
      await point.cancelWaiting(order, ctx.store)
      const payments = await app.container.make(PaymentService)
      const refunding = await payments.hasRefundable(order)
      if (refunding) await RefundOrder.dispatchFor(order)
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
  recordStock,
  createMenuItems,
  setStoreStatus,
  setPickupTime,
  cancelOrder,
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
