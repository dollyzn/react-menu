import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * `X-Hub-Signature-256: sha256=<hex>`: HMAC-SHA256 of the raw body with the
 * app secret. Re-serialized JSON would not match, so the raw body is used.
 */
export function isValidSignature(rawBody: string, header: string | undefined, appSecret: string) {
  if (!header?.startsWith('sha256=')) return false
  const given = Buffer.from(header.slice('sha256='.length), 'hex')
  const wanted = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest()
  return given.length === wanted.length && timingSafeEqual(given, wanted)
}

/** Signs a body as Meta does (tests and the e2e hook). */
export function signBody(rawBody: string, appSecret: string) {
  return `sha256=${createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex')}`
}

export type InboundMessage = {
  /** The sender's WhatsApp id (phone digits); missing for username-only users. */
  from?: string
  from_user_id?: string
  id: string
  timestamp: string
  type: string
  text?: { body?: string }
  button?: { text?: string; payload?: string }
}

export type StatusUpdate = {
  /** wamid of the message we sent. */
  id: string
  status: 'sent' | 'delivered' | 'read' | 'failed' | 'played' | string
  timestamp: string
  recipient_id?: string
  errors?: { code: number; title?: string; message?: string; error_data?: { details?: string } }[]
}

export type MessagesValue = {
  messaging_product?: 'whatsapp'
  metadata?: { display_phone_number?: string; phone_number_id?: string }
  contacts?: { wa_id?: string; user_id?: string; profile?: { name?: string } }[]
  messages?: InboundMessage[]
  statuses?: StatusUpdate[]
  errors?: { code: number; title?: string; message?: string }[]
}

/** POST body of a WhatsApp Business Account webhook (only `messages` reaches the override). */
export type WebhookPayload = {
  object?: string
  entry?: {
    /** The WABA id. */
    id?: string
    changes?: { field?: string; value?: MessagesValue }[]
  }[]
}
