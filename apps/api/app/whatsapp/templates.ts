/**
 * Our message templates, created in each store's WABA (ADR 0025). A changed
 * text is a new name (`_v2`): Meta reviews every template, and an approved
 * one keeps working while its replacement waits.
 */

export const TEMPLATES = {
  ORDER_RECEIVED: 'rm_pedido_recebido_v1',
  ORDER_READY: 'rm_pedido_pronto_v1',
  ORDER_CANCELLED: 'rm_pedido_cancelado_v1',
  LOGIN_CODE: 'rm_codigo_acesso_v1',
} as const
export type TemplateName = (typeof TEMPLATES)[keyof typeof TEMPLATES]

export const TEMPLATE_LANGUAGE = 'pt_BR'

/** Minutes a login code is valid (also printed by the template's footer). */
export const LOGIN_CODE_MINUTES = 10

export type TemplateDefinition = {
  name: TemplateName
  category: 'UTILITY' | 'AUTHENTICATION'
  /** What it is for, in the panel. */
  label: string
  /** Body of POST /<WABA_ID>/message_templates. */
  create: (frontendUrl: string) => Record<string, unknown>
}

const EXAMPLE = { cliente: 'Ana', numero: '42', loja: 'JJ Pastéis' }

/** A utility template with named parameters and a "track the order" link. */
function orderTemplate(name: TemplateName, text: string, button: string) {
  return (frontendUrl: string) => ({
    name,
    language: TEMPLATE_LANGUAGE,
    category: 'UTILITY',
    parameter_format: 'named',
    components: [
      {
        type: 'BODY',
        text,
        example: {
          body_text_named_params: Object.entries(EXAMPLE)
            .filter(([param]) => text.includes(`{{${param}}}`))
            .map(([param, example]) => ({ param_name: param, example })),
        },
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: button,
            url: `${frontendUrl}/pedido/{{1}}`,
            example: [`${frontendUrl}/pedido/6f1c2a8e-3b0d-4c55-9a51-2f0e7d1b9c42`],
          },
        ],
      },
    ],
  })
}

export const TEMPLATE_DEFINITIONS: TemplateDefinition[] = [
  {
    name: TEMPLATES.ORDER_RECEIVED,
    category: 'UTILITY',
    label: 'Pedido recebido',
    create: orderTemplate(
      TEMPLATES.ORDER_RECEIVED,
      'Olá, {{cliente}}! A {{loja}} recebeu seu pedido nº {{numero}}. Avisamos por aqui quando ele estiver pronto para retirar.',
      'Acompanhar pedido'
    ),
  },
  {
    name: TEMPLATES.ORDER_READY,
    category: 'UTILITY',
    label: 'Pedido pronto',
    create: orderTemplate(
      TEMPLATES.ORDER_READY,
      'Oba, {{cliente}}! Seu pedido nº {{numero}} está pronto. Pode retirar no balcão da {{loja}} quando quiser.',
      'Ver pedido'
    ),
  },
  {
    name: TEMPLATES.ORDER_CANCELLED,
    category: 'UTILITY',
    label: 'Pedido cancelado',
    create: orderTemplate(
      TEMPLATES.ORDER_CANCELLED,
      'Olá, {{cliente}}. Seu pedido nº {{numero}} na {{loja}} foi cancelado. Se ele já estava pago, o valor volta pela mesma forma de pagamento.',
      'Ver pedido'
    ),
  },
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

/**
 * A parameter value as templates accept it: no line breaks or tabs, no more
 * than four spaces in a row, never empty.
 */
export function templateText(value: string, max = 60) {
  const clean = value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim()
    .slice(0, max)
  return clean || '-'
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
