import { randomUUID } from 'node:crypto'
import { test } from '@japa/runner'
import type { ApiClient } from '@japa/api-client'
import StoreRole from '#enums/store_role'
import CustomerLoginChallenge from '#models/customer_login_challenge'
import WhatsAppMessage from '#models/whatsapp_message'
import { TEMPLATES } from '#whatsapp/templates'
import { createMenuStore, createUser, linkUser } from '#tests/helpers/fixtures'
import { emptyDatabase } from '#tests/helpers/database'
import { fakeQueue } from '#tests/helpers/queue'
import { connectStore, useFakeGraph, webhookBody } from '#tests/helpers/fake_whatsapp'

const customer = { name: 'Ana Souza', phone: '(11) 98765-4321' }

/**
 * Customers have no account. A device follows the orders it placed by their
 * public tokens; the whole history needs the phone proven by WhatsApp
 * (ADR 0025): knowing a number is never enough.
 */
test.group('Customer order history', (group) => {
  group.each.setup(() => emptyDatabase)
  const meta = useFakeGraph(group)

  async function setup(client: ApiClient) {
    fakeQueue()
    const { store, carne } = await createMenuStore()
    const account = await connectStore(store)
    const place = (body: Record<string, unknown> = {}) =>
      client.post(`/api/v1/public/menu/${store.slug}/orders`).json({
        customer,
        paymentMethod: 'counter',
        lines: [{ itemId: carne.id, quantity: 1 }],
        ...body,
      })
    return { store, carne, account, place }
  }

  test('placing an order no longer hands out a history token', async ({ client, assert }) => {
    const { place } = await setup(client)
    const placed = await place()
    placed.assertStatus(200)
    assert.notProperty(placed.body().data, 'customerToken')
  })

  test('by message: the code sent from the phone opens its history, counter orders too', async ({
    client,
    assert,
  }) => {
    const { store, carne, account, place } = await setup(client)
    const cashier = await createUser()
    await linkUser(store, cashier, StoreRole.ATTENDANT)
    // An earlier counter order with the same phone, and one of someone else.
    await client
      .post(`/api/v1/stores/${store.id}/orders`)
      .json({
        customer: { name: 'Ana', phone: customer.phone },
        lines: [{ itemId: carne.id, quantity: 1 }],
      })
      .loginAs(cashier)
    await place({ customer: { name: 'Bia', phone: '(11) 91111-2222' } })
    await place()

    const started = await client
      .post(`/api/v1/public/menu/${store.slug}/customer-login`)
      .json({ method: 'message' })
    started.assertStatus(200)
    assert.equal(started.header('cache-control'), 'no-store')
    const challenge = started.body().data
    assert.match(challenge.code, /^[A-Z0-9]{6}$/)
    assert.equal(challenge.link.split('?')[0], 'https://wa.me/551133334444')
    assert.include(decodeURIComponent(challenge.link), challenge.code)

    const claim = () =>
      client
        .post(`/api/v1/public/menu/${store.slug}/customer-login/${challenge.id}`)
        .json({ secret: challenge.secret })
    const waiting = await claim()
    waiting.assertStatus(200)
    assert.deepEqual(waiting.body().data, { status: 'pending' })

    // The message arrives from an older id without the ninth digit.
    const { payload, signature } = webhookBody(account.phoneNumberId, {
      contacts: [{ wa_id: '551187654321', profile: { name: 'Ana' } }],
      messages: [
        {
          from: '551187654321',
          id: 'wamid.IN1',
          timestamp: '1749416383',
          type: 'text',
          text: { body: `Quero ver meus pedidos na ${store.name}. Código: ${challenge.code}` },
        },
      ],
    })
    const delivered = await client
      .post('/api/v1/webhooks/whatsapp')
      .header('x-hub-signature-256', signature)
      .json(payload)
    delivered.assertStatus(200)
    // Delivered twice by Meta: still one reply.
    await client
      .post('/api/v1/webhooks/whatsapp')
      .header('x-hub-signature-256', signature)
      .json(payload)

    const verified = await claim()
    verified.assertStatus(200)
    const { customerToken, customer: who } = verified.body().data
    assert.match(customerToken, /^cs_/)
    // The name the store knows (the counter's; online orders never rename a customer).
    assert.deepEqual(who, { name: 'Ana', phone: '(11) •••••-4321' })
    // Single use.
    const reused = await claim()
    reused.assertStatus(410)

    const history = await client
      .get(`/api/v1/public/menu/${store.slug}/my-orders`)
      .header('Customer-Token', customerToken)
    history.assertStatus(200)
    assert.lengthOf(history.body().data.orders, 2)
    assert.deepEqual(history.body().data.orders[0].items, [
      { name: 'Pastel de Carne', quantity: 1 },
    ])

    const replies = await WhatsAppMessage.query().where('kind', 'login_reply')
    assert.lengthOf(replies, 1)
    assert.equal(replies[0].to, '551187654321')

    // "Sair": the token stops working.
    const signOut = await client
      .delete(`/api/v1/public/menu/${store.slug}/customer-session`)
      .header('Customer-Token', customerToken)
    signOut.assertStatus(200)
    const afterSignOut = await client
      .get(`/api/v1/public/menu/${store.slug}/my-orders`)
      .header('Customer-Token', customerToken)
    afterSignOut.assertStatus(401)
  })

  test("a message without a pending code is the store's business: ignored", async ({
    client,
    assert,
  }) => {
    const { account } = await setup(client)
    const { payload, signature } = webhookBody(account.phoneNumberId, {
      messages: [
        {
          from: '5511987654321',
          id: 'wamid.IN2',
          timestamp: '1',
          type: 'text',
          text: { body: 'Vocês abrem hoje? ABCDEF' },
        },
      ],
    })
    const delivered = await client
      .post('/api/v1/webhooks/whatsapp')
      .header('x-hub-signature-256', signature)
      .json(payload)
    delivered.assertStatus(200)
    assert.lengthOf(await WhatsAppMessage.all(), 0)
  })

  test('by code: sent to the phone, wrong codes counted, the right one opens the history', async ({
    client,
    assert,
  }) => {
    const { store, place } = await setup(client)
    await place()

    const started = await client
      .post(`/api/v1/public/menu/${store.slug}/customer-login`)
      .json({ method: 'code', phone: customer.phone })
    started.assertStatus(200)
    const challenge = started.body().data
    assert.equal(challenge.phone, '(11) •••••-4321')
    assert.notProperty(challenge, 'code')

    const [sent] = meta.graph.sent
    assert.equal(sent.to, '5511987654321')
    const template = sent.body.template as {
      name: string
      components: { parameters: { text: string }[] }[]
    }
    assert.equal(template.name, TEMPLATES.LOGIN_CODE)
    const code = template.components[0].parameters[0].text
    assert.match(code, /^\d{6}$/)
    assert.equal(template.components[1].parameters[0].text, code)

    const url = `/api/v1/public/menu/${store.slug}/customer-login/${challenge.id}`
    const wrong = await client
      .post(url)
      .json({ secret: challenge.secret, code: code === '000000' ? '111111' : '000000' })
    wrong.assertStatus(422)
    wrong.assertBodyContains({ code: 'E_LOGIN_CODE_INVALID', details: { attemptsLeft: 4 } })
    // Someone else's secret: not found.
    const stranger = await client.post(url).json({ secret: 'x'.repeat(43), code })
    stranger.assertStatus(404)

    const right = await client.post(url).json({ secret: challenge.secret, code })
    right.assertStatus(200)
    assert.equal(right.body().data.status, 'verified')
    const history = await client
      .get(`/api/v1/public/menu/${store.slug}/my-orders`)
      .header('Customer-Token', right.body().data.customerToken)
    assert.lengthOf(history.body().data.orders, 1)
  })

  test('codes are limited per phone and locked after five wrong tries', async ({
    client,
    assert,
  }) => {
    const { store } = await setup(client)
    const start = () =>
      client
        .post(`/api/v1/public/menu/${store.slug}/customer-login`)
        .json({ method: 'code', phone: customer.phone })

    const firstStart = await start()
    const first = firstStart.body().data
    await start()
    await start()
    const fourth = await start()
    fourth.assertStatus(429)
    fourth.assertBodyContains({ code: 'E_LOGIN_TOO_MANY' })
    assert.lengthOf(meta.graph.sent, 3)

    const url = `/api/v1/public/menu/${store.slug}/customer-login/${first.id}`
    await CustomerLoginChallenge.query().where('id', first.id).update({ attempts: 5 })
    const locked = await client.post(url).json({ secret: first.secret, code: '123456' })
    locked.assertStatus(429)
    locked.assertBodyContains({ code: 'E_LOGIN_LOCKED' })
  })

  test('history needs a valid session of that store; stores without WhatsApp offer none', async ({
    client,
    assert,
  }) => {
    const { store } = await setup(client)
    const other = await createMenuStore()

    const noToken = await client.get(`/api/v1/public/menu/${store.slug}/my-orders`)
    noToken.assertStatus(401)
    const badToken = await client
      .get(`/api/v1/public/menu/${store.slug}/my-orders`)
      .header('Customer-Token', 'cs_not-a-real-token')
    badToken.assertStatus(401)

    const menu = await client.get(`/api/v1/public/menu/${other.store.slug}`)
    assert.deepEqual(menu.body().data.store.whatsapp, { notifications: false, login: null })
    const refused = await client
      .post(`/api/v1/public/menu/${other.store.slug}/customer-login`)
      .json({ method: 'message' })
    refused.assertStatus(409)
    refused.assertBodyContains({ code: 'E_CUSTOMER_LOGIN_UNAVAILABLE' })

    // A session of one store doesn't open another's.
    const start = await client
      .post(`/api/v1/public/menu/${store.slug}/customer-login`)
      .json({ method: 'code', phone: customer.phone })
    const started = start.body().data
    const code = (
      meta.graph.sent[0].body.template as { components: { parameters: { text: string }[] }[] }
    ).components[0].parameters[0].text
    const claimed = await client
      .post(`/api/v1/public/menu/${store.slug}/customer-login/${started.id}`)
      .json({ secret: started.secret, code })
    const token = claimed.body().data.customerToken
    await connectStore(other.store)
    const otherStore = await client
      .get(`/api/v1/public/menu/${other.store.slug}/my-orders`)
      .header('Customer-Token', token)
    otherStore.assertStatus(401)
  })

  test('guesses sent at the same time still get five attempts in all', async ({
    client,
    assert,
  }) => {
    const { store } = await setup(client)
    const start = await client
      .post(`/api/v1/public/menu/${store.slug}/customer-login`)
      .json({ method: 'code', phone: customer.phone })
    const challenge = start.body().data
    const url = `/api/v1/public/menu/${store.slug}/customer-login/${challenge.id}`
    const right = (
      meta.graph.sent[0].body.template as { components: { parameters: { text: string }[] }[] }
    ).components[0].parameters[0].text
    const wrong = Array.from({ length: 12 }, (_, index) =>
      String((Number(right) + index + 1) % 1_000_000).padStart(6, '0')
    )

    const answers = await Promise.all(
      wrong.map((code) => client.post(url).json({ secret: challenge.secret, code }))
    )
    const statuses = answers.map((answer) => answer.status())
    assert.equal(statuses.filter((status) => status === 422).length, 5)
    assert.equal(statuses.filter((status) => status === 429).length, 7)
    // Even the right code now: locked.
    const late = await client.post(url).json({ secret: challenge.secret, code: right })
    late.assertStatus(429)
  })

  test('the same Idempotency-Key again: the same challenge, no second code; a lost claim answer is handed out again', async ({
    client,
    assert,
  }) => {
    const { store } = await setup(client)
    const start = () =>
      client
        .post(`/api/v1/public/menu/${store.slug}/customer-login`)
        .header('Idempotency-Key', 'start-key-1')
        .json({ method: 'code', phone: customer.phone })
    const first = await start()
    const again = await start()
    again.assertStatus(200)
    assert.equal(again.body().data.id, first.body().data.id)
    assert.notEqual(again.body().data.secret, first.body().data.secret)
    assert.lengthOf(meta.graph.sent, 1)

    // Only the newest secret works (the first answer never reached the browser).
    const url = `/api/v1/public/menu/${store.slug}/customer-login/${first.body().data.id}`
    const stale = await client.post(url).json({ secret: first.body().data.secret })
    stale.assertStatus(404)

    const code = (
      meta.graph.sent[0].body.template as { components: { parameters: { text: string }[] }[] }
    ).components[0].parameters[0].text
    const claim = () =>
      client
        .post(url)
        .header('Idempotency-Key', 'claim-key-1')
        .json({ secret: again.body().data.secret, code })
    const claimed = await claim()
    claimed.assertStatus(200)
    const retried = await claim()
    retried.assertStatus(200)
    const token = retried.body().data.customerToken as string
    assert.notEqual(token, claimed.body().data.customerToken)
    const history = await client
      .get(`/api/v1/public/menu/${store.slug}/my-orders`)
      .header('Customer-Token', token)
    history.assertStatus(200)

    // Another key (another browser holding the secret): still single use.
    const other = await client
      .post(url)
      .header('Idempotency-Key', 'claim-key-2')
      .json({ secret: again.body().data.secret, code })
    other.assertStatus(410)
  })

  test('a code that could not be sent leaves nothing behind', async ({ client, assert }) => {
    const { store } = await setup(client)
    const { WhatsAppApiError } = await import('#whatsapp/client')
    meta.graph.failNextSend = new WhatsAppApiError('Payment issue', 400, 131042)
    const failed = await client
      .post(`/api/v1/public/menu/${store.slug}/customer-login`)
      .json({ method: 'code', phone: customer.phone })
    // A refusal is final (422: the web doesn't retry it) and leaves nothing.
    failed.assertStatus(422)
    failed.assertBodyContains({ code: 'E_WHATSAPP_SEND' })
    assert.lengthOf(await CustomerLoginChallenge.all(), 0)
  })

  test('Meta not answering keeps the code valid: a retry gets the same challenge, no second code', async ({
    client,
    assert,
  }) => {
    const { store } = await setup(client)
    const { WhatsAppApiError } = await import('#whatsapp/client')
    meta.graph.failNextSend = new WhatsAppApiError('Meta did not answer', 0, null)
    const start = () =>
      client
        .post(`/api/v1/public/menu/${store.slug}/customer-login`)
        .header('Idempotency-Key', 'timeout-key')
        .json({ method: 'code', phone: customer.phone })
    const first = await start()
    // The code may have reached the phone: the customer goes on to type it.
    first.assertStatus(200)
    const retried = await start()
    assert.equal(retried.body().data.id, first.body().data.id)
    assert.lengthOf(await CustomerLoginChallenge.all(), 1)
    assert.lengthOf(meta.graph.sent, 0)
  })

  test('parallel starts for one phone still send three codes at most', async ({
    client,
    assert,
  }) => {
    const { store } = await setup(client)
    const answers = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        client
          .post(`/api/v1/public/menu/${store.slug}/customer-login`)
          .header('Idempotency-Key', `parallel-${index}`)
          .json({ method: 'code', phone: customer.phone })
      )
    )
    const statuses = answers.map((answer) => answer.status())
    assert.equal(statuses.filter((status) => status === 200).length, 3)
    assert.equal(statuses.filter((status) => status === 429).length, 3)
    assert.lengthOf(meta.graph.sent, 3)
  })

  test('a device refreshes its own orders by public token', async ({ client, assert }) => {
    const { store, carne } = await createMenuStore()
    const placed = await client.post(`/api/v1/public/menu/${store.slug}/orders`).json({
      customer,
      paymentMethod: 'counter',
      lines: [{ itemId: carne.id, quantity: 2 }],
    })
    const publicToken = placed.body().data.publicToken as string

    // Literal commas, like the browser sends them (the query parser splits them).
    const response = await client.get(
      `/api/v1/public/orders?tokens=${publicToken},${randomUUID()},not-a-token`
    )

    response.assertStatus(200)
    assert.lengthOf(response.body().data, 1)
    assert.equal(response.body().data[0].publicToken, publicToken)
    assert.equal(response.body().data[0].status, 'received')
    assert.equal(response.body().data[0].store.slug, store.slug)
  })

  test('tracking shows when each step happened', async ({ client, assert }) => {
    const { store, carne } = await createMenuStore()
    const placed = await client.post(`/api/v1/public/menu/${store.slug}/orders`).json({
      customer,
      paymentMethod: 'counter',
      lines: [{ itemId: carne.id, quantity: 1 }],
    })
    const tracking = await client.get(`/api/v1/public/orders/${placed.body().data.publicToken}`)

    const timeline = tracking.body().data.timeline as { status: string; at: string }[]
    assert.deepEqual(
      timeline.map((step) => step.status),
      ['pending_payment', 'received']
    )
    assert.equal(tracking.body().data.items[0].itemId, carne.id)
  })
})
