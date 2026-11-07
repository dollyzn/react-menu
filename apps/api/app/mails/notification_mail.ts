import { BaseMail } from '@adonisjs/mail'
import env from '#start/env'
import { appBrand, emailHtml, emailText, type EmailBrand, type EmailContent } from '#mails/layout'

/**
 * A notification by e-mail, for the people who chose it in their
 * preferences (Configurações > Notificações). Same text as the bell and push.
 */
export default class NotificationMail extends BaseMail {
  subject: string

  constructor(
    private to: { email: string; name: string | null },
    private notification: {
      label: string
      title: string
      body: string
      /** In-app path ("/app/stores/…"). */
      url: string | null
      brand: EmailBrand | null
    }
  ) {
    super()
    this.subject = notification.title
  }

  prepare() {
    const frontend = env.get('FRONTEND_URL').replace(/\/$/, '')
    const { label, title, body, url, brand } = this.notification
    const content: EmailContent = {
      preview: body,
      brand: brand ?? appBrand(),
      eyebrow: label,
      title,
      blocks: [
        { type: 'paragraph', text: body },
        ...(url
          ? [{ type: 'button' as const, label: 'Abrir no painel', url: `${frontend}${url}` }]
          : []),
      ],
      footer: `Você recebe este e-mail pelas suas preferências de notificação. Para mudar: ${frontend}/app/settings#notificacoes`,
    }
    this.message.to(this.to.email).html(emailHtml(content)).text(emailText(content))
  }
}
