import { test } from '@japa/runner'
import { normalizeBrazilianPhone } from '#helpers/phone'

test.group('normalizeBrazilianPhone', () => {
  test('accepts common formats', ({ assert }) => {
    assert.equal(normalizeBrazilianPhone('(11) 98765-4321'), '5511987654321')
    assert.equal(normalizeBrazilianPhone('+55 11 98765 4321'), '5511987654321')
    assert.equal(normalizeBrazilianPhone('1133334444'), '551133334444')
  })

  test('rejects invalid numbers', ({ assert }) => {
    assert.isNull(normalizeBrazilianPhone('12345'))
    assert.isNull(normalizeBrazilianPhone('+1 415 555 0100'))
  })
})
