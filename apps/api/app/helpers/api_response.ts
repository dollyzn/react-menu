import type { ApiMessage, ApiSuccess, BulkDeleteResult } from '@react-menu/contracts'

/**
 * Success envelopes. Errors are produced by app/exceptions/handler.ts; never
 * return `success: false` with a 2xx status.
 */
export function ok<T>(data: T): ApiSuccess<T>
export function ok<T, M extends Record<string, unknown>>(data: T, meta: M): ApiSuccess<T, M>
export function ok<T>(data: T, meta?: Record<string, unknown>) {
  if (meta !== undefined) {
    return { success: true as const, data, meta }
  }
  return { success: true as const, data }
}

export function created<T>(data: T, message: string): ApiSuccess<T> {
  return { success: true, data, message }
}

export function updated<T>(data: T, message: string): ApiSuccess<T> {
  return { success: true, data, message }
}

export function messageOnly(message: string): ApiMessage {
  return { success: true, message }
}

/**
 * Bulk deletes always answer 200 with `{ deleted, failed }`; a non-empty
 * `failed` list means a partial success and is not an error.
 */
export function bulkDeleted<T>(
  result: BulkDeleteResult<T>,
  messages: { success: string; partial: string }
): ApiSuccess<BulkDeleteResult<T>> {
  return {
    success: true,
    data: result,
    message: result.failed.length > 0 ? messages.partial : messages.success,
  }
}
