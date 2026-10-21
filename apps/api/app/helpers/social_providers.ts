import env from '#start/env'

export const SOCIAL_PROVIDERS = ['google', 'twitter', 'facebook'] as const
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number]

const PREFIX = { google: 'GOOGLE', twitter: 'TWITTER', facebook: 'FACEBOOK' } as const

/** Providers with credentials in the env; the login page only offers these. */
export function enabledSocialProviders(): SocialProvider[] {
  return SOCIAL_PROVIDERS.filter((provider) => {
    const prefix = PREFIX[provider]
    return (
      env.get(`${prefix}_CLIENT_ID`) &&
      env.get(`${prefix}_CLIENT_SECRET`) &&
      env.get(`${prefix}_CALLBACK_URL`)
    )
  })
}

export function isEnabledSocialProvider(value: string): value is SocialProvider {
  return (enabledSocialProviders() as string[]).includes(value)
}
