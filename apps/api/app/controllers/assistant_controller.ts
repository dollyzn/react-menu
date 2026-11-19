import { Readable } from 'node:stream'
import type { ReadableStream as WebReadableStream } from 'node:stream/web'
import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { JsonToSseTransformStream } from 'ai'
import { ok, messageOnly } from '#helpers/api_response'
import Store from '#models/store'
import AppException from '#exceptions/app_exception'
import AssistantService from '#services/assistant_service'
import {
  assistantChatValidator,
  assistantModelsValidator,
  assistantSettingsValidator,
} from '#validators/assistant'
import { uuidValidator } from '#validators/common'
import type { ToolContext } from '#assistant/types'

/** The store assistant (front of house: managers and attendants, see the routes). */
@inject()
export default class AssistantController {
  constructor(private assistant: AssistantService) {}

  async status(ctx: HttpContext) {
    const { store } = await this.#context(ctx)
    return ok(await this.assistant.status(store))
  }

  /** Estimated US$ today and this month (managers, the settings). */
  async costs(ctx: HttpContext) {
    const { store } = await this.#context(ctx)
    return ok(await this.assistant.costs(store))
  }

  /** The chat models a key can use (managers, the settings' list). */
  async models(ctx: HttpContext) {
    const data = await ctx.request.validateUsing(assistantModelsValidator)
    const { store } = await this.#context(ctx)
    return ok(await this.assistant.availableModels(store, data))
  }

  /** Managers set or clear the store's model and API key (see the routes). */
  async updateSettings(ctx: HttpContext) {
    const data = await ctx.request.validateUsing(assistantSettingsValidator)
    const { store } = await this.#context(ctx)
    return ok(await this.assistant.updateSettings(store, data))
  }

  async conversations(ctx: HttpContext) {
    return ok(await this.assistant.list(await this.#context(ctx)))
  }

  async show(ctx: HttpContext) {
    const id = await uuidValidator.validate(ctx.params.conversationId)
    return ok(await this.assistant.find(await this.#context(ctx), id))
  }

  async destroy(ctx: HttpContext) {
    const id = await uuidValidator.validate(ctx.params.conversationId)
    await this.assistant.remove(await this.#context(ctx), id)
    return messageOnly('Conversa apagada.')
  }

  /**
   * Streams the answer as Server-Sent Events in the AI SDK's UI message
   * protocol (what `useChat` reads). Errors before the stream starts (limit,
   * busy, invalid message) are ordinary JSON errors.
   */
  async chat(ctx: HttpContext) {
    const input = await ctx.request.validateUsing(assistantChatValidator)
    const context = await this.#context(ctx)

    // The person closed the panel or pressed stop: the model call stops too.
    const abort = new AbortController()
    const raw = ctx.response.response
    raw.on('close', () => {
      if (!raw.writableFinished) abort.abort()
    })

    const stream = await this.assistant.chat(context, input, abort.signal)
    ctx.response.header('Content-Type', 'text/event-stream; charset=utf-8')
    ctx.response.header('Cache-Control', 'no-cache, no-store, no-transform')
    ctx.response.header('Connection', 'keep-alive')
    // nginx in front of Caddy would buffer the whole answer otherwise.
    ctx.response.header('X-Accel-Buffering', 'no')
    ctx.response.header('x-vercel-ai-ui-message-stream', 'v1')
    const sse = stream.pipeThrough(new JsonToSseTransformStream())
    ctx.response.stream(Readable.fromWeb(sse as unknown as WebReadableStream))
  }

  async #context({ params, auth }: HttpContext): Promise<ToolContext> {
    const storeId = await uuidValidator.validate(params.storeId)
    const user = auth.getUserOrFail()
    const [store, role] = await Promise.all([Store.findOrFail(storeId), user.storeRole(storeId)])
    // storeAccess and frontOfHouse ran already; this keeps the role for the tools.
    if (!role) throw new AppException('Sem acesso a esta loja.', 403, 'E_FORBIDDEN')
    return { store, user, role }
  }
}
