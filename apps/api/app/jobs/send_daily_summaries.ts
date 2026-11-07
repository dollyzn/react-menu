import db from '@adonisjs/lucid/services/db'
import mail from '@adonisjs/mail/services/main'
import logger from '@adonisjs/core/services/logger'
import { DateTime } from 'luxon'
import type { JobOptions } from '@adonisjs/queue/types'
import AppJob from '#jobs/app_job'
import StoreRole from '#enums/store_role'
import { UserStatusEnum } from '#enums/user_status'
import NotificationPreference from '#models/notification_preference'
import User from '#models/user'
import ReportService from '#services/report_service'
import { BUSINESS_TIMEZONE } from '#services/order_service'
import DailySummaryMail, { type StoreSummary } from '#mails/daily_summary_mail'

/**
 * Every hour (scheduled in start/scheduler.ts): the daily summary e-mail
 * for the people whose hour has come and who haven't had today's yet, with
 * yesterday's numbers of each store they manage and didn't mute. An hour
 * missed (API down, a failed run) is caught up on the next run that day.
 */
export default class SendDailySummaries extends AppJob<Record<string, never>> {
  static options: JobOptions = { maxRetries: 2 }

  async execute() {
    await sendDailySummaries(DateTime.now().setZone(BUSINESS_TIMEZONE))
  }
}

/** The work, for a given moment (tests pass their own). */
export async function sendDailySummaries(now: DateTime) {
  const today = now.toISODate()!
  const yesterday = now.minus({ days: 1 }).toISODate()!
  const dateLabel = `ontem (${now.minus({ days: 1 }).toFormat('dd/MM')})`
  const due = await NotificationPreference.query()
    .where('dailySummary', true)
    .where('dailySummaryHour', '<=', now.hour)
    .where((query) =>
      query.whereNull('dailySummarySentOn').orWhere('dailySummarySentOn', '<', today)
    )
  if (due.length === 0) return 0

  const active = await User.query()
    .whereIn(
      'id',
      due.map((preference) => preference.userId)
    )
    .where('status', UserStatusEnum.ACTIVE)
  const users = new Map(active.map((user) => [user.id, user]))
  const reports = new ReportService()
  // A store's numbers are the same for each of its managers: once per run.
  const byStore = new Map<string, Promise<StoreSummary>>()
  const summarize = (store: { id: string; name: string }) => {
    let summary = byStore.get(store.id)
    if (!summary) {
      summary = storeSummary(reports, store, yesterday)
      byStore.set(store.id, summary)
    }
    return summary
  }

  let sent = 0
  for (const preference of due) {
    const user = users.get(preference.userId)
    if (!user) continue
    // One person's failure doesn't cost the others theirs.
    try {
      const stores = (await db
        .from('store_user as su')
        .join('stores as s', 's.id', 'su.store_id')
        .where({ 'su.user_id': user.id, 'su.role': StoreRole.MANAGER })
        .whereNull('su.disabled_at')
        .if(preference.mutedStoreIds.length, (query) =>
          query.whereNotIn('s.id', preference.mutedStoreIds)
        )
        .orderBy('s.name')
        .select('s.id', 's.name')) as { id: string; name: string }[]
      if (stores.length === 0) continue

      // One at a time: parallel queries on one connection trip pg (in a transaction).
      const summaries: StoreSummary[] = []
      for (const store of stores) summaries.push(await summarize(store))
      await mail.sendLater(
        new DailySummaryMail(
          { email: user.email, name: user.name },
          { dateLabel, stores: summaries }
        )
      )
      preference.dailySummarySentOn = DateTime.fromISO(today)
      await preference.save()
      sent++
    } catch (error) {
      byStore.clear()
      logger.error({ err: error, userId: user.id }, 'could not send a daily summary')
    }
  }
  if (sent) logger.info({ sent }, 'daily summaries queued')
  return sent
}

async function storeSummary(
  reports: ReportService,
  store: { id: string; name: string },
  day: string
): Promise<StoreSummary> {
  const report = await reports.sales(store.id, { from: day, to: day })
  const lowStock = await db
    .from('ingredients')
    .where('store_id', store.id)
    .where('min_stock', '>', 0)
    .whereRaw('stock_quantity <= min_stock')
    .orderBy('name')
    .limit(8)
    .select('name')
  return {
    storeId: store.id,
    storeName: store.name,
    revenue: report.summary.revenue,
    orders: report.summary.orders,
    averageTicket: report.summary.averageTicket,
    cancelled: report.summary.cancelled.orders,
    previousRevenue: report.summary.previous?.revenue ?? null,
    topItems: report.items
      .slice(0, 3)
      .map((item) => ({ name: item.name, quantity: item.quantity })),
    lowStock,
  }
}
