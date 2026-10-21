/**
 * `mail.sendLater` goes through our queue (SendEmail job) instead of the
 * package's in-memory messenger, which loses messages on restart.
 */
import mail from '@adonisjs/mail/services/main'
import type { MailersList } from '@adonisjs/mail/types'
import SendEmail from '#jobs/send_email'

mail.setMessenger((mailer) => ({
  async queue(message, config) {
    await SendEmail.dispatch({ mailer: mailer.name as keyof MailersList, mail: message, config })
  },
}))
