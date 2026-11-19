import type {
  AssistantModelChoice,
  AssistantModelPricing,
  AssistantProvider,
  AssistantTokens,
} from '@react-menu/contracts'

/**
 * Public list prices in US$ per million tokens, for the settings' cost
 * estimate only (the provider's bill is what counts). Matched by the start of
 * the model id, longest first; a store can set its own price per model.
 * Checked against Anthropic's, OpenAI's and Google's price pages on
 * 2026-11-19 (Standard tier; text up to 200k/272k tokens of context). Where a
 * launch discount runs, the price after it is used, so the estimate errs
 * high: Gemini 4 Argon/Carbon (until Nov 30, 2026) and Gemini 3.8/3.6 Flash
 * (until Dec 31, 2026). Retired models stay listed while stores still use them.
 */
const LIST_PRICES: Record<AssistantProvider, [prefix: string, AssistantModelPricing][]> = {
  anthropic: [
    ['claude-fable-5-2', { input: 8, cachedInput: 0.2, output: 40 }],
    ['claude-fable-5', { input: 10, cachedInput: 1, output: 50 }],
    ['claude-opus-5-5', { input: 4, cachedInput: 0.2, output: 20 }],
    ['claude-opus-5', { input: 5, cachedInput: 0.5, output: 25 }],
    ['claude-opus-4', { input: 5, cachedInput: 0.5, output: 25 }],
    ['claude-sonnet-5-5', { input: 2, cachedInput: 0.1, output: 10 }],
    ['claude-sonnet-5', { input: 2, cachedInput: 0.2, output: 10 }],
    ['claude-sonnet-4', { input: 3, cachedInput: 0.3, output: 15 }],
    ['claude-haiku-5-5', { input: 0.1, cachedInput: 0.01, output: 0.5 }],
    ['claude-haiku-4', { input: 1, cachedInput: 0.1, output: 5 }],
  ],
  openai: [
    ['gpt-6.2-astra', { input: 8, cachedInput: 0.4, output: 40 }],
    ['gpt-6.2-sol', { input: 2, cachedInput: 0.1, output: 10 }],
    ['gpt-6.1-sol', { input: 2, cachedInput: 0.1, output: 10 }],
    ['gpt-6.1-terra', { input: 1, cachedInput: 0.05, output: 5 }],
    ['gpt-6-astra', { input: 10, cachedInput: 1, output: 50 }],
    ['gpt-6-sol', { input: 2, cachedInput: 0.2, output: 10 }],
    ['gpt-6-luna', { input: 0.1, cachedInput: 0.01, output: 0.5 }],
    ['gpt-5.6-sol', { input: 4, cachedInput: 0.4, output: 20 }],
    ['gpt-5.6-terra', { input: 2, cachedInput: 0.2, output: 12 }],
    ['gpt-5.6-luna', { input: 0.2, cachedInput: 0.02, output: 1.2 }],
    ['gpt-5.5', { input: 5, cachedInput: 0.5, output: 30 }],
    ['gpt-5.4-mini', { input: 0.75, cachedInput: 0.075, output: 4.5 }],
    ['gpt-5.4-nano', { input: 0.2, cachedInput: 0.02, output: 1.25 }],
    ['gpt-5.4', { input: 2.5, cachedInput: 0.25, output: 15 }],
    ['gpt-5.2', { input: 1.75, cachedInput: 0.175, output: 14 }],
    ['gpt-5.1', { input: 1.25, cachedInput: 0.125, output: 10 }],
    // GPT-5, mini and nano shut down on Dec 11, 2026.
    ['gpt-5-nano', { input: 0.05, cachedInput: 0.005, output: 0.4 }],
    ['gpt-5-mini', { input: 0.25, cachedInput: 0.025, output: 2 }],
    ['gpt-5', { input: 1.25, cachedInput: 0.125, output: 10 }],
  ],
  google: [
    ['gemini-4-neon', { input: 3, cachedInput: 0.15, output: 15 }],
    ['gemini-4-argon', { input: 4, cachedInput: 0.2, output: 20 }],
    ['gemini-4-carbon', { input: 4, cachedInput: 0.2, output: 20 }],
    ['gemini-4-hydrogen', { input: 1.5, cachedInput: 0.075, output: 7.5 }],
    ['gemini-3.8-flash', { input: 1.5, cachedInput: 0.15, output: 7.5 }],
    ['gemini-3.6-flash', { input: 1.5, cachedInput: 0.15, output: 7.5 }],
    ['gemini-3.5-flash-lite', { input: 0.3, cachedInput: 0.03, output: 2.5 }],
    ['gemini-3.1-flash-lite', { input: 0.25, cachedInput: 0.025, output: 1.5 }],
    ['gemini-3.1-pro', { input: 2, cachedInput: 0.2, output: 12 }],
    ['gemini-3-flash', { input: 0.5, cachedInput: 0.05, output: 3 }],
    // 2.5 only for projects that already used it; Pro and Flash are rerouted on Dec 1, 2026.
    ['gemini-2.5-flash-lite', { input: 0.1, cachedInput: 0.01, output: 0.4 }],
    ['gemini-2.5-flash', { input: 0.3, cachedInput: 0.03, output: 2.5 }],
    ['gemini-2.5-pro', { input: 1.25, cachedInput: 0.125, output: 10 }],
  ],
}

/** The list price of a model, or null when unknown. */
export function listPrice(
  provider: AssistantProvider,
  model: string
): AssistantModelPricing | null {
  const match = [...LIST_PRICES[provider]]
    .sort((a, b) => b[0].length - a[0].length)
    .find(([prefix]) => model.startsWith(prefix))
  return match?.[1] ?? null
}

/** The price used for a store's model: its own, or the list price. */
export function priceOf(choice: Pick<AssistantModelChoice, 'provider' | 'model' | 'pricing'>) {
  if (choice.pricing) return { pricing: choice.pricing, custom: true }
  const pricing = listPrice(choice.provider, choice.model)
  return { pricing, custom: false }
}

/**
 * US$ for some tokens. Input counts cached input apart (cheaper); reasoning
 * is already inside the output.
 */
export function costOf(
  tokens: AssistantTokens,
  pricing: AssistantModelPricing,
  extra: { provider?: AssistantProvider; cacheWrite?: number } = {}
) {
  const fresh = Math.max(0, tokens.input - tokens.cachedInput)
  // Claude bills writing the cache (5 minutes) at 1.25× the input; the
  // written tokens are already in the input at 1×.
  const writes = extra.provider === 'anthropic' ? (extra.cacheWrite ?? 0) * 0.25 : 0
  return (
    ((fresh + writes) * pricing.input +
      tokens.cachedInput * pricing.cachedInput +
      tokens.output * pricing.output) /
    1_000_000
  )
}
