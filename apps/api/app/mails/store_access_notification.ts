import { BaseMail } from '@adonisjs/mail'
import type StoreRole from '#enums/store_role'
import { emailHtml, emailText, type EmailBrand, type EmailContent } from '#mails/layout'
import { storeRoleLabels } from '#notifications/templates'

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** An existing account was added to a store's team. */
export default class StoreAccessNotification extends BaseMail {
  subject: string

  constructor(
    private to: { email: string; name: string | null },
    private access: { store: EmailBrand; role: StoreRole; addedBy: string | null },
    private storeUrl: string
  ) {
    super()
    this.subject = `Você agora faz parte da equipe da ${access.store.name}`
  }

  prepare() {
    const { store, role, addedBy } = this.access
    const content: EmailContent = {
      preview: `Acesse o painel da ${store.name} com a sua conta de sempre.`,
      brand: store,
      eyebrow: 'Novo acesso',
      title: `Você agora faz parte da ${store.name}`,
      blocks: [
        { type: 'paragraph', text: `Olá${this.to.name ? `, ${this.to.name}` : ''}!` },
        {
          type: 'paragraph',
          text: `${addedBy ?? 'A gerência'} adicionou você à equipe. Entre com a sua conta de sempre: a loja já aparece no seu painel.`,
        },
        {
          type: 'details',
          rows: [
            ['Loja', store.name],
            ['Sua função', capitalize(storeRoleLabels[role])],
          ],
        },
        { type: 'button', label: 'Abrir o painel', url: this.storeUrl },
      ],
      footer: 'Não esperava este acesso? Fale com a gerência da loja.',
    }
    this.message.to(this.to.email).html(emailHtml(content)).text(emailText(content))
  }
}
