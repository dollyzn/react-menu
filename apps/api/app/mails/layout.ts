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

const BRAND = '#c46014'
const BRAND_TINT = '#fdf1e7'
const TEXT = '#27272a'
const MUTED = '#71717a'
const SUBTLE = '#a1a1aa'
const LINE = '#ececec'
const PANEL = '#fafaf9'

const TONES = {
  info: { background: BRAND_TINT, accent: BRAND },
  success: { background: '#ecfdf3', accent: '#16a34a' },
  warning: { background: '#fffbeb', accent: '#d97706' },
} as const

/** The app itself (password reset), when there is no store to sign as. */
export function appBrand(): EmailBrand {
  return { name: env.get('MAIL_FROM_NAME') || 'React Menu' }
}

const font = `font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`

function block(item: EmailBlock): string {
  switch (item.type) {
    case 'paragraph':
      return `<p class="em-text" style="margin:0 0 16px;font-size:15px;line-height:1.65;color:${TEXT}">${escape(item.text)}</p>`

    case 'button':
      return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 12px"><tr>
<td bgcolor="${BRAND}" style="border-radius:12px;background:${BRAND}">
<a href="${escape(item.url)}" style="display:inline-block;padding:14px 28px;${font};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:12px">${escape(item.label)}</a>
</td></tr></table>
<p class="em-muted" style="margin:0 0 20px;font-size:12px;line-height:1.5;color:${MUTED}">Se o botão não abrir, copie este endereço no navegador:<br><a href="${escape(item.url)}" style="color:${BRAND};word-break:break-all">${escape(item.url)}</a></p>`

    case 'callout': {
      const tone = TONES[item.tone ?? 'info']
      const title = item.title
        ? `<p style="margin:0 0 4px;font-size:14px;font-weight:600;color:${TEXT}">${escape(item.title)}</p>`
        : ''
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px"><tr>
<td class="em-panel" bgcolor="${tone.background}" style="background:${tone.background};border-left:4px solid ${tone.accent};border-radius:12px;padding:14px 16px">
${title}<p class="em-text" style="margin:0;font-size:14px;line-height:1.55;color:${TEXT}">${escape(item.text)}</p>
</td></tr></table>`
    }

    case 'details': {
      const rows = item.rows
        .map(
          ([label, value], index) => `<tr>
<td class="em-muted em-line" style="padding:10px 0;${index ? `border-top:1px solid ${LINE};` : ''}font-size:13px;color:${MUTED};vertical-align:top;width:40%">${escape(label)}</td>
<td class="em-text em-line" align="right" style="padding:10px 0;${index ? `border-top:1px solid ${LINE};` : ''}font-size:14px;font-weight:600;color:${TEXT};vertical-align:top">${escape(value)}</td>
</tr>`
        )
        .join('')
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px"><tr>
<td class="em-panel" bgcolor="${PANEL}" style="background:${PANEL};border-radius:12px;padding:6px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
</td></tr></table>`
    }

    case 'items': {
      const lines = item.lines
        .map(
          (line) => `<tr>
<td class="em-line" style="padding:12px 0;border-bottom:1px solid ${LINE};vertical-align:top;width:36px;font-size:14px;font-weight:700;color:${BRAND}">${line.quantity}×</td>
<td class="em-line" style="padding:12px 8px 12px 0;border-bottom:1px solid ${LINE};vertical-align:top">
<p class="em-text" style="margin:0;font-size:14px;font-weight:600;color:${TEXT}">${escape(line.name)}</p>
${(line.details ?? []).map((detail) => `<p class="em-muted" style="margin:2px 0 0;font-size:12px;line-height:1.45;color:${MUTED}">${escape(detail)}</p>`).join('')}
</td>
<td class="em-text em-line" align="right" style="padding:12px 0;border-bottom:1px solid ${LINE};vertical-align:top;font-size:14px;color:${TEXT};white-space:nowrap">${escape(line.amount)}</td>
</tr>`
        )
        .join('')
      const totals = item.totals
        .map(
          (total) => `<tr>
<td colspan="2" class="${total.strong ? 'em-text' : 'em-muted'}" style="padding:${total.strong ? '12px' : '6px'} 0 0;font-size:${total.strong ? '16px' : '13px'};font-weight:${total.strong ? 700 : 400};color:${total.strong ? TEXT : MUTED}">${escape(total.label)}</td>
<td class="em-text" align="right" style="padding:${total.strong ? '12px' : '6px'} 0 0;font-size:${total.strong ? '18px' : '13px'};font-weight:${total.strong ? 700 : 400};color:${total.strong ? TEXT : MUTED};white-space:nowrap">${escape(total.value)}</td>
</tr>`
        )
        .join('')
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px">${lines}${totals}</table>`
    }
  }
}

/**
 * Transactional e-mail markup: one column, inline styles and tables only,
 * so Gmail, Outlook and phone clients render it the same (clients that
 * support it also get a dark version). Text is escaped.
 */
export function emailHtml(content: EmailContent) {
  const brand = content.brand ?? appBrand()
  const logo = brand.logoUrl
    ? `<td style="padding-right:12px;vertical-align:middle"><img src="${escape(brand.logoUrl)}" width="44" height="44" alt="" style="display:block;width:44px;height:44px;border-radius:12px;border:2px solid rgba(255,255,255,.35);object-fit:cover"></td>`
    : ''
  const eyebrow = content.eyebrow
    ? `<p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${BRAND}">${escape(content.eyebrow)}</p>`
    : ''
  const highlight = content.highlight
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px"><tr>
<td class="em-panel" bgcolor="${BRAND_TINT}" style="background:${BRAND_TINT};border-radius:14px;padding:12px 20px">
<p style="margin:0;font-size:12px;font-weight:600;color:${BRAND}">${escape(content.highlight.label)}</p>
<p style="margin:2px 0 0;font-size:30px;line-height:1.1;font-weight:800;color:${BRAND}">${escape(content.highlight.value)}</p>
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
        `<p style="margin:0 0 6px;font-size:12px;line-height:1.5;color:${SUBTLE}">${text}</p>`
    )
    .join('')

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<title>${escape(content.title)}</title>
<style>
@media (prefers-color-scheme: dark) {
  .em-body { background:#0c0a09 !important; }
  .em-card { background:#1c1917 !important; }
  .em-panel { background:#292524 !important; }
  .em-text, .em-title { color:#f5f5f4 !important; }
  .em-muted { color:#a8a29e !important; }
  .em-line { border-color:#3a3532 !important; }
}
@media (max-width: 560px) { .em-content { padding:24px 20px !important; } }
</style></head>
<body class="em-body" style="margin:0;padding:0;background:#f5f2ef;${font}">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${escape(content.preview)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="em-body" bgcolor="#f5f2ef" style="background:#f5f2ef;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="em-card" bgcolor="#ffffff" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06)">
<tr><td bgcolor="${BRAND}" style="background:${BRAND};padding:20px 32px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>${logo}
<td style="vertical-align:middle;font-size:18px;font-weight:700;color:#ffffff;${font}">${escape(brand.name)}</td>
</tr></table>
</td></tr>
<tr><td class="em-content" style="padding:32px;${font}">
${eyebrow}<h1 class="em-title" style="margin:0 0 20px;font-size:24px;line-height:1.25;font-weight:700;color:#18181b">${escape(content.title)}</h1>
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
