import { test } from '@japa/runner'
import env from '#start/env'

test.group('Social login', () => {
  test('only providers configured on the server are offered', async ({ client }) => {
    // .env.test has no social credentials.
    const providers = await client.get('/api/v1/auth/social/providers')
    const redirect = await client.get('/api/v1/auth/social/google/redirect').redirects(0)
    const unknown = await client.get('/api/v1/auth/social/xgooglex/redirect')

    providers.assertStatus(200)
    providers.assertBodyContains({ data: { providers: [] } })
    // The popup lands back on the app with the message instead of an API error.
    redirect.assertStatus(302)
    redirect.assertHeader(
      'location',
      `${env.get('FRONTEND_URL')}/app/social?error=${encodeURIComponent('Este login está indisponível agora.')}`
    )
    unknown.assertStatus(404)
  })
})
