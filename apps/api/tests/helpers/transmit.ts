import { randomUUID } from 'node:crypto'
import { PassThrough } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { HttpContext } from '@adonisjs/core/http'
import transmit from '@adonisjs/transmit/services/main'

/**
 * Transmit only subscribes uids that have an open event stream. Registers
 * one writing to a throwaway sink (instead of holding an SSE request open)
 * and closes it when the test ends.
 */
export function openStream(cleanup: (fn: () => void) => void) {
  const uid = randomUUID()
  const sink = new PassThrough()
  sink.resume()
  transmit.createStream({
    uid,
    request: {} as IncomingMessage,
    response: sink as unknown as ServerResponse,
    context: {} as HttpContext,
  })
  cleanup(() => void sink.emit('close'))
  return uid
}
