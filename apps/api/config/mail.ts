import env from '#start/env'
import { defineConfig, transports } from '@adonisjs/mail'

/**
 * Transactional e-mail (password reset…), sent by the SendEmail job
 * (`mail.sendLater`, see start/mail.ts). MAIL_MAILER picks the transport:
 * "smtp" (default; development uses Mailpit from docker-compose.dev.yml,
 * inbox at http://localhost:8025) or "resend" (Resend's HTTP API, with
 * RESEND_API_KEY; the from address must be on a domain verified there).
 */
if (env.get('MAIL_MAILER') === 'resend' && !env.get('RESEND_API_KEY')) {
  // Fail on boot instead of on every e-mail (the job would only retry).
  throw new Error('MAIL_MAILER=resend needs RESEND_API_KEY')
}

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
    resend: transports.resend({
      key: env.get('RESEND_API_KEY', ''),
      baseUrl: 'https://api.resend.com',
    }),
  },
})

export default mailConfig

declare module '@adonisjs/mail/types' {
  export interface MailersList extends InferMailers<typeof mailConfig> {}
}
