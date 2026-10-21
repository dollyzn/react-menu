import { exponentialBackoff } from '@adonisjs/queue'
import AppJob from '#jobs/app_job'
import type { JobOptions } from '@adonisjs/queue/types'
import mail from '@adonisjs/mail/services/main'
import type { MailersList } from '@adonisjs/mail/types'
import type { MessageBodyTemplates, NodeMailerMessage } from '@adonisjs/mail/types'

type Payload = {
  mailer: keyof MailersList
  mail: { message: NodeMailerMessage; views: MessageBodyTemplates }
  config?: unknown
}

/**
 * Sends a message queued with `mail.sendLater` (see start/mail.ts): the
 * request doesn't wait for SMTP, and a provider hiccup is retried.
 */
export default class SendEmail extends AppJob<Payload> {
  static options: JobOptions = {
    maxRetries: 5,
    retry: { backoff: exponentialBackoff({ baseDelay: '30s', maxDelay: '30m' }) },
  }

  async execute() {
    await mail.use(this.payload.mailer).sendCompiled(this.payload.mail, this.payload.config)
  }
}
