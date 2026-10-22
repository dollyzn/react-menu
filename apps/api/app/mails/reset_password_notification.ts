import { BaseMail } from '@adonisjs/mail'
import { appBrand, emailHtml, emailText, type EmailContent } from '#mails/layout'

/** Link to choose a new password (valid for 1 hour, single use). */
export default class ResetPasswordNotification extends BaseMail {
  subject = 'Redefina sua senha'

  constructor(
    private to: { email: string; name: string | null },
    private resetUrl: string
  ) {
    super()
  }

  prepare() {
    const content: EmailContent = {
      preview: 'Use o link para escolher uma nova senha. Ele vale por 1 hora.',
      brand: appBrand(),
      eyebrow: 'Acesso ao painel',
      title: 'Redefina sua senha',
      blocks: [
        { type: 'paragraph', text: `Olá${this.to.name ? `, ${this.to.name}` : ''}!` },
        {
          type: 'paragraph',
          text: 'Recebemos um pedido para redefinir a senha da sua conta. Toque no botão para escolher uma nova.',
        },
        { type: 'button', label: 'Escolher nova senha', url: this.resetUrl },
        {
          type: 'callout',
          tone: 'warning',
          title: 'Vale por 1 hora e só uma vez',
          text: 'Ao trocar a senha, as sessões abertas em outros aparelhos são encerradas.',
        },
      ],
      footer: 'Não foi você? Ignore este e-mail: sua senha continua a mesma.',
    }
    this.message.to(this.to.email).html(emailHtml(content)).text(emailText(content))
  }
}
