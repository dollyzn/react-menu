import { test } from '@japa/runner'
import { createHmac } from 'node:crypto'
import MercadoPagoClient, { isValidWebhookSignature } from '#payments/mercado_pago_client'

const SECRET = 'webhook-secret-123'
const sign = (manifest: string) =>
  `ts=1700000000,v1=${createHmac('sha256', SECRET).update(manifest).digest('hex')}`

test.group('Mercado Pago client', (group) => {
  const realFetch = globalThis.fetch
  group.each.teardown(() => {
    globalThis.fetch = realFetch
  })
  const answer = (status: number, body: unknown) => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      })
  }
  const order = {
    type: 'online' as const,
    processing_mode: 'automatic' as const,
    total_amount: '15.00',
    external_reference: 'o1',
    description: 'Pedido',
    payer: { email: 'ana@example.com' },
    transactions: {
      payments: [{ amount: '15.00', payment_method: { id: 'visa', type: 'credit_card' as const } }],
    },
  }

  test('a card the issuer refuses (402) is a result, not an outage', async ({ assert }) => {
    answer(402, { id: 'ORD1', status: 'failed', status_detail: 'failed' })
    const result = await new MercadoPagoClient().createOrder('token', order, 'key')
    assert.equal(result.id, 'ORD1')
    assert.equal(result.status, 'failed')
  })

  test('other errors are a provider failure', async ({ assert }) => {
    answer(500, { error: 'internal_error' })
    await assert.rejects(
      () => new MercadoPagoClient().createOrder('token', order, 'key'),
      /Mercado Pago/
    )
    answer(402, { errors: [{ code: 'x' }] })
    await assert.rejects(() => new MercadoPagoClient().createOrder('token', order, 'key'))
  })

  test('webhook signatures: as sent, lowercase, without request id; never a wrong secret', ({
    assert,
  }) => {
    const valid = (signature: string, dataId: string, requestId?: string) =>
      isValidWebhookSignature({ signature, requestId, dataId, secret: SECRET })

    assert.isTrue(valid(sign('id:ORD01ABC;request-id:r1;ts:1700000000;'), 'ORD01ABC', 'r1'))
    assert.isTrue(valid(sign('id:ord01abc;request-id:r1;ts:1700000000;'), 'ORD01ABC', 'r1'))
    assert.isTrue(valid(sign('id:ORD01ABC;ts:1700000000;'), 'ORD01ABC'))
    assert.isFalse(valid(sign('id:ORD01ABC;request-id:r1;ts:1700000000;'), 'ORD01ABD', 'r1'))
    assert.isFalse(valid('ts=1700000000,v1=00ff', 'ORD01ABC', 'r1'))
    assert.isFalse(valid('v1=abc', 'ORD01ABC', 'r1'))
  })
})
