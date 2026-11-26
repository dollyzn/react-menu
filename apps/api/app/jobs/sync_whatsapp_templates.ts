import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import type { JobOptions } from '@adonisjs/queue/types'
import AppJob from '#jobs/app_job'
import WhatsAppAccount from '#models/whatsapp_account'
import WhatsAppAccountService from '#services/whatsapp_account_service'

/** `generation`: the connection it polls for (a reconnect starts a new chain). */
type Payload = { accountId: string; round?: number; generation?: number }

/** Every 15 minutes for about two days: Meta reviews within 24 hours. */
const EVERY = '15m'
const ROUNDS = 200

/**
 * Polls our templates' review in a store's WABA (ADR 0025): their status
 * webhook goes to the app's default callback, which isn't ours. Stops once
 * none is pending, after ~2 days, or when the store disconnects.
 */
@inject()
export default class SyncWhatsAppTemplates extends AppJob<Payload> {
  static options: JobOptions = { maxRetries: 2 }

  constructor(private accounts: WhatsAppAccountService) {
    super()
  }

  static async scheduleFor(account: WhatsAppAccount, round = 0) {
    const generation = account.webhookSubscribedAt?.toMillis() ?? 0
    await SyncWhatsAppTemplates.dispatch({ accountId: account.id, round, generation })
      .in(EVERY)
      .dedup({ id: `${account.id}:${generation}:${round}`, ttl: '1h' })
  }

  async execute() {
    const account = await WhatsAppAccount.find(this.payload.accountId)
    if (!account || !account.isUsable) return
    // Reconnected since: the new connection's own chain polls now.
    const generation = account.webhookSubscribedAt?.toMillis() ?? 0
    if (this.payload.generation !== undefined && this.payload.generation !== generation) return
    const round = this.payload.round ?? 0

    try {
      await this.accounts.syncTemplates(account, { create: true })
    } catch (error) {
      // Logged and tried again next round; a broken token stops it (isUsable).
      logger.warn({ err: error, storeId: account.storeId }, 'could not read the WhatsApp templates')
    }

    const waiting = Object.values(account.templates ?? {}).some(
      (template) => template.status === 'PENDING' || template.status === 'IN_APPEAL'
    )
    if ((waiting || !account.templatesCheckedAt) && round + 1 < ROUNDS) {
      await SyncWhatsAppTemplates.scheduleFor(account, round + 1)
    }
  }

  protected notifyFailureByEmail = false
}
