import app from '@adonisjs/core/services/app'
import logger from '@adonisjs/core/services/logger'
import { Job } from '@adonisjs/queue'

/**
 * Base of the app's jobs. When a job gives up after its last retry, the
 * failure is logged and the platform admins get a panel notification
 * (instead of only a log line nobody reads).
 */
export default abstract class AppJob<Payload> extends Job<Payload> {
  async failed(error: Error) {
    const job = this.constructor.name
    // No payload in the log: an e-mail's carries links such as password resets.
    logger.error({ err: error, job, jobId: this.context.jobId }, 'background job gave up')
    try {
      const { default: NotificationService } = await import('#services/notification_service')
      const notifications = await app.container.make(NotificationService)
      await notifications.notifySuperUsers('system.job_failed', {
        job,
        detail: error.message.slice(0, 200),
      })
    } catch (notifyError) {
      logger.error({ err: notifyError, job }, 'could not notify the job failure')
    }
  }
}
