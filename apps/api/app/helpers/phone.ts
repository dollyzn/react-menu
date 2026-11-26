/**
 * Normalizes a Brazilian phone to digits with country code
 * ("(11) 98765-4321" → "5511987654321"). Returns null when invalid.
 */
export function normalizeBrazilianPhone(input: string): string | null {
  // An explicit international prefix must be Brazil's.
  if (input.trim().startsWith('+') && !input.trim().startsWith('+55')) return null
  let digits = input.replace(/\D/g, '')
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`
  if (!digits.startsWith('55') || (digits.length !== 12 && digits.length !== 13)) return null
  return digits
}

/** A Brazilian mobile without the ninth digit ("55 11 8765-4321", 12 digits starting 6–9). */
const OLD_MOBILE = /^55(\d{2})([6-9]\d{7})$/
/** A Brazilian mobile with it ("55 11 9 8765-4321"). */
const MOBILE = /^55(\d{2})9([6-9]\d{7})$/

/**
 * The phone of a WhatsApp id (`wa_id`, digits). Older Brazilian mobiles
 * have ids without the ninth digit; it is put back so the id matches the
 * phone customers type (normalizeBrazilianPhone). Null for non-Brazilian ids.
 */
export function phoneFromWaId(waId: string): string | null {
  const digits = waId.replace(/\D/g, '')
  const old = OLD_MOBILE.exec(digits)
  if (old) return `55${old[1]}9${old[2]}`
  return normalizeBrazilianPhone(`+${digits}`)
}

/**
 * Every spelling a stored phone may have for the same line: a mobile with
 * and without the ninth digit (customers saved before it, ids of older
 * numbers). Landlines have one.
 */
export function phoneVariants(phone: string): string[] {
  const mobile = MOBILE.exec(phone)
  if (mobile) return [phone, `55${mobile[1]}${mobile[2]}`]
  const old = OLD_MOBILE.exec(phone)
  if (old) return [phone, `55${old[1]}9${old[2]}`]
  return [phone]
}

/** "(11) •••••-4321": enough for the customer to recognise their number. */
export function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, '').replace(/^55/, '')
  if (digits.length < 10) return '•••'
  return `(${digits.slice(0, 2)}) •••••-${digits.slice(-4)}`
}
