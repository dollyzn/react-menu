import { BaseMail } from '@adonisjs/mail'
import { emailHtml, emailText } from '#mails/layout'

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
    const content = {
      preview: 'Use o link para escolher uma nova senha. Ele vale por 1 hora.',
      title: 'Redefina sua senha',
      paragraphs: [
        `Olá${this.to.name ? `, ${this.to.name}` : ''}!`,
        'Recebemos um pedido para redefinir a senha da sua conta no painel. Toque no botão para escolher uma nova senha. O link vale por 1 hora e só pode ser usado uma vez.',
      ],
      action: { label: 'Escolher nova senha', url: this.resetUrl },
      footer:
        'Se não foi você, ignore este e-mail: sua senha continua a mesma. Ao redefinir, as sessões abertas em outros aparelhos são encerradas.',
    }
    this.message.to(this.to.email).html(emailHtml(content)).text(emailText(content))
  }
}
