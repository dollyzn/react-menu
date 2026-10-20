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
