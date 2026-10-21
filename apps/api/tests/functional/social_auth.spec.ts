import { test } from '@japa/runner'

test.group('Social login', () => {
  test('only providers configured on the server are offered', async ({ client }) => {
    // .env.test has no social credentials.
    const providers = await client.get('/api/v1/auth/social/providers')
    const redirect = await client.get('/api/v1/auth/social/google/redirect')
    const unknown = await client.get('/api/v1/auth/social/xgooglex/redirect')

    providers.assertStatus(200)
    providers.assertBodyContains({ data: { providers: [] } })
    redirect.assertStatus(404)
    redirect.assertBodyContains({ code: 'E_SOCIAL_PROVIDER_DISABLED' })
    unknown.assertStatus(404)
  })
})
