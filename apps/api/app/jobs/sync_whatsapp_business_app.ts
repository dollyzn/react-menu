import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import { exponentialBackoff } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import { DateTime } from 'luxon'
import AppJob from '#jobs/app_job'
import WhatsAppAccount, { type AppSync } from '#models/whatsapp_account'
import WhatsAppClient, { WhatsAppApiError } from '#whatsapp/client'

type Payload = { accountId: string; generation?: number }

/** Meta's window to sync after a WhatsApp Business app onboarding. */
const DEADLINE_HOURS = 24

const STEPS = [
  { key: 'contacts', syncType: 'smb_app_state_sync' },
  { key: 'history', syncType: 'history' },
] as const

/**
 * Coexistence (ADR 0025): after a WhatsApp Business app number is
 * onboarded, Meta asks for its contacts and then its chat history to be
 * synced, each once, within 24 hours; otherwise the store must offboard and
 * connect again. Each step's request id (or Meta's refusal) is kept on the
 * account; only Meta not answering is retried.
 */
@inject()
export default class SyncWhatsAppBusinessApp extends AppJob<Payload> {
  static options: JobOptions = {
    maxRetries: 8,
    retry: { backoff: exponentialBackoff({ baseDelay: '30s', maxDelay: '30m' }) },
  }

  constructor(private client: WhatsAppClient) {
    super()
  }

  static async dispatchFor(account: WhatsAppAccount) {
    const generation = account.webhookSubscribedAt?.toMillis() ?? 0
    await SyncWhatsAppBusinessApp.dispatch({ accountId: account.id, generation }).dedup({
      id: `${account.id}:${generation}`,
      ttl: '1d',
    })
  }

  async execute() {
    const account = await WhatsAppAccount.find(this.payload.accountId)
    if (!account || !account.coexistence || !account.isUsable) return
    // Reconnected since: that onboarding has its own sync.
    const generation = account.webhookSubscribedAt?.toMillis() ?? 0
    if (this.payload.generation !== undefined && this.payload.generation !== generation) return

    const sync: AppSync = { ...account.appSync }
    const onboardedAt = account.webhookSubscribedAt ?? account.createdAt
    for (const step of STEPS) {
      // Done (even without a request id): Meta allows each step only once.
      const state = sync[step.key]
      if (state && !state.error) continue
      if (state?.error) break
      // History comes after contacts, as Meta orders them.
      if (step.key === 'history' && (!sync.contacts || sync.contacts.error)) break
      if (onboardedAt.plus({ hours: DEADLINE_HOURS }) < DateTime.now()) {
        sync[step.key] = {
          requestId: null,
          error: 'Passou o prazo de 24 horas da Meta: desconecte e conecte de novo.',
          at: DateTime.now().toISO()!,
        }
        break
      }
      try {
        const result = await this.client.syncAppData(
          account.accessToken,
          account.phoneNumberId,
          step.syncType
        )
        sync[step.key] = {
          requestId: result.request_id ?? null,
          error: null,
          at: DateTime.now().toISO()!,
        }
      } catch (error) {
        if (error instanceof WhatsAppApiError && error.transient) {
          account.appSync = sync
          await account.save()
          throw error
        }
        logger.warn(
          { err: error, storeId: account.storeId, step: step.key },
          'WhatsApp Business app sync refused'
        )
        sync[step.key] = {
          requestId: null,
          error: (error instanceof Error ? error.message : String(error)).slice(0, 300),
          at: DateTime.now().toISO()!,
        }
        break
      }
    }
    account.appSync = sync
    await account.save()
  }

  protected notifyFailureByEmail = false
}
