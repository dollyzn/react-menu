import { BaseMail } from '@adonisjs/mail'
import type StoreRole from '#enums/store_role'
import { emailHtml, emailText, type EmailBrand, type EmailContent } from '#mails/layout'
import { storeRoleLabels } from '#notifications/templates'

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** A manager added this person to a store; the link creates their password. */
export default class StaffInviteNotification extends BaseMail {
  subject: string

  constructor(
    private to: { email: string; name: string | null },
    private invite: { store: EmailBrand; role: StoreRole; invitedBy: string | null },
    private setPasswordUrl: string
  ) {
    super()
    this.subject = `Você foi convidado para a equipe da ${invite.store.name}`
  }

  prepare() {
    const { store, role, invitedBy } = this.invite
    const content: EmailContent = {
      preview: `Crie sua senha para acessar o painel da ${store.name}.`,
      brand: store,
      eyebrow: 'Convite para a equipe',
      title: `Bem-vindo à equipe da ${store.name}`,
      blocks: [
        { type: 'paragraph', text: `Olá${this.to.name ? `, ${this.to.name}` : ''}!` },
        {
          type: 'paragraph',
          text: `${invitedBy ?? 'A gerência'} convidou você para o painel da loja. Crie sua senha para começar.`,
        },
        {
          type: 'details',
          rows: [
            ['Loja', store.name],
            ['Sua função', capitalize(storeRoleLabels[role])],
            ['Seu login', this.to.email],
          ],
        },
        { type: 'button', label: 'Criar minha senha', url: this.setPasswordUrl },
        {
          type: 'callout',
          text: 'O link vale por 7 dias. Se expirar, peça à gerência para reenviar o convite.',
        },
      ],
      footer: 'Não esperava este convite? Ignore este e-mail.',
    }
    this.message.to(this.to.email).html(emailHtml(content)).text(emailText(content))
  }
}
