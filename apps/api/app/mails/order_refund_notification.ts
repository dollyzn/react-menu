import { BaseMail } from '@adonisjs/mail'
import { emailHtml, emailText, type EmailBrand, type EmailContent } from '#mails/layout'
import type { OrderEmailData } from '#mails/order_email_data'

const TIMING: Record<string, string> = {
  pix: 'No Pix, o valor costuma voltar para a sua conta em poucos minutos.',
  card: 'No cartão, o estorno aparece na fatura em até 2 faturas, conforme o banco emissor.',
}

/** A paid order was cancelled and its payment refunded. */
export default class OrderRefundNotification extends BaseMail {
  subject: string

  constructor(
    private to: string,
    private store: EmailBrand,
    private order: OrderEmailData
  ) {
    super()
    this.subject = `Reembolso do pedido #${order.number} · ${store.name}`
  }

  prepare() {
    const { order, store } = this
    const content: EmailContent = {
      preview: `Devolvemos ${order.totalLabel} do pedido #${order.number}.`,
      brand: store,
      eyebrow: 'Pedido cancelado',
      title: 'Seu dinheiro está voltando',
      highlight: { label: 'Valor reembolsado', value: order.totalLabel },
      blocks: [
        {
          type: 'paragraph',
          text: `O pedido #${order.number} foi cancelado pela loja e o pagamento foi estornado pelo mesmo meio que você usou.`,
        },
        {
          type: 'callout',
          text:
            TIMING[order.paymentMethod] ?? 'O prazo para o valor aparecer depende do seu banco.',
        },
        { type: 'items', lines: order.lines, totals: order.totals },
        { type: 'button', label: 'Ver o pedido', url: order.trackingUrl },
      ],
      footer: 'Ficou alguma dúvida? Fale com a loja pelos contatos abaixo.',
    }
    this.message.to(this.to).html(emailHtml(content)).text(emailText(content))
  }
}
