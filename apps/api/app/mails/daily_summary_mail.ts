import { BaseMail } from '@adonisjs/mail'
import env from '#start/env'
import {
  appBrand,
  emailHtml,
  emailText,
  formatMoney,
  type EmailBlock,
  type EmailContent,
} from '#mails/layout'

export type StoreSummary = {
  storeId: string
  storeName: string
  revenue: number
  orders: number
  averageTicket: number
  cancelled: number
  /** Revenue of the day before (null: no comparison). */
  previousRevenue: number | null
  topItems: { name: string; quantity: number }[]
  lowStock: { name: string }[]
}

const percent = (now: number, before: number) =>
  before > 0 ? `${now >= before ? '+' : ''}${Math.round(((now - before) / before) * 100)}%` : null

/** Yesterday's numbers of the stores a manager chose the summary for. */
export default class DailySummaryMail extends BaseMail {
  subject: string

  constructor(
    private to: { email: string; name: string | null },
    private summary: { dateLabel: string; stores: StoreSummary[] }
  ) {
    super()
    const [first] = summary.stores
    this.subject =
      summary.stores.length === 1
        ? `${first.storeName}: ${formatMoney(first.revenue)} em ${first.orders} ${first.orders === 1 ? 'pedido' : 'pedidos'} ${summary.dateLabel}`
        : `Resumo das suas lojas ${summary.dateLabel}`
  }

  prepare() {
    const frontend = env.get('FRONTEND_URL').replace(/\/$/, '')
    const blocks: EmailBlock[] = [
      {
        type: 'paragraph',
        text: `Olá${this.to.name ? `, ${this.to.name}` : ''}! Como foi ${this.summary.dateLabel}:`,
      },
    ]
    for (const store of this.summary.stores) {
      const change =
        store.previousRevenue === null ? null : percent(store.revenue, store.previousRevenue)
      blocks.push({
        type: 'details',
        rows: [
          ['Loja', store.storeName],
          [
            'Vendas',
            `${formatMoney(store.revenue)}${change ? ` (${change} vs. o dia anterior)` : ''}`,
          ],
          ['Pedidos', String(store.orders)],
          ['Ticket médio', formatMoney(store.averageTicket)],
          ...(store.cancelled ? [['Cancelados', String(store.cancelled)] as [string, string]] : []),
          ...(store.topItems.length
            ? [
                [
                  'Mais vendidos',
                  store.topItems.map((item) => `${item.quantity}× ${item.name}`).join(', '),
                ] as [string, string],
              ]
            : []),
        ],
      })
      if (store.lowStock.length) {
        blocks.push({
          type: 'callout',
          tone: 'warning',
          title: 'Estoque baixo',
          text: store.lowStock.map((item) => item.name).join(', '),
        })
      }
      blocks.push({
        type: 'button',
        label: `Ver relatório da ${store.storeName}`,
        url: `${frontend}/app/stores/${store.storeId}/reports`,
      })
    }
    const content: EmailContent = {
      preview: this.subject,
      brand: appBrand(),
      eyebrow: 'Resumo diário',
      title: `Resumo de ${this.summary.dateLabel}`,
      blocks,
      footer: `Você recebe este resumo pelas suas preferências de notificação. Para mudar o horário ou desligar: ${frontend}/app/settings#notificacoes`,
    }
    this.message.to(this.to.email).html(emailHtml(content)).text(emailText(content))
  }
}
