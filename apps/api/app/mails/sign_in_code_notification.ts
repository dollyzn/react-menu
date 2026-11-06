import { BaseMail } from '@adonisjs/mail'
import { appBrand, emailHtml, emailText, type EmailContent } from '#mails/layout'

/** The second step of a sign-in while no authenticator app is set up. */
export default class SignInCodeNotification extends BaseMail {
  subject: string

  constructor(
    private to: { email: string; name: string | null },
    readonly code: string,
    private details: { minutes: number; device: string | null; ip: string | null }
  ) {
    super()
    this.subject = `${code} é o seu código de acesso`
  }

  prepare() {
    const { minutes, device, ip } = this.details
    const content: EmailContent = {
      preview: `Use ${this.code} para entrar. Vale por ${minutes} minutos.`,
      brand: appBrand(),
      eyebrow: 'Acesso ao painel',
      title: 'Seu código de acesso',
      // No space inside the code: copying it must paste into the six boxes.
      highlight: { label: 'Código', value: this.code, code: true },
      blocks: [
        { type: 'paragraph', text: `Olá${this.to.name ? `, ${this.to.name}` : ''}!` },
        {
          type: 'paragraph',
          text: `Digite este código na tela de login para terminar de entrar. Ele vale por ${minutes} minutos e só uma vez.`,
        },
        ...(device || ip
          ? [
              {
                type: 'details' as const,
                rows: [
                  ...(device ? [['Aparelho', device] as [string, string]] : []),
                  ...(ip ? [['IP', ip] as [string, string]] : []),
                ],
              },
            ]
          : []),
        {
          type: 'callout',
          tone: 'warning',
          title: 'Não foi você?',
          text: 'Alguém tem a sua senha. Troque-a em Configurações e não passe este código para ninguém.',
        },
      ],
      footer: 'Configure um app autenticador em Configurações para entrar sem esperar e-mails.',
    }
    this.message.to(this.to.email).html(emailHtml(content)).text(emailText(content))
  }
}
