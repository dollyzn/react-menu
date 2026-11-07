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
 * Every hour (scheduled in start/schedules.ts): the daily summary e-mail
 * for the people who chose this hour, with yesterday's numbers of each
 * store they manage and didn't mute. Never twice the same day.
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
    .where('dailySummaryHour', now.hour)
    .where((query) =>
      query.whereNull('dailySummarySentOn').orWhere('dailySummarySentOn', '<', today)
    )

  const reports = new ReportService()
  let sent = 0
  for (const preference of due) {
    const user = await User.find(preference.userId)
    if (!user || user.status !== UserStatusEnum.ACTIVE) continue
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

    const summaries: StoreSummary[] = []
    for (const store of stores) {
      const report = await reports.sales(store.id, { from: yesterday, to: yesterday })
      const lowStock = await db
        .from('ingredients')
        .where('store_id', store.id)
        .where('min_stock', '>', 0)
        .whereRaw('stock_quantity <= min_stock')
        .orderBy('name')
        .limit(8)
        .select('name')
      summaries.push({
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
      })
    }

    await mail.sendLater(
      new DailySummaryMail({ email: user.email, name: user.name }, { dateLabel, stores: summaries })
    )
    preference.dailySummarySentOn = DateTime.fromISO(today)
    await preference.save()
    sent++
  }
  if (sent) logger.info({ sent }, 'daily summaries queued')
  return sent
}
