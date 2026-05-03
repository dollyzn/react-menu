export function ok<T>(data: T, meta?: Record<string, unknown>) {
  if (meta !== undefined) {
    return { success: true as const, data, meta }
  }
  return { success: true as const, data }
}

export function created<T>(data: T, message: string) {
  return { success: true as const, data, message }
}

export function updated<T>(data: T, message: string) {
  return { success: true as const, data, message }
}

export function messageOnly(message: string, success = true as const) {
  return { success, message }
}

export function fail<T>(message: string, data?: T) {
  if (data !== undefined) {
    return { success: false as const, message, data }
  }
  return { success: false as const, message }
}
