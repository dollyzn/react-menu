import { mkdir, writeFile } from 'node:fs/promises'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import type { BaseMail } from '@adonisjs/mail'
import StoreRole from '#enums/store_role'
import type { EmailBrand } from '#mails/layout'
import type { OrderEmailData } from '#mails/order_email_data'
import ResetPasswordNotification from '#mails/reset_password_notification'
import StaffInviteNotification from '#mails/staff_invite_notification'
import StoreAccessNotification from '#mails/store_access_notification'
import OrderReceiptNotification from '#mails/order_receipt_notification'
import OrderRefundNotification from '#mails/order_refund_notification'

/**
 * Renders every e-mail with sample data into HTML files, to look at them
 * in a browser without sending anything:
 *
 *   node ace mail:preview            # tmp/mail-previews/*.html
 */
export default class MailPreview extends BaseCommand {
  static commandName = 'mail:preview'
  static description = 'Render every e-mail template with sample data into tmp/mail-previews'
  static options: CommandOptions = { startApp: true }

  @flags.string({ description: 'Output directory', default: 'tmp/mail-previews' })
  declare out: string

  async run() {
    const store: EmailBrand = {
      name: 'JJ Pastéis',
      logoUrl:
        'https://images.pexels.com/photos/5949891/pexels-photo-5949891.jpeg?w=120&h=120&fit=crop',
      address: 'Rua das Flores, 123 - Centro',
      phone: '(11) 99999-0000',
    }
    const person = { email: 'bruna@example.com', name: 'Bruna' }
    const order: OrderEmailData = {
      number: 42,
      customerName: 'Bruna Lima',
      paymentMethod: 'pix',
      totalLabel: 'R$ 51,00',
      paidAtLabel: '22/10/2026 às 19:42',
      trackingUrl: 'https://menu.example.com/pedido/abc123',
      lines: [
        {
          quantity: 2,
          name: 'Pastel de Carne',
          details: ['+ Catupiry Extra', 'Obs.: bem passado'],
          amount: 'R$ 36,00',
        },
        { quantity: 1, name: 'Pastel de Queijo', details: [], amount: 'R$ 15,00' },
      ],
      totals: [{ label: 'Total', value: 'R$ 51,00', strong: true }],
    }
    const link = 'https://menu.example.com/app/redefinir-senha?token=exemplo'

    const mails: Record<string, BaseMail> = {
      'reset-password': new ResetPasswordNotification(person, link),
      'staff-invite': new StaffInviteNotification(
        person,
        { store, role: StoreRole.ATTENDANT, invitedBy: 'Carlos' },
        `${link}&convite=1`
      ),
      'store-access': new StoreAccessNotification(
        person,
        { store, role: StoreRole.KITCHEN, addedBy: 'Carlos' },
        'https://menu.example.com/app/stores/1'
      ),
      'order-receipt': new OrderReceiptNotification(
        person.email,
        { ...store, pickupEtaMinutes: 15 },
        order
      ),
      'order-refund': new OrderRefundNotification(person.email, store, order),
      'order-receipt-no-logo': new OrderReceiptNotification(
        person.email,
        { name: 'Pastelaria Nova', pickupEtaMinutes: 20 },
        { ...order, paymentMethod: 'card' }
      ),
    }

    await mkdir(this.out, { recursive: true })
    for (const [name, mail] of Object.entries(mails)) {
      await mail.build()
      const { message } = mail.message.toJSON()
      await writeFile(`${this.out}/${name}.html`, String(message.html))
      await writeFile(`${this.out}/${name}.txt`, String(message.text))
    }
    this.logger.success(`${Object.keys(mails).length} e-mails in ${this.out}`)
  }
}
