import { BaseMail } from '@adonisjs/mail'
import type StoreRole from '#enums/store_role'
import { emailHtml, emailText } from '#mails/layout'
import { storeRoleLabels } from '#notifications/templates'

/** An existing account was added to a store's team. */
export default class StoreAccessNotification extends BaseMail {
  subject: string

  constructor(
    private to: { email: string; name: string | null },
    private access: { storeName: string; role: StoreRole; addedBy: string | null },
    private storeUrl: string
  ) {
    super()
    this.subject = `Você agora faz parte da equipe da ${access.storeName}`
  }

  prepare() {
    const content = {
      preview: `Acesse o painel da ${this.access.storeName} com a sua conta de sempre.`,
      title: `Bem-vindo à equipe da ${this.access.storeName}`,
      paragraphs: [
        `Olá${this.to.name ? `, ${this.to.name}` : ''}!`,
        `${this.access.addedBy ?? 'A gerência'} adicionou você ao painel da ${this.access.storeName} como ${storeRoleLabels[this.access.role]}. Entre com a sua conta de sempre.`,
      ],
      action: { label: 'Abrir o painel', url: this.storeUrl },
      footer: 'Se você não esperava este acesso, fale com a gerência da loja.',
    }
    this.message.to(this.to.email).html(emailHtml(content)).text(emailText(content))
  }
}
