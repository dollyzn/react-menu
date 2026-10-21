const escape = (value: string) => value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)

type EmailContent = {
  /** Shown in the inbox preview, not in the body. */
  preview: string
  title: string
  paragraphs: string[]
  action?: { label: string; url: string }
  footer?: string
}

const BRAND = '#c46014'

/**
 * Transactional e-mail markup: one column, inline styles and tables only,
 * so Gmail, Outlook and phone clients render it the same. Text is escaped.
 */
export function emailHtml(content: EmailContent) {
  const paragraphs = content.paragraphs
    .map(
      (text) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3f3f46">${escape(text)}</p>`
    )
    .join('')
  const action = content.action
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td style="border-radius:999px;background:${BRAND}">
        <a href="${escape(content.action.url)}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px">${escape(content.action.label)}</a>
      </td></tr></table>
      <p style="margin:0 0 16px;font-size:12px;line-height:1.5;color:#71717a">Se o botão não funcionar, copie e cole este endereço no navegador:<br><a href="${escape(content.action.url)}" style="color:${BRAND};word-break:break-all">${escape(content.action.url)}</a></p>`
    : ''
  const footer = content.footer
    ? `<p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#a1a1aa">${escape(content.footer)}</p>`
    : ''

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(content.title)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden">${escape(content.preview)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;padding:32px">
<tr><td>
<p style="margin:0 0 24px;font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:${BRAND}">React Menu</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#18181b">${escape(content.title)}</h1>
${paragraphs}${action}${footer}
</td></tr></table>
</td></tr></table>
</body></html>`
}

/** Plain-text version of the same content (spam filters like having one). */
export function emailText(content: EmailContent) {
  return [
    content.title,
    '',
    ...content.paragraphs,
    ...(content.action ? ['', `${content.action.label}: ${content.action.url}`] : []),
    ...(content.footer ? ['', content.footer] : []),
  ].join('\n')
}
