/**
 * Our message templates, created in each store's WABA (ADR 0025). A changed
 * text is a new name (`_vN`): Meta reviews every template, and an approved
 * one keeps working while its replacement waits. Old versions left in a
 * WABA are simply no longer used.
 *
 * Meta's rules that shape the texts: a variable can't hold line breaks (the
 * items go on one line), can't start or end the body, and the texts must be
 * about the order (anything promotional gets recategorized as marketing,
 * which costs more). Replies to a Cloud API number reach nobody unless the
 * store also uses the WhatsApp Business app, so no "é só responder".
 */

export const TEMPLATES = {
  ORDER_RECEIVED: 'rm_pedido_recebido_v2',
  ORDER_PREPARING: 'rm_pedido_preparo_v1',
  ORDER_READY: 'rm_pedido_pronto_v2',
  ORDER_COMPLETED: 'rm_pedido_retirado_v1',
  ORDER_CANCELLED: 'rm_pedido_cancelado_v2',
  LOGIN_CODE: 'rm_codigo_acesso_v1',
} as const
export type TemplateName = (typeof TEMPLATES)[keyof typeof TEMPLATES]

export const TEMPLATE_LANGUAGE = 'pt_BR'

/** Minutes a login code is valid (also printed by the template's footer). */
export const LOGIN_CODE_MINUTES = 10

/** The order notices a store can turn on or off, in the order they happen. */
export const NOTICE_KINDS = ['received', 'preparing', 'ready', 'completed', 'cancelled'] as const
export type NoticeKind = (typeof NOTICE_KINDS)[number]

/** Values of the examples Meta reviews, also the panel's previews. */
const EXAMPLE: Record<string, string> = {
  cliente: 'Ana',
  numero: '42',
  loja: 'JJ Pastéis',
  itens: '2x Pastel de Carne, 1x Pastel de Queijo, 1x Coca-Cola Lata',
  pagamento: 'Pix (pago)',
  total: 'R$ 43,00',
  previsao: 'fica pronto em cerca de 20 minutos',
}

/** A link button to the order's tracking page (`/pedido/<token>`). */
type Button = { text: string }

export type NoticeDefinition = {
  kind: NoticeKind
  name: TemplateName
  /** What it is, in the panel. */
  label: string
  /** When it goes out, in the panel. */
  when: string
  /** On until the store turns it off. */
  defaultOn: boolean
  body: string
  button: Button | null
}

export const NOTICES: NoticeDefinition[] = [
  {
    kind: 'received',
    name: TEMPLATES.ORDER_RECEIVED,
    label: 'Pedido recebido',
    when: 'Quando o pedido entra na fila: pago online ou para pagar na retirada.',
    defaultOn: true,
    body: [
      'Olá, {{cliente}}! 😃 *Recebemos o seu pedido nº {{numero}}* na {{loja}}.',
      '',
      '🧾 *Itens:* {{itens}}',
      '💳 {{pagamento}}',
      '💰 *Total: {{total}}*',
      '',
      '🛍️ Retirada no balcão: {{previsao}}.',
      'Vou te avisando por aqui sobre o andamento. 😉',
    ].join('\n'),
    button: null,
  },
  {
    kind: 'preparing',
    name: TEMPLATES.ORDER_PREPARING,
    label: 'Em preparo',
    when: 'Quando a cozinha já fez parte do pedido (pedidos de um item só vão direto para "pronto").',
    defaultOn: true,
    body: [
      'Vim aqui te dizer que *já estamos preparando* o seu pedido nº {{numero}}! 👨‍🍳🔥',
      '',
      'Acompanhe o andamento pelo botão abaixo.',
    ].join('\n'),
    button: { text: 'Acompanhar pedido' },
  },
  {
    kind: 'ready',
    name: TEMPLATES.ORDER_READY,
    label: 'Pronto para retirar',
    when: 'Quando o último item fica pronto.',
    defaultOn: true,
    body: [
      'Oba, {{cliente}}! 🎉 Seu pedido nº {{numero}} está *pronto para retirar*! 🛍️',
      '',
      'Pode passar no balcão da {{loja}}. Estamos te esperando! 😋',
    ].join('\n'),
    button: null,
  },
  {
    kind: 'completed',
    name: TEMPLATES.ORDER_COMPLETED,
    label: 'Retirado',
    when: 'Quando o balcão entrega o pedido. Desligado de início: é mais uma mensagem cobrada.',
    defaultOn: false,
    body: [
      'Pedido nº {{numero}} retirado! ✅',
      '',
      'Obrigado pela preferência, {{cliente}}. Bom apetite! 😊',
    ].join('\n'),
    button: null,
  },
  {
    kind: 'cancelled',
    name: TEMPLATES.ORDER_CANCELLED,
    label: 'Cancelado',
    when: 'Quando um pedido já avisado como recebido é cancelado.',
    defaultOn: true,
    body: [
      'Olá, {{cliente}}. Seu pedido nº {{numero}} na {{loja}} foi *cancelado*. 😕',
      '',
      'Se ele já estava pago, o valor volta pela mesma forma de pagamento. Em caso de dúvida, fale com a loja.',
    ].join('\n'),
    button: null,
  },
]

/**
 * The reply to "Entrar pelo WhatsApp": free text (the customer just wrote
 * to us, so no template), confirming the sign-in on the menu.
 */
export function loginReply(storeName: string) {
  return `Pronto! ✅ Pode voltar ao cardápio da ${storeName}: seus pedidos já aparecem lá. 😉`
}

/**
 * How the authentication template reads (its text is Meta's, in pt_BR, with
 * the security line and the expiry footer): the panel's preview.
 */
export const LOGIN_CODE_PREVIEW = [
  '*123456* é seu código de verificação. Para sua segurança, não compartilhe este código.',
  '',
  `Este código expira em ${LOGIN_CODE_MINUTES} minutos.`,
].join('\n')

export type TemplateDefinition = {
  name: TemplateName
  category: 'UTILITY' | 'AUTHENTICATION'
  /** What it is for, in the panel. */
  label: string
  /** Body of POST /<WABA_ID>/message_templates. */
  create: (frontendUrl: string) => Record<string, unknown>
}

/** The named parameters a body uses, in order of appearance. */
export function bodyParams(body: string) {
  return [...new Set([...body.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]))]
}

/** A utility template with named parameters and, maybe, a link to the order. */
function noticeTemplate(notice: NoticeDefinition) {
  return (frontendUrl: string) => ({
    name: notice.name,
    language: TEMPLATE_LANGUAGE,
    category: 'UTILITY',
    parameter_format: 'named',
    components: [
      {
        type: 'BODY',
        text: notice.body,
        example: {
          body_text_named_params: bodyParams(notice.body).map((param) => ({
            param_name: param,
            example: EXAMPLE[param],
          })),
        },
      },
      ...(notice.button
        ? [
            {
              type: 'BUTTONS',
              buttons: [
                {
                  type: 'URL',
                  text: notice.button.text,
                  url: `${frontendUrl}/pedido/{{1}}`,
                  example: [`${frontendUrl}/pedido/6f1c2a8e-3b0d-4c55-9a51-2f0e7d1b9c42`],
                },
              ],
            },
          ]
        : []),
    ],
  })
}

export const TEMPLATE_DEFINITIONS: TemplateDefinition[] = [
  ...NOTICES.map((notice) => ({
    name: notice.name,
    category: 'UTILITY' as const,
    label: notice.label,
    create: noticeTemplate(notice),
  })),
  {
    name: TEMPLATES.LOGIN_CODE,
    category: 'AUTHENTICATION',
    label: 'Código de acesso',
    create: () => ({
      name: TEMPLATES.LOGIN_CODE,
      language: TEMPLATE_LANGUAGE,
      category: 'AUTHENTICATION',
      message_send_ttl_seconds: LOGIN_CODE_MINUTES * 60,
      components: [
        { type: 'BODY', add_security_recommendation: true },
        { type: 'FOOTER', code_expiration_minutes: LOGIN_CODE_MINUTES },
        {
          type: 'BUTTONS',
          buttons: [{ type: 'OTP', otp_type: 'COPY_CODE', text: 'Copiar código' }],
        },
      ],
    }),
  },
]

export function noticeOf(kind: NoticeKind) {
  return NOTICES.find((notice) => notice.kind === kind)!
}

/** The body with the examples in place: the panel's preview. */
export function previewOf(notice: NoticeDefinition) {
  return notice.body.replace(/\{\{(\w+)\}\}/g, (_, param: string) => EXAMPLE[param] ?? param)
}

/**
 * A parameter value as templates accept it: no line breaks or tabs, no more
 * than four spaces in a row, never empty.
 */
export function templateText(value: string, max = 60) {
  const clean = value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim()
  const cut = clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean
  return cut || '-'
}

/** `components` of a send: named body parameters and the URL button's suffix. */
export function templateComponents(params: Record<string, string>, urlSuffix?: string) {
  const components: Record<string, unknown>[] = []
  const entries = Object.entries(params)
  if (entries.length > 0) {
    components.push({
      type: 'body',
      parameters: entries.map(([name, text]) => ({ type: 'text', parameter_name: name, text })),
    })
  }
  if (urlSuffix) {
    components.push({
      type: 'button',
      sub_type: 'url',
      index: '0',
      parameters: [{ type: 'text', text: urlSuffix }],
    })
  }
  return components
}

/** `components` of an authentication template: the code in the body and the copy button. */
export function codeComponents(code: string) {
  return [
    { type: 'body', parameters: [{ type: 'text', text: code }] },
    { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
  ]
}
