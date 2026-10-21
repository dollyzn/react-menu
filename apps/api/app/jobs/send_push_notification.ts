import { inject } from '@adonisjs/core'
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
}
