import { test } from '@japa/runner'
import mail from '@adonisjs/mail/services/main'
import env from '#start/env'
import ResetPasswordNotification from '#mails/reset_password_notification'

test.group('Mail through Resend', (group) => {
  const realFetch = globalThis.fetch
  group.each.teardown(() => {
    globalThis.fetch = realFetch
  })

  test('the resend mailer posts our e-mail to the Resend API', async ({ assert }) => {
    let sent: {
      url: string
      method: string
      authorization: string | null
      body: Record<string, unknown>
    } | null = null
    globalThis.fetch = async (input, init) => {
      const request = input instanceof Request ? input : new Request(input, init)
      sent = {
        url: request.url,
        method: request.method,
        authorization: request.headers.get('authorization'),
        body: (await request.json()) as Record<string, unknown>,
      }
      return new Response(JSON.stringify({ id: 're_123' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    const response = await mail
      .use('resend')
      .send(
        new ResetPasswordNotification(
          { email: 'ana@example.com', name: 'Ana' },
          'https://menu/reset/abc'
        )
      )

    assert.equal(response.messageId, 're_123')
    assert.isNotNull(sent)
    const request = sent!
    assert.equal(request.url, 'https://api.resend.com/emails')
    assert.equal(request.method, 'POST')
    assert.equal(request.authorization, `Bearer ${env.get('RESEND_API_KEY')}`)
    assert.include(String(request.body.from), env.get('MAIL_FROM_ADDRESS', 'no-reply@example.com'))
    assert.deepEqual(request.body.to, ['ana@example.com'])
    assert.equal(request.body.subject, 'Redefina sua senha')
    assert.include(String(request.body.html), 'Escolher nova senha')
    assert.include(String(request.body.text), 'https://menu/reset/abc')
  })
})
