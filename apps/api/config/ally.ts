import env from '#start/env'
import { defineConfig, services } from '@adonisjs/ally'

const allyConfig = defineConfig({
  google: services.google({
    clientId: env.get('GOOGLE_CLIENT_ID', ''),
    clientSecret: env.get('GOOGLE_CLIENT_SECRET', ''),
    callbackUrl: env.get('GOOGLE_CALLBACK_URL', ''),

    scopes: ['userinfo.email', 'userinfo.profile'],
  }),
  twitter: services.twitter({
    clientId: env.get('TWITTER_CLIENT_ID', ''),
    clientSecret: env.get('TWITTER_CLIENT_SECRET', ''),
    callbackUrl: env.get('TWITTER_CALLBACK_URL', ''),
  }),
  facebook: services.facebook({
    clientId: env.get('FACEBOOK_CLIENT_ID', ''),
    clientSecret: env.get('FACEBOOK_CLIENT_SECRET', ''),
    callbackUrl: env.get('FACEBOOK_CALLBACK_URL', ''),

    scopes: ['email', 'public_profile'],
  }),
})

export default allyConfig

declare module '@adonisjs/ally/types' {
  interface SocialProviders extends InferSocialProviders<typeof allyConfig> {}
}
