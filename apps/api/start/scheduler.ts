/*
|--------------------------------------------------------------------------
| Scheduler
|--------------------------------------------------------------------------
|
| This file is used to define scheduled jobs. You can schedule jobs to run
| at specific intervals using cron expressions or duration strings.
|
| Example:
|
|   import SendWeeklyReport from '#jobs/send_weekly_report'
|
|   SendWeeklyReport.schedule({ userId: 1 })
|     .cron('0 9 * * MON')
|     .run()
|
*/

import logger from '@adonisjs/core/services/logger'
import SendDailySummaries from '#jobs/send_daily_summaries'
import { BUSINESS_TIMEZONE } from '#services/order_service'

// The daily summary e-mail: every hour on the hour, for the people who chose
// that hour. The id keeps one schedule however many times the API starts.
await SendDailySummaries.schedule({})
  .id('daily-summaries')
  .cron('0 * * * *')
  .timezone(BUSINESS_TIMEZONE)
  .run()
  .catch((error) => logger.error({ err: error }, 'could not schedule the daily summaries'))
