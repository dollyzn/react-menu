import { DateTime } from 'luxon'
import encryption from '@adonisjs/core/services/encryption'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Store from '#models/store'
import { noticeOf, type NoticeKind } from '#whatsapp/templates'

const encrypt = (value: string | null) => (value ? encryption.encrypt(value) : null)
const decrypt = (value: string | null) =>
  value ? (encryption.decrypt<string>(value) ?? null) : null

/** One step of a coexistence sync: Meta's request id, or why it failed. */
export type AppSyncStep = { requestId: string | null; error: string | null; at: string }

/** Coexistence: contacts (`smb_app_state_sync`) then history, each once. */
export type AppSync = Partial<Record<'contacts' | 'history', AppSyncStep>>

/** What the last poll saw of one of our templates in the store's WABA. */
export type TemplateState = {
  id: string | null
  /** APPROVED, PENDING, REJECTED, PAUSED, DISABLED… (Meta's), or MISSING. */
  status: string
  category: string | null
  reason: string | null
}

/**
 * A store's WhatsApp number, connected through Embedded Signup of the
 * platform's Tech Provider app (ADR 0025). The store pays Meta for what it
 * sends; the business token never leaves the API.
 */
export default class WhatsAppAccount extends BaseModel {
  static table = 'whatsapp_accounts'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare storeId: string

  @column()
  declare wabaId: string

  @column()
  declare phoneNumberId: string

  @column()
  declare businessId: string | null

  /** As Meta formats it ("+55 11 98765-4321"). */
  @column()
  declare displayPhoneNumber: string

  @column()
  declare verifiedName: string | null

  @column({ serializeAs: null, prepare: encrypt, consume: decrypt })
  declare accessToken: string

  @column({ serializeAs: null, prepare: encrypt, consume: decrypt })
  declare registerPin: string | null

  @column()
  declare coexistence: boolean

  @column()
  declare notifyOrders: boolean

  @column()
  declare customerLogin: boolean

  @column({ prepare: (value: Record<string, TemplateState>) => JSON.stringify(value ?? {}) })
  declare templates: Record<string, TemplateState>

  @column({ prepare: (value: AppSync) => JSON.stringify(value ?? {}) })
  declare appSync: AppSync

  /** Coexistence: when Embedded Signup onboarded the app number (the sync's 24 hours start here). */
  @column.dateTime()
  declare appOnboardedAt: DateTime | null

  /** The store's choices per order notice that differ from the defaults. */
  @column({ prepare: (value: Partial<Record<NoticeKind, boolean>>) => JSON.stringify(value ?? {}) })
  declare notices: Partial<Record<NoticeKind, boolean>>

  @column.dateTime()
  declare templatesCheckedAt: DateTime | null

  @column.dateTime()
  declare webhookSubscribedAt: DateTime | null

  @column.dateTime()
  declare paymentIssueAt: DateTime | null

  @column.dateTime()
  declare brokenAt: DateTime | null

  @column()
  declare lastError: string | null

  @column()
  declare connectedById: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Store)
  declare store: BelongsTo<typeof Store>

  /** Messages can go out (the token works). */
  get isUsable() {
    return !this.brokenAt
  }

  /** The store sends this notice (its choice, else the notice's default). */
  noticeOn(kind: NoticeKind) {
    return this.notices?.[kind] ?? noticeOf(kind).defaultOn
  }

  templateApproved(name: string) {
    return this.templates?.[name]?.status === 'APPROVED'
  }

  /** wa.me digits of the number ("5511987654321"). */
  get waNumber() {
    return this.displayPhoneNumber.replace(/\D/g, '')
  }
}
