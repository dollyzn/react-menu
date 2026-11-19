import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { createProviderRegistry, type LanguageModel } from 'ai'
import type {
  AssistantEffort,
  AssistantModelChoice,
  AssistantModelOption,
  AssistantProvider,
} from '@react-menu/contracts'
import AppException from '#exceptions/app_exception'
import type Store from '#models/store'
import env from '#start/env'
import { fakeModel } from '#assistant/fake_model'

/** Development and e2e only: never in production. */
export const fakeModelEnabled = () =>
  env.get('NODE_ENV') !== 'production' && env.get('ASSISTANT_FAKE_MODEL') === true

type ProviderOptions = Record<string, Record<string, any>>

/** OpenAI lists every model of the account: only the ones that chat. */
const OPENAI_CHAT = /^(gpt-|o\d|chatgpt-)/
const OPENAI_NOT_CHAT =
  /(audio|realtime|tts|transcribe|image|search|embedding|instruct|moderation|codex)/
const GOOGLE_NOT_CHAT = /(embedding|tts|image|live|aqa|imagen|veo)/

type Listed = { id: string; name: string; created: number; contextWindow: number | null }

/** Claude models with adaptive thinking (4.6 and later): their reasoning shows as a summary. */
const ADAPTIVE_CLAUDE = /^claude-(opus|sonnet|haiku|fable|mythos)-(4-[6-9]|5)/
/** Gemini 2.x thinks by token budget; 3 and later by level. */
const GEMINI_2 = /^gemini-2\./
/** Claude models with server-side fallbacks for declined requests. */
const CLAUDE_FALLBACKS = /^claude-(opus-5|sonnet-5-5|fable|mythos)/

/** The model the scripted fake answers as (development and e2e). */
export const FAKE_MODEL: AssistantModelChoice = {
  id: 'fake:assistente-de-teste',
  provider: 'anthropic',
  model: 'assistente-de-teste',
  name: 'Assistente de teste',
  contextWindow: 200_000,
}

/**
 * The language models of a store: the providers it connected (Anthropic,
 * OpenAI, Google), each with the store's own key (set by its managers in the
 * panel and kept encrypted, like the Mercado Pago credentials), through the
 * AI SDK's provider registry. Injected so tests can swap it.
 */
export default class AssistantModels {
  enabled(store: Store) {
    return fakeModelEnabled() || store.assistantEnabled
  }

  /** The models the chat offers (the fake one alone in development without any). */
  choices(store: Store): { models: AssistantModelChoice[]; defaultModel: string | null } {
    const models = store.usableAssistantModels()
    if (!models.length && fakeModelEnabled())
      return { models: [FAKE_MODEL], defaultModel: FAKE_MODEL.id }
    const defaultModel =
      models.find((model) => model.id === store.assistantDefaultModel)?.id ?? models[0]?.id ?? null
    return { models, defaultModel }
  }

  /** The chosen model (or the default), or null when the store has none it can use. */
  resolve(store: Store, requested?: string | null) {
    const { models, defaultModel } = this.choices(store)
    const choice = models.find((model) => model.id === (requested ?? defaultModel))
    if (!choice) return null
    if (choice.id === FAKE_MODEL.id) return { choice, model: fakeModel() as LanguageModel }
    const keys = store.assistantKeys
    const registry = createProviderRegistry({
      ...(keys.anthropic && { anthropic: createAnthropic({ apiKey: keys.anthropic }) }),
      ...(keys.openai && { openai: createOpenAI({ apiKey: keys.openai }) }),
      ...(keys.google && { google: createGoogleGenerativeAI({ apiKey: keys.google }) }),
    })
    return {
      choice,
      model: registry.languageModel(`${choice.provider}:${choice.model}` as never) as LanguageModel,
    }
  }

  /**
   * The chat models a key can use, newest first, asked to the provider (for
   * the settings' model list). A refused key is a 422; the provider not
   * answering, a 502.
   */
  async listModels(provider: AssistantProvider, apiKey: string): Promise<AssistantModelOption[]> {
    // Development and e2e: "fake-…" keys connect without asking anyone.
    if (fakeModelEnabled() && apiKey.startsWith('fake-')) {
      return [
        { id: FAKE_MODEL.model, name: FAKE_MODEL.name, contextWindow: FAKE_MODEL.contextWindow },
      ]
    }
    const request = async (url: string, headers: Record<string, string> = {}) => {
      let response: Response
      try {
        response = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) })
      } catch {
        throw new AppException(
          'O provedor não respondeu. Tente de novo.',
          502,
          'E_ASSISTANT_PROVIDER'
        )
      }
      if (response.status === 401 || response.status === 403 || response.status === 400) {
        throw new AppException(
          'O provedor recusou a chave. Confira se ela está certa e ativa.',
          422,
          'E_ASSISTANT_KEY_INVALID'
        )
      }
      if (!response.ok) {
        throw new AppException(
          'O provedor não respondeu. Tente de novo.',
          502,
          'E_ASSISTANT_PROVIDER'
        )
      }
      return (await response.json()) as any
    }

    let listed: Listed[] = []
    if (provider === 'anthropic') {
      const body = await request('https://api.anthropic.com/v1/models?limit=100', {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      })
      listed = (body.data ?? []).map((model: any) => ({
        id: model.id,
        name: model.display_name ?? model.id,
        created: Date.parse(model.created_at ?? '') || 0,
        contextWindow: Number(model.max_input_tokens) || null,
      }))
    } else if (provider === 'openai') {
      const body = await request('https://api.openai.com/v1/models', {
        Authorization: `Bearer ${apiKey}`,
      })
      listed = (body.data ?? [])
        .filter((model: any) => OPENAI_CHAT.test(model.id) && !OPENAI_NOT_CHAT.test(model.id))
        .map((model: any) => ({
          id: model.id,
          name: model.id,
          created: (model.created ?? 0) * 1000,
          // OpenAI's list doesn't say.
          contextWindow: null,
        }))
    } else {
      // The key in a header: URLs end up in traces and logs.
      const body = await request(
        'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200',
        {
          'x-goog-api-key': apiKey,
        }
      )
      listed = (body.models ?? [])
        .filter(
          (model: any) =>
            String(model.name).startsWith('models/gemini') &&
            (model.supportedGenerationMethods ?? []).includes('generateContent') &&
            !GOOGLE_NOT_CHAT.test(model.name)
        )
        .map((model: any, index: number) => ({
          id: String(model.name).replace(/^models\//, ''),
          name: model.displayName ?? model.name,
          // Google lists no dates: keep its order.
          created: -index,
          contextWindow: Number(model.inputTokenLimit) || null,
        }))
    }
    return listed
      .sort((a, b) => b.created - a.created)
      .slice(0, 80)
      .map(({ id, name, contextWindow }) => ({ id, name, contextWindow }))
  }

  /** What each provider needs to show its reasoning and cache the conversation. */
  providerOptions(choice: AssistantModelChoice, effort: AssistantEffort): ProviderOptions {
    const provider = choice.provider
    const modelId = choice.model
    if (provider === 'anthropic') {
      return {
        anthropic: {
          sendReasoning: true,
          // The whole prefix (tools, instructions, earlier turns) is cached for the next call.
          cacheControl: { type: 'ephemeral' },
          ...(ADAPTIVE_CLAUDE.test(modelId) && {
            thinking: { type: 'adaptive', display: 'summarized' },
          }),
          // A declined request goes on in a fallback model instead of stopping.
          ...(CLAUDE_FALLBACKS.test(modelId) && { fallbacks: 'default' }),
        },
      }
    }
    if (provider === 'openai') return { openai: { reasoningSummary: 'auto' } }
    if (provider === 'google') {
      return {
        google: {
          // Gemini 2.5 takes a token budget (-1: it decides); 3 and later a level.
          thinkingConfig: GEMINI_2.test(modelId)
            ? { includeThoughts: true, thinkingBudget: effort === 'deep' ? -1 : 1024 }
            : { includeThoughts: true, thinkingLevel: effort === 'deep' ? 'high' : 'low' },
        },
      }
    }
    return {}
  }
}
