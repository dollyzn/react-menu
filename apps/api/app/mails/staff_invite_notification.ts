import { BaseMail } from '@adonisjs/mail'
import type StoreRole from '#enums/store_role'
import { emailHtml, emailText } from '#mails/layout'
import { storeRoleLabels } from '#notifications/templates'

/** A manager added this person to a store; the link creates their password. */
export default class StaffInviteNotification extends BaseMail {
  subject: string

  constructor(
    private to: { email: string; name: string | null },
    private invite: { storeName: string; role: StoreRole; invitedBy: string | null },
    private setPasswordUrl: string
  ) {
    super()
    this.subject = `Você foi convidado para a equipe da ${invite.storeName}`
  }

  prepare() {
    const content = {
      preview: `Crie sua senha para acessar o painel da ${this.invite.storeName}.`,
      title: `Bem-vindo à equipe da ${this.invite.storeName}`,
      paragraphs: [
        `Olá${this.to.name ? `, ${this.to.name}` : ''}!`,
        `${this.invite.invitedBy ?? 'A gerência'} adicionou você ao painel da ${this.invite.storeName} como ${storeRoleLabels[this.invite.role]}. Crie sua senha para entrar; o link vale por 7 dias.`,
      ],
      action: { label: 'Criar minha senha', url: this.setPasswordUrl },
      footer: 'Se você não esperava este convite, ignore este e-mail.',
    }
    this.message.to(this.to.email).html(emailHtml(content)).text(emailText(content))
  }
}
