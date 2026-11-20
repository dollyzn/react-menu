import { inject } from '@adonisjs/core'
import logger from '@adonisjs/core/services/logger'
import db from '@adonisjs/lucid/services/db'
import {
  APICallError,
  convertToModelMessages,
  createUIMessageStream,
  generateText,
  Output,
  stepCountIs,
  streamText,
  type LanguageModelUsage,
  type UIMessage,
} from 'ai'
import { DateTime } from 'luxon'
import { z } from 'zod'
import type {
  AssistantConversationDetail,
  AssistantConversationSummary,
  AssistantCostPeriod,
  AssistantCosts,
  AssistantEffort,
  AssistantMessageMetadata,
  AssistantProvider,
  AssistantSettings,
  AssistantSettingsInput,
  AssistantStatus,
  AssistantSuggestions,
  AssistantTokens,
  AssistantUsage as Usage,
} from '@react-menu/contracts'
import AppException from '#exceptions/app_exception'
import AssistantConversation from '#models/assistant_conversation'
import AssistantUsage from '#models/assistant_usage'
import type Store from '#models/store'
import { BUSINESS_TIMEZONE } from '#services/order_service'
import env from '#start/env'
import AssistantModels from '#assistant/models'
import { contextBlock, suggestionsPrompt, SYSTEM_PROMPT } from '#assistant/prompt'
import { costOf, priceOf } from '#assistant/pricing'
import { buildTools, toolErrorMessage } from '#assistant/tools'
import type { ToolContext } from '#assistant/types'
import { IMAGE_TYPES, MAX_IMAGE_BYTES, MAX_IMAGES, MAX_TEXT } from '#validators/assistant'

/** How long a request may hold its conversation (a crashed one frees it after this). */
const BUSY_SECONDS = 180
const DEFAULT_DAILY_LIMIT = 200
const PROVIDERS: AssistantProvider[] = ['anthropic', 'openai', 'google']
/** Model calls per request: a question rarely needs more than three or four. */
const MAX_STEPS = 10

export const DENIED_REASON = 'A pessoa recusou a ação no painel; nada foi alterado.'
export const SKIPPED_REASON =
  'A pessoa não respondeu à aprovação e mandou outra mensagem; nada foi alterado.'

type ChatInput = {
  id: string
  effort?: AssistantEffort
  /** One of the store's models ("openai:gpt-6.2-sol"); the default when left out. */
  model?: string
  page?: string
  message: { id: string; role: 'user' | 'assistant'; parts: unknown[] }
}

type Part = Record<string, any>
/** The context block of a person's message (who, where, when) is kept in its metadata. */
type Metadata = { context?: string }

const invalid = (message: string) => new AppException(message, 422, 'E_ASSISTANT_INVALID_MESSAGE')

/** The person's message for the history: text and up to four photos (data URLs). */
function readUserMessage(message: ChatInput['message'], context: string): UIMessage {
  const parts = message.parts as Part[]
  const text = parts
    .filter((part) => part?.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text as string)
    .join('\n')
    .trim()
  if (text.length > MAX_TEXT) throw invalid(`Mensagem longa demais (até ${MAX_TEXT} caracteres).`)

  const files = parts.filter((part) => part?.type === 'file')
  if (files.length > MAX_IMAGES) throw invalid(`Envie até ${MAX_IMAGES} fotos por mensagem.`)
  const images = files.map((file) => {
    const mediaType = String(file.mediaType ?? '') as (typeof IMAGE_TYPES)[number]
    const prefix = `data:${mediaType};base64,`
    const url = typeof file.url === 'string' ? file.url : ''
    if (!IMAGE_TYPES.includes(mediaType) || !url.startsWith(prefix)) {
      throw invalid('Só dá para enviar fotos (JPG, PNG, WebP ou GIF).')
    }
    const data = url.slice(prefix.length)
    if (!/^[A-Za-z0-9+/]+=*$/.test(data) || (data.length * 3) / 4 > MAX_IMAGE_BYTES) {
      throw invalid('A foto é grande demais ou está corrompida.')
    }
    return {
      type: 'file' as const,
      mediaType,
      url,
      ...(typeof file.filename === 'string' ? { filename: file.filename.slice(0, 120) } : {}),
    }
  })
  if (!text && !images.length) throw invalid('Escreva uma mensagem.')

  return {
    id: message.id,
    role: 'user',
    metadata: { context } satisfies Metadata,
    parts: [...(text ? [{ type: 'text' as const, text }] : []), ...images],
  }
}

/** The person's answers to the writes that waited: approval id → approved. */
function readApprovals(message: ChatInput['message']) {
  const answers = new Map<string, boolean>()
  for (const part of message.parts as Part[]) {
    const approval = part?.approval
    if (
      typeof part?.type === 'string' &&
      part.type.startsWith('tool-') &&
      typeof approval?.id === 'string' &&
      typeof approval?.approved === 'boolean'
    ) {
      answers.set(approval.id, approval.approved)
    }
  }
  return answers
}

/**
 * Applies answers to the tool parts still waiting for one (`answer` gives
 * true/false, or null to decline one left unanswered). Returns how many changed.
 */
function answerApprovals(
  messages: UIMessage[],
  answer: (approvalId: string) => boolean | null | undefined
) {
  let changed = 0
  for (const message of messages) {
    if (message.role !== 'assistant') continue
    message.parts = message.parts.map((part: Part) => {
      if (part.state !== 'approval-requested' || !part.approval?.id) return part
      const approved = answer(part.approval.id)
      if (approved === undefined) return part
      changed++
      if (approved === null) {
        return {
          ...part,
          state: 'output-denied',
          approval: { id: part.approval.id, approved: false, reason: SKIPPED_REASON },
        }
      }
      return {
        ...part,
        state: 'approval-responded',
        approval: {
          id: part.approval.id,
          approved,
          ...(approved ? {} : { reason: DENIED_REASON }),
        },
      }
    }) as UIMessage['parts']
  }
  return changed
}

/** An assistant message with something in it (a failed request leaves only `step-start`). */
const hasContent = (message: UIMessage) =>
  message.role !== 'assistant' || message.parts.some((part) => part.type !== 'step-start')

/**
 * What the model reads: each person's message starts with its context
 * block, and replies cut off (the panel closed, "Parar", a failed call) go
 * as plain text. Their reasoning and the provider's item ids stay out:
 * OpenAI refuses a whole conversation with a reasoning item whose answer
 * never came, and every later message would fail.
 */
function forModel(messages: UIMessage[]): UIMessage[] {
  return messages.filter(hasContent).map((message) => {
    if (message.role === 'user') {
      const context = (message.metadata as Metadata | undefined)?.context
      return context
        ? { ...message, parts: [{ type: 'text', text: context }, ...message.parts] }
        : message
    }
    const cut = (message.parts as Part[]).some((part) => part.state === 'streaming')
    if (!cut) return message
    return {
      ...message,
      parts: (message.parts as Part[])
        .filter((part) => part.type !== 'reasoning')
        .map(({ providerMetadata: _meta, callProviderMetadata: _call, ...part }) => part),
    } as UIMessage
  })
}

/** The data part a write's approval card was drawn from (its preview and what it read). */
function approvalData(messages: UIMessage[], toolCallId: string) {
  for (const message of messages) {
    for (const part of message.parts as Part[]) {
      if (part.type === 'data-approval' && part.id === toolCallId) return part.data
    }
  }
  return null
}

/** The AI SDK's usage as the panel shows it. */
function tokensOf(usage: LanguageModelUsage): AssistantTokens {
  return {
    input: usage.inputTokens ?? 0,
    output: usage.outputTokens ?? 0,
    reasoning: usage.outputTokenDetails?.reasoningTokens ?? 0,
    cachedInput: usage.inputTokenDetails?.cacheReadTokens ?? 0,
  }
}

type Lease = { until: Date }

/** A message with a write that was approved (applied, or tried). */
function changedData(message: UIMessage) {
  return message.parts.some(
    (part: any) => part.type?.startsWith('tool-') && part.approval?.approved === true
  )
}

function addTokens(a: AssistantTokens | undefined, b: AssistantTokens): AssistantTokens {
  if (!a) return b
  return {
    input: a.input + b.input,
    output: a.output + b.output,
    reasoning: a.reasoning + b.reasoning,
    cachedInput: a.cachedInput + b.cachedInput,
  }
}

/**
 * What to log of an error: never the whole AI SDK error, whose request body
 * holds the conversation (customers, notes, photos in base64).
 */
function errorSummary(error: unknown) {
  if (!(error instanceof Error)) return { message: String(error) }
  const fields = error as Error & { statusCode?: number; url?: string }
  return {
    name: error.name,
    message: error.message,
    statusCode: fields.statusCode,
    url: fields.url,
  }
}

/**
 * A follow-up as the panel shows it: without list markers ("1. ", "- ") or
 * quotes around it; a question starting with a number keeps it.
 */
export function cleanSuggestion(text: string) {
  return text
    .trim()
    .replace(/^(?:\d+[.)]|[-•*])\s+/, '')
    .replace(/^["“'”]+|["”'“]+$/g, '')
    .trim()
}

/** Friendly text for what went wrong (never the provider's raw error). */
function failureText(error: unknown) {
  const known = toolErrorMessage(error)
  if (known) return known
  if (APICallError.isInstance(error)) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return 'A chave da API do assistente foi recusada. Um gerente pode trocá-la em Configurações da loja.'
    }
    if (error.statusCode === 400) {
      return 'O provedor recusou esta conversa. Tente de novo; se continuar, comece uma conversa nova (ícone de lápis).'
    }
    if (error.statusCode === 404) {
      return 'O modelo configurado não foi encontrado no provedor. Confira o nome em Configurações da loja.'
    }
    if (error.statusCode === 429) {
      return 'O provedor do assistente está limitando os pedidos (ou os créditos acabaram). Tente de novo em instantes.'
    }
    if ((error.statusCode ?? 0) >= 500) {
      return 'O provedor do assistente está fora do ar por um momento. Tente de novo daqui a pouco.'
    }
  }
  return 'Algo deu errado ao gerar a resposta. Tente de novo.'
}

/**
 * The store assistant: the store's model settings, conversations (one
 * person's, in one store), the daily limit per store, and each chat request
 * streamed as AI SDK UI chunks (`streamText` with the store's model).
 */
@inject()
export default class AssistantService {
  constructor(private models: AssistantModels) {}

  async status(store: Store): Promise<AssistantStatus> {
    const { models, defaultModel } = this.models.choices(store)
    return {
      enabled: this.models.enabled(store),
      models,
      defaultModel,
      usage: await this.usage(store.id),
    }
  }

  /** The store's setup as the settings show it (never the keys). */
  settings(store: Store): AssistantSettings {
    return {
      enabled: store.assistantEnabled,
      providers: store.assistantProviders,
      models: store.assistantModels ?? [],
      defaultModel: store.assistantDefaultModel,
    }
  }

  /**
   * Managers connect providers (keys), choose the models of the chat and the
   * default one. Removing a key removes its models; the default always is
   * one of the models (the first when it isn't).
   */
  async updateSettings(store: Store, data: AssistantSettingsInput) {
    const keys = { ...store.assistantKeys }
    for (const [provider, key] of Object.entries(data.keys ?? {}) as [
      AssistantProvider,
      string | null,
    ][]) {
      if (key) keys[provider] = key
      else delete keys[provider]
    }
    const sent = data.models?.map((model) => ({ ...model, id: `${model.provider}:${model.model}` }))
    let models = sent ?? store.assistantModels ?? []
    // A model only counts with its provider's key.
    models = models.filter((model) => keys[model.provider])
    if (sent?.some((model) => !keys[model.provider])) {
      throw new AppException(
        'Conecte o provedor (cole a chave) antes de escolher os modelos dele.',
        422,
        'E_ASSISTANT_KEY_REQUIRED'
      )
    }
    const wanted = data.defaultModel === undefined ? store.assistantDefaultModel : data.defaultModel
    const defaultModel = models.find((model) => model.id === wanted)?.id ?? models[0]?.id ?? null
    store.merge({
      assistantKeys: keys,
      assistantModels: models,
      assistantDefaultModel: defaultModel,
    })
    await store.save()
    return this.settings(store)
  }

  /** The models of the key typed in the settings, or of the saved one. */
  async availableModels(store: Store, input: { provider: AssistantProvider; apiKey?: string }) {
    const apiKey = input.apiKey || store.assistantKeys[input.provider]
    if (!apiKey) {
      throw new AppException(
        'Cole a chave para ver os modelos da conta.',
        422,
        'E_ASSISTANT_KEY_REQUIRED'
      )
    }
    return await this.models.listModels(input.provider, apiKey)
  }

  /**
   * Estimated US$ today and this month, per model, from the tokens recorded
   * and each model's price (the store's own, or the list price).
   */
  async costs(store: Store): Promise<AssistantCosts> {
    const now = DateTime.now().setZone(BUSINESS_TIMEZONE)
    const offered = new Map((store.assistantModels ?? []).map((model) => [model.id, model]))
    const period = async (since: DateTime): Promise<AssistantCostPeriod> => {
      const rows = await db
        .from('assistant_usages')
        .where('store_id', store.id)
        .where('created_at', '>=', since.toUTC().toISO()!)
        .select('model', db.raw('count(*) filter (where question) as requests'))
        .sum('input_tokens as input')
        .sum('output_tokens as output')
        .sum('reasoning_tokens as reasoning')
        .sum('cache_read_tokens as cached')
        .sum('cache_write_tokens as written')
        .groupBy('model')
        .orderBy('model')
      let total = 0
      let partial = false
      const models = rows.map((row) => {
        const tokens = {
          input: Number(row.input ?? 0),
          output: Number(row.output ?? 0),
          reasoning: Number(row.reasoning ?? 0),
          cachedInput: Number(row.cached ?? 0),
        }
        const [provider, ...rest] = String(row.model).split(':')
        const choice = offered.get(row.model) ?? {
          provider: provider as AssistantProvider,
          model: rest.join(':'),
          pricing: null,
        }
        const { pricing } = PROVIDERS.includes(choice.provider)
          ? priceOf(choice)
          : { pricing: null }
        const cost = pricing
          ? costOf(tokens, pricing, {
              provider: choice.provider,
              cacheWrite: Number(row.written ?? 0),
            })
          : null
        if (cost === null) partial ||= tokens.input + tokens.output > 0
        else total += cost
        return { id: row.model as string, requests: Number(row.requests), tokens, cost }
      })
      return { total, partial, models }
    }
    // One after the other: inside a transaction they share one connection.
    const today = await period(now.startOf('day'))
    const month = await period(now.startOf('month'))
    return {
      today,
      month,
      prices: [...offered.values()].map((model) => ({ id: model.id, ...priceOf(model) })),
    }
  }

  /** Requests and tokens of the store today (business day). */
  async usage(storeId: string): Promise<Usage> {
    const since = DateTime.now().setZone(BUSINESS_TIMEZONE).startOf('day').toUTC().toISO()!
    const [row] = await db
      .from('assistant_usages')
      .where('store_id', storeId)
      .where('created_at', '>=', since)
      .select(db.raw('count(*) filter (where question) as used'))
      .sum('input_tokens as input')
      .sum('output_tokens as output')
      .sum('reasoning_tokens as reasoning')
      .sum('cache_read_tokens as cached')
    return {
      used: Number(row.used),
      limit: env.get('ASSISTANT_DAILY_LIMIT') ?? DEFAULT_DAILY_LIMIT,
      tokens: {
        input: Number(row.input ?? 0),
        output: Number(row.output ?? 0),
        reasoning: Number(row.reasoning ?? 0),
        cachedInput: Number(row.cached ?? 0),
      },
    }
  }

  async list(ctx: ToolContext): Promise<AssistantConversationSummary[]> {
    const rows = await AssistantConversation.query()
      .where({ storeId: ctx.store.id, userId: ctx.user.id })
      .whereNotNull('title')
      .orderBy('updatedAt', 'desc')
      .limit(30)
      .select('id', 'title', 'updatedAt')
    return rows.map((row) => ({ id: row.id, title: row.title, updatedAt: row.updatedAt.toISO()! }))
  }

  async find(ctx: ToolContext, id: string): Promise<AssistantConversationDetail> {
    const row = await this.#own(ctx, id)
    return {
      id: row.id,
      title: row.title,
      updatedAt: row.updatedAt.toISO()!,
      messages: row.uiMessages,
    }
  }

  async remove(ctx: ToolContext, id: string) {
    const row = await this.#own(ctx, id)
    await row.delete()
  }

  /** Another person's or another store's conversation doesn't exist for you. */
  async #own(ctx: ToolContext, id: string) {
    const row = await AssistantConversation.query()
      .where({ id, storeId: ctx.store.id, userId: ctx.user.id })
      .first()
    if (!row) throw new AppException('Conversa não encontrada.', 404, 'E_NOT_FOUND')
    return row
  }

  /**
   * Three next questions for the conversation's last answer, from the same
   * model (a short call of its own). Nothing while a change waits for
   * approval (the card is the next step). Not a question: outside the daily
   * limit, but its tokens count in the cost.
   */
  async suggestions(
    ctx: ToolContext,
    id: string,
    model: string | undefined
  ): Promise<AssistantSuggestions> {
    const conversation = await this.#own(ctx, id)
    const last = conversation.uiMessages.at(-1)
    const none = { messageId: last?.id ?? null, suggestions: [] }
    if (!last || last.role !== 'assistant') return none
    const waiting = last.parts.some(
      (part: any) => part.type?.startsWith('tool-') && part.state === 'approval-requested'
    )
    if (waiting) return none
    // Asked once per answer: kept in its metadata, so repeating the request costs nothing.
    const kept = (last.metadata as AssistantMessageMetadata | undefined)?.suggestions
    if (Array.isArray(kept)) return { messageId: last.id, suggestions: kept }
    const resolved = this.models.resolve(ctx.store, model)
    if (!resolved) return none

    // The last turns as plain text: what was asked, what the tools read, what was said.
    const transcript = conversation.uiMessages
      .slice(-6)
      .map((message) => {
        const text = message.parts
          .map((part: any) =>
            part.type === 'text'
              ? part.text
              : part.type?.startsWith('tool-')
                ? `[ferramenta ${part.type.slice(5)}]`
                : ''
          )
          .filter(Boolean)
          .join(' ')
          .slice(0, 1500)
        return `${message.role === 'user' ? 'Pessoa' : 'Assistente'}: ${text}`
      })
      .join('\n\n')
    try {
      const result = await generateText({
        model: resolved.model,
        system: suggestionsPrompt(ctx.role),
        prompt: transcript,
        output: Output.object({
          // No length limits in the schema (not every provider takes them): trimmed below.
          schema: z.object({ suggestions: z.array(z.string()) }),
        }),
        // A short list: no thinking, so the tokens go to the answer.
        reasoning: 'none',
        maxOutputTokens: 4000,
        abortSignal: AbortSignal.timeout(20_000),
      })
      const total = tokensOf(result.totalUsage)
      await AssistantUsage.create({
        storeId: ctx.store.id,
        userId: ctx.user.id,
        conversationId: conversation.id,
        model: resolved.choice.id,
        question: false,
        inputTokens: total.input,
        outputTokens: total.output,
        reasoningTokens: total.reasoning,
        cacheReadTokens: total.cachedInput,
        cacheWriteTokens: result.totalUsage.inputTokenDetails?.cacheWriteTokens ?? 0,
      })
      const suggestions = result.output.suggestions
        .map(cleanSuggestion)
        .filter((text) => text.length > 0 && text.length <= 90)
        .slice(0, 3)
      await this.#keepSuggestions(conversation.id, last.id, suggestions)
      return { messageId: last.id, suggestions }
    } catch (error) {
      // Extra, never in the way: the panel keeps its own suggestions (and
      // this answer isn't asked again).
      logger.warn({ err: errorSummary(error) }, 'assistant: suggestions failed')
      await this.#keepSuggestions(conversation.id, last.id, [])
      return none
    }
  }

  /**
   * Keeps the follow-ups in the answer's metadata, unless a new request took
   * the conversation meanwhile (its own save would overwrite them anyway).
   */
  async #keepSuggestions(id: string, messageId: string, suggestions: string[]) {
    await db.transaction(async (trx) => {
      const row = await AssistantConversation.query({ client: trx })
        .where('id', id)
        .forUpdate()
        .first()
      if (!row || (row.busyUntil && row.busyUntil > DateTime.now())) return
      const last = row.uiMessages.at(-1)
      if (last?.id !== messageId) return
      last.metadata = { ...(last.metadata as object), suggestions }
      row.uiMessages = [...row.uiMessages]
      await row.useTransaction(trx).save()
    })
  }

  /**
   * One chat request. Checks the model and the limit, takes the
   * conversation (409 while another request of it runs), then streams; the
   * conversation is saved at the end and released, whatever happens.
   */
  async chat(ctx: ToolContext, input: ChatInput, signal: AbortSignal) {
    const resolved = this.models.resolve(ctx.store, input.model)
    if (!resolved && input.model && this.models.enabled(ctx.store)) {
      throw new AppException(
        'Esse modelo não está mais disponível na loja. Escolha outro.',
        422,
        'E_ASSISTANT_MODEL'
      )
    }
    if (!resolved) {
      throw new AppException(
        'O assistente ainda não foi configurado nesta loja. Um gerente pode ligá-lo em Configurações.',
        503,
        'E_ASSISTANT_DISABLED'
      )
    }
    const usage = await this.usage(ctx.store.id)
    // Only new questions count against the limit: an approval answers one.
    if (input.message.role === 'user' && usage.used >= usage.limit) {
      throw new AppException(
        `A loja usou as ${usage.limit} mensagens de hoje do assistente. Amanhã libera de novo.`,
        429,
        'E_ASSISTANT_LIMIT'
      )
    }

    const conversation = await this.#open(ctx, input)
    const lease = await this.#claim(conversation.id)
    if (!lease) {
      throw new AppException(
        'O assistente ainda está respondendo nesta conversa.',
        409,
        'E_ASSISTANT_BUSY'
      )
    }
    // Read again under the lease: the previous answer may have been saved
    // between the first read and the claim.
    await conversation.refresh()

    let usageRow: AssistantUsage | null = null
    let skipModel = false
    const messages = structuredClone(conversation.uiMessages)
    try {
      if (input.message.role === 'user') {
        const message = readUserMessage(input.message, contextBlock(ctx, input.page ?? null))
        // Writes left unanswered are declined by the next message.
        answerApprovals(messages, () => null)
        // The same message again ("Gerar de novo", or an edit): it replaces
        // itself and what came after it.
        const again = messages.findIndex((row) => row.id === message.id)
        if (again >= 0) {
          // Asking again would drop a change already made, and the model
          // would make it twice.
          if (messages.slice(again).some(changedData)) {
            throw new AppException(
              'Essa resposta já mudou dados da loja. Mande uma nova mensagem em vez de gerar de novo.',
              409,
              'E_ASSISTANT_CHANGED'
            )
          }
          messages.length = again
        }
        messages.push(message)
        const text = message.parts.find((part) => part.type === 'text')
        conversation.title ??= (text?.type === 'text' ? text.text : 'Foto do cardápio')
          .replace(/\s+/g, ' ')
          .slice(0, 80)
      } else {
        const last = messages.at(-1)
        const answers = readApprovals(input.message)
        // Only the last answer's writes, and only while they wait: a repeated
        // approval finds nothing to answer and runs nothing.
        const answered =
          last?.role === 'assistant' && last.id === input.message.id
            ? answerApprovals([last], (id) => answers.get(id))
            : 0
        skipModel = answered === 0
      }
      conversation.uiMessages = messages
      await conversation.save()
      // A repeated approval runs nothing and costs nothing.
      if (!skipModel)
        usageRow = await AssistantUsage.create({
          storeId: ctx.store.id,
          userId: ctx.user.id,
          conversationId: conversation.id,
          model: resolved.choice.id,
          question: input.message.role === 'user',
        })
    } catch (error) {
      await this.#release(conversation.id, lease)
      throw error
    }

    const effort = input.effort ?? 'fast'
    return createUIMessageStream({
      originalMessages: messages,
      execute: async ({ writer }) => {
        if (skipModel || !usageRow) {
          writer.write({ type: 'start' })
          writer.write({ type: 'finish' })
          return
        }
        const record = usageRow
        const spent = { input: 0, output: 0, reasoning: 0, cachedInput: 0, cacheWrite: 0 }
        const { tools, toolApproval } = buildTools(ctx, {
          show: (toolCallId, preview, state) => {
            writer.write({ type: 'data-approval', id: toolCallId, data: { ...preview, state } })
          },
          stateOf: (toolCallId) => approvalData(messages, toolCallId)?.state ?? null,
        })
        const result = streamText({
          model: resolved.model,
          system: SYSTEM_PROMPT,
          messages: await convertToModelMessages(forModel(messages), {
            tools,
            // A call cut off by a closed panel never ran: the model doesn't see it.
            ignoreIncompleteToolCalls: true,
          }),
          tools,
          toolApproval,
          stopWhen: stepCountIs(MAX_STEPS),
          maxOutputTokens: 16000,
          reasoning: effort === 'deep' ? 'high' : 'low',
          providerOptions: this.models.providerOptions(resolved.choice, effort),
          abortSignal: signal,
          // Each step's tokens as it ends, so a stopped answer keeps what it
          // already cost; the lease grows with the answer.
          onStepFinish: async (step) => {
            const tokens = tokensOf(step.usage)
            spent.input += tokens.input
            spent.output += tokens.output
            spent.reasoning += tokens.reasoning
            spent.cachedInput += tokens.cachedInput
            spent.cacheWrite += step.usage.inputTokenDetails?.cacheWriteTokens ?? 0
            record.merge({
              inputTokens: spent.input,
              outputTokens: spent.output,
              reasoningTokens: spent.reasoning,
              cacheReadTokens: spent.cachedInput,
              cacheWriteTokens: spent.cacheWrite,
            })
            await this.#extend(conversation.id, lease)
          },
        })
        // Usage of this answer, and the input of its last call: how full the context is.
        let contextTokens = 0
        // An approval continues its message: the tokens before it count too.
        const continued = messages.at(-1)
        const before =
          continued?.role === 'assistant' && input.message.role === 'assistant'
            ? (continued.metadata as AssistantMessageMetadata | undefined)?.tokens
            : undefined
        const ui = result.toUIMessageStream({
          sendReasoning: true,
          onError: (error) => {
            if (!toolErrorMessage(error))
              logger.error({ err: errorSummary(error) }, 'assistant: model call failed')
            return failureText(error)
          },
          messageMetadata: ({ part }) => {
            if (part.type === 'finish-step') contextTokens = part.usage.inputTokens ?? contextTokens
            if (part.type !== 'finish') return undefined
            return {
              model: resolved.choice.id,
              usage: { ...usage, used: usage.used + (input.message.role === 'user' ? 1 : 0) },
              tokens: addTokens(before, tokensOf(part.totalUsage)),
              contextTokens,
            } satisfies AssistantMessageMetadata
          },
        })
        // How long each thought took (the AI SDK doesn't time them): sent as
        // metadata after each one ends, continuing the message's own list.
        const last = messages.at(-1)
        const reasoningMs = [
          ...(last?.role === 'assistant' && input.message.role === 'assistant'
            ? ((last.metadata as AssistantMessageMetadata | undefined)?.reasoningMs ?? [])
            : []),
        ]
        const started = new Map<string, number>()
        writer.merge(
          ui.pipeThrough(
            new TransformStream({
              transform(chunk, controller) {
                controller.enqueue(chunk)
                if (chunk.type === 'reasoning-start') started.set(chunk.id, Date.now())
                if (chunk.type === 'reasoning-end' && started.has(chunk.id)) {
                  reasoningMs.push(Date.now() - started.get(chunk.id)!)
                  controller.enqueue({
                    type: 'message-metadata',
                    messageMetadata: { reasoningMs: [...reasoningMs] },
                  })
                }
              },
            })
          )
        )
      },
      onError: (error) => {
        logger.error({ err: errorSummary(error) }, 'assistant: chat stream failed')
        return failureText(error)
      },
      onEnd: async ({ messages: ui }) => {
        try {
          // A request that failed before its first word leaves nothing to keep.
          conversation.uiMessages = ui.filter(hasContent)
          await conversation.save()
          await usageRow?.save()
        } catch (error) {
          logger.error({ err: errorSummary(error) }, 'assistant: saving the conversation failed')
        } finally {
          await this.#release(conversation.id, lease)
        }
      },
    })
  }

  /** The conversation of this chat id, created on its first message. */
  async #open(ctx: ToolContext, input: ChatInput) {
    if (input.message.role === 'user') {
      await db
        .table('assistant_conversations')
        .insert({
          id: input.id,
          store_id: ctx.store.id,
          user_id: ctx.user.id,
          ui_messages: '[]',
          created_at: new Date(),
          updated_at: new Date(),
        })
        .onConflict('id')
        .ignore()
    }
    return await this.#own(ctx, input.id)
  }

  /**
   * Takes the conversation for one request. The lease is its `busy_until`:
   * only the request holding that exact value extends or releases it, so a
   * request that outlived its lease never frees someone else's.
   */
  async #claim(id: string): Promise<Lease | null> {
    const now = DateTime.now()
    const until = now.plus({ seconds: BUSY_SECONDS }).toJSDate()
    const updated = await db
      .from('assistant_conversations')
      .where('id', id)
      .where((query) => query.whereNull('busy_until').orWhere('busy_until', '<', now.toJSDate()))
      .update({ busy_until: until })
    return Number(Array.isArray(updated) ? updated.length : updated) > 0 ? { until } : null
  }

  async #extend(id: string, lease: Lease) {
    const until = DateTime.now().plus({ seconds: BUSY_SECONDS }).toJSDate()
    await db
      .from('assistant_conversations')
      .where('id', id)
      .where('busy_until', lease.until)
      .update({ busy_until: until })
    lease.until = until
  }

  async #release(id: string, lease: Lease) {
    await db
      .from('assistant_conversations')
      .where('id', id)
      .where('busy_until', lease.until)
      .update({ busy_until: null })
  }
}
