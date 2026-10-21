import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import { Job, exponentialBackoff } from '@adonisjs/queue'
import type { JobOptions } from '@adonisjs/queue/types'
import PushService, { type PushMessage } from '#services/push_service'

type Payload = { userId: string; message: PushMessage }

/** Web push for one user, off the request and retried when FCM hiccups. */
@inject()
export default class SendPushNotification extends Job<Payload> {
  static options: JobOptions = {
    maxRetries: 3,
    retry: { backoff: exponentialBackoff({ baseDelay: '10s', maxDelay: '2m' }) },
  }

  constructor(private push: PushService) {
    super()
  }

  async execute() {
    await this.push.sendToUser(this.payload.userId, this.payload.message)
  }

  /**
   * Only logged: a notification about a failed push would queue another
   * push, and an FCM outage would loop.
   */
  async failed(error: Error) {
    logger.error({ err: error, userId: this.payload.userId }, 'web push gave up')
  }
}
