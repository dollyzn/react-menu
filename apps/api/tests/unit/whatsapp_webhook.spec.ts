import { test } from '@japa/runner'
import { isValidSignature, signBody } from '#whatsapp/webhook'
import { templateComponents, templateText } from '#whatsapp/templates'
import { isAfter } from '#models/whatsapp_message'

test.group('WhatsApp webhook signature', () => {
  test('X-Hub-Signature-256 over the raw body with the app secret', ({ assert }) => {
    const raw = '{"object":"whatsapp_business_account","entry":[]}'
    const signature = signBody(raw, 'secret')
    assert.isTrue(isValidSignature(raw, signature, 'secret'))
    assert.isFalse(isValidSignature(raw, signature, 'other-secret'))
    // The same JSON with other spacing is another body.
    assert.isFalse(isValidSignature(raw.replace(':', ': '), signature, 'secret'))
    assert.isFalse(isValidSignature(raw, undefined, 'secret'))
    assert.isFalse(isValidSignature(raw, 'sha256=zz', 'secret'))
  })
})

test.group('WhatsApp template parameters', () => {
  test('values as templates accept them', ({ assert }) => {
    assert.equal(templateText('  Ana\n  Souza\t'), 'Ana Souza')
    assert.equal(templateText('   '), '-')
    assert.lengthOf(templateText('x'.repeat(100), 40), 40)
  })

  test('named body parameters and the URL button suffix', ({ assert }) => {
    assert.deepEqual(templateComponents({ cliente: 'Ana' }, 'token-1'), [
      { type: 'body', parameters: [{ type: 'text', parameter_name: 'cliente', text: 'Ana' }] },
      {
        type: 'button',
        sub_type: 'url',
        index: '0',
        parameters: [{ type: 'text', text: 'token-1' }],
      },
    ])
  })
})

test.group('WhatsApp message statuses', () => {
  test('only forward, and a late "failed" never undoes a delivered message', ({ assert }) => {
    assert.isTrue(isAfter('delivered', 'sent'))
    assert.isFalse(isAfter('sent', 'delivered'))
    assert.isTrue(isAfter('failed', 'sent'))
    assert.isFalse(isAfter('failed', 'delivered'))
    assert.isFalse(isAfter('failed', 'read'))
    assert.isFalse(isAfter('read', 'failed'))
  })
})
