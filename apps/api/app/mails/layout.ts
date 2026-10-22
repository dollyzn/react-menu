import env from '#start/env'

const escape = (value: string) => value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)

/** Who the e-mail comes from: the store (name, logo, address) or the app. */
export type EmailBrand = {
  name: string
  logoUrl?: string | null
  address?: string | null
  phone?: string | null
}

export type EmailBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'button'; label: string; url: string }
  | { type: 'callout'; tone?: 'info' | 'success' | 'warning'; title?: string; text: string }
  /** Label/value rows in a soft panel (store, role, payment…). */
  | { type: 'details'; rows: [label: string, value: string][] }
  /** An order's lines (with add-ons and notes underneath) and its totals. */
  | {
      type: 'items'
      lines: { quantity: number; name: string; details?: string[]; amount: string }[]
      totals: { label: string; value: string; strong?: boolean }[]
    }

export type EmailContent = {
  /** Shown in the inbox preview, not in the body. */
  preview: string
  brand?: EmailBrand
  /** Small label above the title ("Pagamento confirmado"). */
  eyebrow?: string
  title: string
  /** A big highlighted value under the title (e.g. the order number). */
  highlight?: { label: string; value: string }
  blocks: EmailBlock[]
  footer?: string
}

/**
 * The panel's theme (apps/web/styles/globals.css, Tailwind "neutral" with
 * the orange primary) in hex: e-mail clients don't read oklch or variables.
 */
const LIGHT = {
  page: '#f5f5f5',
  card: '#ffffff',
  text: '#0a0a0a',
  muted: '#737373',
  panel: '#f5f5f5',
  line: '#e5e5e5',
}
const DARK = {
  page: '#0a0a0a',
  card: '#171717',
  text: '#fafafa',
  muted: '#a1a1a1',
  panel: '#262626',
  line: '#2e2e2e',
}
const PRIMARY = '#c46014'
/** Primary text on dark surfaces (the panel's chart-1, readable on #171717). */
const PRIMARY_ON_DARK = '#f88f4e'

const TONES = {
  info: { light: ['#fdf3ec', '#f6d3b8'], dark: ['#2a1a0e', '#5c3517'] },
  success: { light: ['#ecfdf5', '#a7f3d0'], dark: ['#062b1f', '#065f46'] },
  warning: { light: ['#fffbeb', '#fde68a'], dark: ['#2a2005', '#78350f'] },
} as const

/** The app itself (password reset), when there is no store to sign as. */
export function appBrand(): EmailBrand {
  return { name: env.get('MAIL_FROM_NAME') || 'React Menu' }
}

const font = `font-family:Geist,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`

/**
 * Dark mode: `prefers-color-scheme` (Apple Mail, iOS, Outlook for Mac,
 * Thunderbird, Samsung) and Outlook.com/apps' `[data-ogsc]`/`[data-ogsb]`.
 * Gmail apps invert colors on their own; the palette survives it.
 */
function darkCss() {
  const rules = (prefix: string) => `
${prefix}.em-page { background:${DARK.page} !important; }
${prefix}.em-card { background:${DARK.card} !important; border-color:${DARK.line} !important; }
${prefix}.em-panel { background:${DARK.panel} !important; }
${prefix}.em-text { color:${DARK.text} !important; }
${prefix}.em-muted { color:${DARK.muted} !important; }
${prefix}.em-line { border-color:${DARK.line} !important; }
${prefix}.em-primary { color:${PRIMARY_ON_DARK} !important; }
${Object.entries(TONES)
  .map(
    ([tone, colors]) =>
      `${prefix}.em-tone-${tone} { background:${colors.dark[0]} !important; border-color:${colors.dark[1]} !important; }`
  )
  .join('\n')}`
  return `@media (prefers-color-scheme: dark) {${rules('')}\n}
${rules('[data-ogsc] ')}
${rules('[data-ogsb] ')}`
}

function block(item: EmailBlock): string {
  switch (item.type) {
    case 'paragraph':
      return `<p class="em-text" style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${LIGHT.text}">${escape(item.text)}</p>`

    case 'button':
      return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 12px"><tr>
<td bgcolor="${PRIMARY}" style="border-radius:10px;background:${PRIMARY}">
<a href="${escape(item.url)}" style="display:inline-block;padding:12px 20px;${font};font-size:15px;font-weight:500;line-height:1;color:#ffffff;text-decoration:none;border-radius:10px">${escape(item.label)}</a>
</td></tr></table>
<p class="em-muted" style="margin:0 0 20px;font-size:12px;line-height:1.5;color:${LIGHT.muted}">Se o botão não abrir, copie este endereço no navegador:<br><a class="em-primary" href="${escape(item.url)}" style="color:${PRIMARY};word-break:break-all">${escape(item.url)}</a></p>`

    case 'callout': {
      const [background, border] = TONES[item.tone ?? 'info'].light
      const title = item.title
        ? `<p class="em-text" style="margin:0 0 2px;font-size:14px;font-weight:600;line-height:1.45;color:${LIGHT.text}">${escape(item.title)}</p>`
        : ''
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px"><tr>
<td class="em-tone-${item.tone ?? 'info'}" bgcolor="${background}" style="background:${background};border:1px solid ${border};border-radius:10px;padding:12px 16px">
${title}<p class="${item.title ? 'em-muted' : 'em-text'}" style="margin:0;font-size:14px;line-height:1.5;color:${item.title ? LIGHT.muted : LIGHT.text}">${escape(item.text)}</p>
</td></tr></table>`
    }

    case 'details': {
      const rows = item.rows
        .map(
          ([label, value], index) => `<tr>
<td class="em-muted em-line" style="padding:11px 16px;${index ? `border-top:1px solid ${LIGHT.line};` : ''}font-size:13px;color:${LIGHT.muted};vertical-align:top">${escape(label)}</td>
<td class="em-text em-line" align="right" style="padding:11px 16px;${index ? `border-top:1px solid ${LIGHT.line};` : ''}font-size:14px;font-weight:500;color:${LIGHT.text};vertical-align:top">${escape(value)}</td>
</tr>`
        )
        .join('')
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="em-line" style="margin:4px 0 20px;border:1px solid ${LIGHT.line};border-radius:12px;border-collapse:separate">${rows}</table>`
    }

    case 'items': {
      const lines = item.lines
        .map(
          (line, index) => `<tr>
<td class="em-text em-line" style="padding:12px 0;${index ? `border-top:1px solid ${LIGHT.line};` : ''}vertical-align:top;width:34px;font-size:15px;font-weight:700;color:${LIGHT.text}">${line.quantity}×</td>
<td class="em-line" style="padding:12px 8px 12px 0;${index ? `border-top:1px solid ${LIGHT.line};` : ''}vertical-align:top">
<p class="em-text" style="margin:0;font-size:15px;font-weight:500;line-height:1.4;color:${LIGHT.text}">${escape(line.name)}</p>
${(line.details ?? []).map((detail) => `<p class="em-muted" style="margin:2px 0 0;font-size:13px;line-height:1.45;color:${LIGHT.muted}">${escape(detail)}</p>`).join('')}
</td>
<td class="em-text em-line" align="right" style="padding:12px 0;${index ? `border-top:1px solid ${LIGHT.line};` : ''}vertical-align:top;font-size:14px;color:${LIGHT.text};white-space:nowrap">${escape(line.amount)}</td>
</tr>`
        )
        .join('')
      const totals = item.totals
        .map(
          (total, index) => `<tr>
<td colspan="2" class="${total.strong ? 'em-text' : 'em-muted'} em-line" style="padding:${index ? '6px' : '14px'} 0 0;${index ? '' : `border-top:1px solid ${LIGHT.line};`}font-size:${total.strong ? '15px' : '13px'};font-weight:${total.strong ? 600 : 400};color:${total.strong ? LIGHT.text : LIGHT.muted}">${escape(total.label)}</td>
<td class="${total.strong ? 'em-text' : 'em-muted'} em-line" align="right" style="padding:${index ? '6px' : '14px'} 0 0;${index ? '' : `border-top:1px solid ${LIGHT.line};`}font-size:${total.strong ? '20px' : '13px'};font-weight:${total.strong ? 700 : 400};letter-spacing:-.01em;color:${total.strong ? LIGHT.text : LIGHT.muted};white-space:nowrap">${escape(total.value)}</td>
</tr>`
        )
        .join('')
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px">${lines}${totals}</table>`
    }
  }
}

/** Store logo, or its initial on a tile (like the panel's avatars). */
function logo(brand: EmailBrand) {
  if (brand.logoUrl) {
    return `<img src="${escape(brand.logoUrl)}" width="32" height="32" alt="" style="display:block;width:32px;height:32px;border-radius:8px;object-fit:cover;background:#ffffff">`
  }
  return `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" width="32" height="32" style="width:32px;height:32px;border-radius:8px;background:rgba(255,255,255,.2);${font};font-size:15px;font-weight:700;color:#ffffff">${escape(brand.name.charAt(0).toUpperCase())}</td></tr></table>`
}

/**
 * Transactional e-mail markup, in the panel's visual language: the orange
 * header bar, bordered cards and lists, rounded-lg buttons, light and dark.
 * One column, inline styles and tables only (Gmail, Outlook, phones); the
 * classes only carry the dark overrides. Text is escaped.
 */
export function emailHtml(content: EmailContent) {
  const brand = content.brand ?? appBrand()
  const eyebrow = content.eyebrow
    ? `<p class="em-primary" style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:${PRIMARY}">${escape(content.eyebrow)}</p>`
    : ''
  const highlight = content.highlight
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px"><tr>
<td class="em-panel" bgcolor="${LIGHT.panel}" style="background:${LIGHT.panel};border-radius:14px;padding:18px 20px">
<p class="em-muted" style="margin:0;font-size:13px;font-weight:500;color:${LIGHT.muted}">${escape(content.highlight.label)}</p>
<p class="em-text" style="margin:4px 0 0;font-size:44px;line-height:1;font-weight:900;letter-spacing:-.03em;color:${LIGHT.text}">${escape(content.highlight.value)}</p>
</td></tr></table>`
    : ''
  const footer = [
    content.footer ? escape(content.footer) : null,
    [brand.name, brand.address, brand.phone]
      .filter(Boolean)
      .map((part) => escape(part!))
      .join(' · '),
  ]
    .filter(Boolean)
    .map(
      (text) =>
        `<p class="em-muted" style="margin:0 0 6px;font-size:12px;line-height:1.5;color:${LIGHT.muted}">${text}</p>`
    )
    .join('')

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<title>${escape(content.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;900&display=swap" rel="stylesheet">
<style>
:root { color-scheme: light dark; supported-color-schemes: light dark; }
${darkCss()}
@media (max-width: 560px) { .em-content { padding:24px 20px !important; } .em-header { padding:12px 20px !important; } }
</style></head>
<body class="em-page" style="margin:0;padding:0;background:${LIGHT.page};${font};-webkit-font-smoothing:antialiased">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${escape(content.preview)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="em-page" bgcolor="${LIGHT.page}" style="background:${LIGHT.page};padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="em-card" bgcolor="${LIGHT.card}" style="max-width:560px;background:${LIGHT.card};border:1px solid ${LIGHT.line};border-radius:14px;overflow:hidden;border-collapse:separate">
<tr><td class="em-header" bgcolor="${PRIMARY}" style="background:${PRIMARY};padding:12px 24px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="padding-right:10px;vertical-align:middle">${logo(brand)}</td>
<td style="vertical-align:middle;${font};font-size:15px;font-weight:600;color:#ffffff">${escape(brand.name)}</td>
</tr></table>
</td></tr>
<tr><td class="em-content" style="padding:28px 28px 24px;${font}">
${eyebrow}<h1 class="em-text" style="margin:0 0 20px;font-size:24px;line-height:1.25;font-weight:600;letter-spacing:-.02em;color:${LIGHT.text}">${escape(content.title)}</h1>
${highlight}${content.blocks.map(block).join('\n')}
</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px"><tr><td align="center" style="padding:20px 24px 0;${font}">${footer}</td></tr></table>
</td></tr></table>
</body></html>`
}

/** Plain-text version of the same content (spam filters like having one). */
export function emailText(content: EmailContent) {
  const lines: string[] = []
  if (content.eyebrow) lines.push(content.eyebrow.toUpperCase())
  lines.push(content.title, '')
  if (content.highlight) lines.push(`${content.highlight.label}: ${content.highlight.value}`, '')
  for (const item of content.blocks) {
    switch (item.type) {
      case 'paragraph':
        lines.push(item.text, '')
        break
      case 'button':
        lines.push(`${item.label}: ${item.url}`, '')
        break
      case 'callout':
        lines.push(item.title ? `${item.title}: ${item.text}` : item.text, '')
        break
      case 'details':
        lines.push(...item.rows.map(([label, value]) => `${label}: ${value}`), '')
        break
      case 'items':
        for (const line of item.lines) {
          lines.push(`${line.quantity}x ${line.name} — ${line.amount}`)
          lines.push(...(line.details ?? []).map((detail) => `   ${detail}`))
        }
        lines.push(...item.totals.map((total) => `${total.label}: ${total.value}`), '')
        break
    }
  }
  if (content.footer) lines.push(content.footer, '')
  const brand = content.brand ?? appBrand()
  lines.push([brand.name, brand.address, brand.phone].filter(Boolean).join(' · '))
  return lines.join('\n').trim()
}

/** Store data shown in the header and footer of the store's e-mails. */
export function storeBrand(store: {
  name: string
  photoUrl: string | null
  address: string | null
  phone: string | null
}): EmailBrand {
  return { name: store.name, logoUrl: store.photoUrl, address: store.address, phone: store.phone }
}

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export const formatMoney = (value: number) => money.format(value)
