import { createHash } from 'node:crypto'
import redis from '@adonisjs/redis/services/main'
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import AppException from '#exceptions/app_exception'

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const KEY_FORMAT = /^[\w.:-]{8,128}$/
/** How long a finished request can be replayed. */
const REPLAY_TTL_SECONDS = 24 * 60 * 60
/** Lock while the first attempt runs; frees the key if the process dies. */
const LOCK_TTL_SECONDS = 60

type Entry =
  | { state: 'processing'; fingerprint: string }
  | { state: 'done'; fingerprint: string; status: number; body: unknown }

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

/**
 * `Idempotency-Key` support for every write (IETF draft
 * "The Idempotency-Key HTTP Header Field"). Clients on unstable networks
 * retry with the same key and get the first response back instead of
 * running the operation twice.
 *
 * - The key is scoped to the signed-in user (or anonymous) and the route,
 *   so it cannot replay someone else's response.
 * - Same key with a different body is a client bug: 422.
 * - A retry while the first attempt still runs: 409 + Retry-After.
 * - Only 2xx responses are stored. Errors roll back their transaction, so
 *   running the request again is safe (and may succeed later).
 *
 * Requests without the header behave as before. Order creation also keeps
 * the key in the database (orders.idempotency_key) for a guarantee that
 * survives Redis and process restarts.
 */
export default class IdempotencyMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    const key = ctx.request.header('idempotency-key')
    if (!key || !MUTATING.has(ctx.request.method())) return next()

    if (!KEY_FORMAT.test(key)) {
      throw new AppException('Idempotency-Key inválida.', 400, 'E_IDEMPOTENCY_KEY_INVALID')
    }

    // Scoped to the user (not the token, which can be renewed between retries).
    // check() never throws; the route's own auth middleware still decides access.
    const user = (await ctx.auth.check()) ? ctx.auth.user : null
    const caller = user ? `user:${user.id}` : 'anonymous'
    const route = `${ctx.request.method()} ${ctx.request.url()}`
    const storageKey = `idempotency:${sha256(`${caller}|${route}|${key}`)}`
    // Multipart bodies (uploads) are not fingerprinted; the route still is.
    const fingerprint = ctx.request.is(['multipart'])
      ? 'multipart'
      : sha256(JSON.stringify(ctx.request.body() ?? {}))

    const lock: Entry = { state: 'processing', fingerprint }
    const acquired = await redis.set(storageKey, JSON.stringify(lock), 'EX', LOCK_TTL_SECONDS, 'NX')

    if (!acquired) {
      const raw = await redis.get(storageKey)
      const entry = raw ? (JSON.parse(raw) as Entry) : null
      if (!entry) return this.retryLater(ctx)
      if (entry.fingerprint !== fingerprint) {
        throw new AppException(
          'Esta Idempotency-Key já foi usada com outros dados.',
          422,
          'E_IDEMPOTENCY_KEY_REUSED'
        )
      }
      if (entry.state === 'processing') return this.retryLater(ctx)

      ctx.response.header('Idempotent-Replayed', 'true')
      return ctx.response.status(entry.status).send(entry.body)
    }

    try {
      await next()
    } catch (error) {
      await redis.del(storageKey)
      throw error
    }

    const status = ctx.response.getStatus()
    if (status >= 200 && status < 300) {
      const done: Entry = { state: 'done', fingerprint, status, body: ctx.response.getBody() }
      await redis.set(storageKey, JSON.stringify(done), 'EX', REPLAY_TTL_SECONDS)
    } else {
      await redis.del(storageKey)
    }
  }

  private retryLater(ctx: HttpContext) {
    ctx.response.header('Retry-After', '1')
    throw new AppException(
      'Esta operação ainda está sendo processada. Tente de novo em instantes.',
      409,
      'E_IDEMPOTENCY_IN_PROGRESS'
    )
  }
}
