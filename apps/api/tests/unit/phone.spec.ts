import { test } from '@japa/runner'
import { maskPhone, normalizeBrazilianPhone, phoneFromWaId, phoneVariants } from '#helpers/phone'

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

test.group('WhatsApp ids and the ninth digit', () => {
  test('an id of an older mobile gets the ninth digit back', ({ assert }) => {
    assert.equal(phoneFromWaId('551187654321'), '5511987654321')
    assert.equal(phoneFromWaId('5511987654321'), '5511987654321')
    // Landlines have no ninth digit.
    assert.equal(phoneFromWaId('551133334444'), '551133334444')
    assert.isNull(phoneFromWaId('14155550100'))
  })

  test('a stored phone matches both spellings of a mobile', ({ assert }) => {
    assert.sameMembers(phoneVariants('5511987654321'), ['5511987654321', '551187654321'])
    assert.sameMembers(phoneVariants('551187654321'), ['551187654321', '5511987654321'])
    assert.deepEqual(phoneVariants('551133334444'), ['551133334444'])
  })

  test('masked for the customer to recognise', ({ assert }) => {
    assert.equal(maskPhone('5511987654321'), '(11) •••••-4321')
  })
})
