import { BaseMail } from '@adonisjs/mail'
import { emailHtml, emailText, type EmailBrand, type EmailContent } from '#mails/layout'
import type { OrderEmailData } from '#mails/order_email_data'

const METHOD_LABEL: Record<string, string> = {
  pix: 'Pix',
  card: 'Cartão',
  mercado_pago: 'Mercado Pago',
}

/** Sent once an online payment is approved: the customer's receipt. */
export default class OrderReceiptNotification extends BaseMail {
  subject: string

  constructor(
    private to: string,
    private store: EmailBrand & { pickupEtaMinutes: number },
    private order: OrderEmailData
  ) {
    super()
    this.subject = `Pagamento confirmado · Pedido #${order.number} · ${store.name}`
  }

  prepare() {
    const { order, store } = this
    const content: EmailContent = {
      preview: `Recebemos ${order.totalLabel} do pedido #${order.number}. Ele já está na fila da cozinha.`,
      brand: store,
      eyebrow: 'Pagamento confirmado',
      title: `Obrigado, ${order.customerName.split(' ')[0]}!`,
      highlight: { label: 'Seu pedido', value: `#${order.number}` },
      blocks: [
        {
          type: 'paragraph',
          text: `Seu pagamento foi aprovado e o pedido já está na fila da cozinha. Quando ficar pronto, é só retirar no balcão${store.address ? `: ${store.address}` : ''}.`,
        },
        {
          type: 'callout',
          tone: 'success',
          title: `Pronto em cerca de ${store.pickupEtaMinutes} minutos`,
          text: 'Acompanhe pela página do pedido: ela avisa quando estiver pronto.',
        },
        { type: 'items', lines: order.lines, totals: order.totals },
        {
          type: 'details',
          rows: [
            ['Pagamento', METHOD_LABEL[order.paymentMethod] ?? order.paymentMethod],
            ['Data', order.paidAtLabel],
            ['Nome no pedido', order.customerName],
          ],
        },
        { type: 'button', label: 'Acompanhar meu pedido', url: order.trackingUrl },
      ],
      footer: 'Guarde este e-mail como comprovante. Dúvidas sobre o pedido? Fale com a loja.',
    }
    this.message.to(this.to).html(emailHtml(content)).text(emailText(content))
  }
}
