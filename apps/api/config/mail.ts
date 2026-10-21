import env from '#start/env'
import { defineConfig, transports } from '@adonisjs/mail'

/**
 * Transactional e-mail (password reset…), sent by the SendEmail job
 * (`mail.sendLater`, see start/mail.ts). Development uses Mailpit
 * (docker-compose.dev.yml, inbox at http://localhost:8025).
 */
const mailConfig = defineConfig({
  default: env.get('MAIL_MAILER', 'smtp'),

  from: {
    address: env.get('MAIL_FROM_ADDRESS', 'no-reply@example.com'),
    name: env.get('MAIL_FROM_NAME', 'React Menu'),
  },

  mailers: {
    smtp: transports.smtp({
      host: env.get('SMTP_HOST', 'localhost'),
      port: env.get('SMTP_PORT', 1025),
      secure: env.get('SMTP_SECURE', false),
      auth: env.get('SMTP_USERNAME')
        ? { type: 'login', user: env.get('SMTP_USERNAME')!, pass: env.get('SMTP_PASSWORD', '') }
        : undefined,
    }),
  },
})

export default mailConfig

declare module '@adonisjs/mail/types' {
  export interface MailersList extends InferMailers<typeof mailConfig> {}
}
