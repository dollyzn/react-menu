import { randomUUID } from 'node:crypto'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import testUtils from '@adonisjs/core/services/test_utils'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import StoreRole from '#enums/store_role'
import AssistantConversation from '#models/assistant_conversation'
import Ingredient from '#models/ingredient'
import Item from '#models/item'
import Store from '#models/store'
import AssistantModels from '#assistant/models'
import type { AssistantProvider } from '@react-menu/contracts'
import { say, scriptedModel, type ModelCall, type StreamPart } from '#assistant/scripted_model'
import { DENIED_REASON, SKIPPED_REASON } from '#services/assistant_service'
import { createMenuStore, createUser, linkUser } from '#tests/helpers/fixtures'

type Chunk = Record<string, any>
const today = () => DateTime.now().setZone('America/Sao_Paulo').toISODate()!

const TEST_CHOICE = {
  id: 'anthropic:test-model',
  provider: 'anthropic' as const,
  model: 'test-model',
  name: 'Test',
  contextWindow: 100_000,
}

/** Answers with the scripted turns, in order (then "Pronto."). */
function testModel() {
  const turns: StreamPart[][] = []
  const model = scriptedModel(() => turns.shift() ?? say.text('Pronto.'))
  class TestModels extends AssistantModels {
    enabled() {
      return true
    }
    choices() {
      return { models: [TEST_CHOICE], defaultModel: TEST_CHOICE.id }
    }
    resolve(_store: Store, requested?: string | null) {
      return !requested || requested === TEST_CHOICE.id ? { choice: TEST_CHOICE, model } : null
    }
  }
  app.container.swap(AssistantModels, () => new TestModels())
  return { turns, calls: model.doStreamCalls as ModelCall[] }
}

/** The UI chunks of an SSE answer. */
function chunks(body: string): Chunk[] {
  return body
    .split('\n')
    .filter((line) => line.startsWith('data: ') && line !== 'data: [DONE]')
    .map((line) => JSON.parse(line.slice(6)))
}

/** Status, stream and field of awaited values (the lint rule forbids `(await x).y`). */
async function statusOf(request: PromiseLike<{ status(): number }>) {
  const response = await request
  return response.status()
}
async function streamOf(request: PromiseLike<{ text(): string }>) {
  const response = await request
  return chunks(response.text())
}
async function field<T, K extends keyof T>(value: Promise<T>, key: K) {
  const resolved = await value
  return resolved[key]
}

/** The tool results the model read in a call. */
const toolResults = (call: ModelCall) =>
  call.prompt.flatMap((message) =>
    message.role === 'tool' ? message.content.filter((part) => part.type === 'tool-result') : []
  ) as { toolName: string; output: { type: string; value?: any; reason?: string } }[]

async function setup() {
  const menu = await createMenuStore()
  const manager = await createUser()
  const attendant = await createUser()
  const cook = await createUser()
  await linkUser(menu.store, manager, StoreRole.MANAGER)
  await linkUser(menu.store, attendant, StoreRole.ATTENDANT)
  await linkUser(menu.store, cook, StoreRole.KITCHEN)
  return { ...menu, manager, attendant, cook, ...testModel() }
}

const ask = (text: string, id: string = randomUUID()) => ({
  id,
  message: { id: randomUUID(), role: 'user', parts: [{ type: 'text', text }] },
})

/** The assistant's message answering its waiting writes. */
function answer(id: string, first: Chunk[], approved: boolean) {
  return {
    id,
    message: {
      id: first.find((chunk) => chunk.type === 'start')!.messageId,
      role: 'assistant',
      parts: first
        .filter((chunk) => chunk.type === 'tool-approval-request')
        .map((request) => ({
          type: 'tool-x',
          toolCallId: request.toolCallId,
          state: 'approval-responded',
          approval: { id: request.approvalId, approved },
        })),
    },
  }
}

test.group('Store assistant', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.teardown(() => app.container.restore(AssistantModels))

  test('managers connect providers and choose models; keys never come back', async ({
    client,
    assert,
  }) => {
    const { store, manager, attendant } = await setup()
    app.container.restore(AssistantModels)
    const url = `/api/v1/stores/${store.id}/assistant-settings`
    const gpt = { provider: 'openai', model: 'gpt-test', name: 'GPT Test', contextWindow: null }
    const body = {
      keys: { openai: 'sk-secret-123456' },
      models: [gpt],
      defaultModel: 'openai:gpt-test',
    }

    assert.equal(await statusOf(client.put(url).json(body).loginAs(attendant)), 403)
    const response = await client.put(url).json(body).loginAs(manager)
    response.assertStatus(200)
    assert.deepEqual(response.body().data, {
      enabled: true,
      providers: ['openai'],
      models: [{ ...gpt, id: 'openai:gpt-test' }],
      defaultModel: 'openai:gpt-test',
    })
    assert.notInclude(JSON.stringify(response.body()), 'sk-secret')

    const saved = await Store.findOrFail(store.id)
    assert.deepEqual(saved.assistantKeys, { openai: 'sk-secret-123456' })
    const raw = await db.from('stores').where('id', store.id).first()
    assert.notInclude(raw.assistant_keys, 'sk-secret')

    const detail = await client.get(`/api/v1/stores/${store.id}`).loginAs(manager)
    assert.notInclude(JSON.stringify(detail.body()), 'sk-secret')
    assert.deepEqual(detail.body().data.assistantProviders, ['openai'])
    const status = await client.get(`/api/v1/stores/${store.id}/assistant`).loginAs(attendant)
    assert.equal(status.body().data.defaultModel, 'openai:gpt-test')
    assert.lengthOf(status.body().data.models, 1)

    // A model of a provider without a key is refused.
    const claude = { provider: 'anthropic', model: 'claude-x', name: 'Claude', contextWindow: 1000 }
    const refused = await client
      .put(url)
      .json({ models: [gpt, claude] })
      .loginAs(manager)
    refused.assertStatus(422)
    // Another key, both models, the new one as default; the first key stays.
    await client
      .put(url)
      .json({
        keys: { anthropic: 'sk-ant-123456789' },
        models: [gpt, claude],
        defaultModel: 'anthropic:claude-x',
      })
      .loginAs(manager)
    const both = await Store.findOrFail(store.id)
    assert.deepEqual(both.assistantKeys, {
      openai: 'sk-secret-123456',
      anthropic: 'sk-ant-123456789',
    })
    assert.equal(both.assistantDefaultModel, 'anthropic:claude-x')

    // Removing a key removes its models (and the default moves).
    await client
      .put(url)
      .json({ keys: { anthropic: null } })
      .loginAs(manager)
    const one = await Store.findOrFail(store.id)
    assert.deepEqual(one.assistantKeys, { openai: 'sk-secret-123456' })
    assert.deepEqual(
      one.assistantModels.map((model) => model.id),
      ['openai:gpt-test']
    )
    assert.equal(one.assistantDefaultModel, 'openai:gpt-test')
    await client
      .put(url)
      .json({ keys: { openai: null } })
      .loginAs(manager)
    const off = await Store.findOrFail(store.id)
    assert.isFalse(off.assistantEnabled)
    // No key left: nothing stored, encrypted or not.
    const cleared = await db.from('stores').where('id', store.id).first()
    assert.isNull(cleared.assistant_keys)
  })

  test('the settings list the models of the typed key, or of the saved one', async ({
    client,
    assert,
  }) => {
    const { store, manager, attendant } = await setup()
    const asked: string[] = []
    class ListingModels extends AssistantModels {
      async listModels(provider: AssistantProvider, apiKey: string) {
        asked.push(`${provider}:${apiKey}`)
        return [{ id: 'model-a', name: 'Model A', contextWindow: 1000 }]
      }
    }
    app.container.swap(AssistantModels, () => new ListingModels())
    const url = `/api/v1/stores/${store.id}/assistant-settings/models`

    const none = await client.post(url).json({ provider: 'openai' }).loginAs(manager)
    none.assertStatus(422)
    assert.equal(none.body().code, 'E_ASSISTANT_KEY_REQUIRED')
    assert.equal(
      await statusOf(
        client.post(url).json({ provider: 'openai', apiKey: 'sk-typed-1234' }).loginAs(attendant)
      ),
      403
    )

    const typed = await client
      .post(url)
      .json({ provider: 'openai', apiKey: 'sk-typed-1234' })
      .loginAs(manager)
    assert.deepEqual(typed.body().data, [{ id: 'model-a', name: 'Model A', contextWindow: 1000 }])

    store.merge({ assistantKeys: { google: 'saved-key-1234' } })
    await store.save()
    await client.post(url).json({ provider: 'google' }).loginAs(manager)
    // The saved key belongs to its provider only.
    assert.equal(
      await statusOf(client.post(url).json({ provider: 'anthropic' }).loginAs(manager)),
      422
    )
    assert.deepEqual(asked, ['openai:sk-typed-1234', 'google:saved-key-1234'])
  })

  test('cost estimate in US$ per model, with list or store prices', async ({ client, assert }) => {
    const { store, manager, attendant } = await setup()
    store.merge({
      assistantKeys: { anthropic: 'sk-ant-123456789', openai: 'sk-123456789' },
      assistantModels: [
        {
          id: 'anthropic:claude-opus-5-5',
          provider: 'anthropic',
          model: 'claude-opus-5-5',
          name: 'Opus',
          contextWindow: null,
        },
        {
          id: 'openai:my-gpt',
          provider: 'openai',
          model: 'my-gpt',
          name: 'Mine',
          contextWindow: null,
          pricing: { input: 1, cachedInput: 0.5, output: 2 },
        },
      ],
    })
    await store.save()
    const row = (model: string, input: number, cached: number, output: number) => ({
      store_id: store.id,
      model,
      input_tokens: input,
      cache_read_tokens: cached,
      output_tokens: output,
      created_at: new Date(),
    })
    await db
      .table('assistant_usages')
      .multiInsert([
        row('anthropic:claude-opus-5-5', 1_000_000, 200_000, 100_000),
        row('openai:my-gpt', 1_000_000, 0, 1_000_000),
        row('google:unknown-model', 1000, 0, 1000),
      ])

    const url = `/api/v1/stores/${store.id}/assistant-costs`
    assert.equal(await statusOf(client.get(url).loginAs(attendant)), 403)
    const response = await client.get(url).loginAs(manager)
    response.assertStatus(200)
    const { today: day, month, prices } = response.body().data
    const cost = (id: string) => day.models.find((model: any) => model.id === id).cost
    // 800k fresh × 4 + 200k cached × 0.2 + 100k out × 20, per million.
    assert.closeTo(cost('anthropic:claude-opus-5-5'), 5.24, 0.0001)
    assert.closeTo(cost('openai:my-gpt'), 3, 0.0001)
    assert.isNull(cost('google:unknown-model'))
    assert.isTrue(day.partial)
    assert.closeTo(day.total, 8.24, 0.0001)
    assert.closeTo(month.total, 8.24, 0.0001)
    assert.deepEqual(
      prices.map((price: any) => [price.id, price.custom]),
      [
        ['anthropic:claude-opus-5-5', false],
        ['openai:my-gpt', true],
      ]
    )
  })

  test('without a model the chat answers 503', async ({ client, assert }) => {
    const { store, manager } = await setup()
    app.container.restore(AssistantModels)
    const status = await client.get(`/api/v1/stores/${store.id}/assistant`).loginAs(manager)
    assert.isFalse(status.body().data.enabled)
    const response = await client
      .post(`/api/v1/stores/${store.id}/assistant/chat`)
      .json(ask('Oi'))
      .loginAs(manager)
    response.assertStatus(503)
    assert.equal(response.body().code, 'E_ASSISTANT_DISABLED')
  })

  test('status for front of house only, and never for another store', async ({
    client,
    assert,
  }) => {
    const { store, manager, attendant, cook } = await setup()
    const outsider = await createUser()
    const other = await createMenuStore()
    await linkUser(other.store, outsider, StoreRole.MANAGER)

    const response = await client.get(`/api/v1/stores/${store.id}/assistant`).loginAs(manager)
    response.assertStatus(200)
    assert.isTrue(response.body().data.enabled)
    assert.deepInclude(response.body().data.usage, { used: 0, limit: 200 })

    const url = `/api/v1/stores/${store.id}/assistant`
    assert.equal(await statusOf(client.get(url).loginAs(attendant)), 200)
    assert.equal(await statusOf(client.get(url).loginAs(cook)), 403)
    assert.equal(await statusOf(client.get(url).loginAs(outsider)), 403)
  })

  test('a read tool runs, streams its card and goes back to the model', async ({
    client,
    assert,
  }) => {
    const { store, manager, turns, calls } = await setup()
    turns.push(
      [
        ...say.reasoning('Vejo o cardápio.'),
        ...say.text('Vou olhar.'),
        ...say.tool('menu_items', { search: 'carne' }),
      ],
      say.text('O **Pastel de Carne** custa R$ 15,00.')
    )

    const body = ask('Quanto custa o pastel de carne?')
    const response = await client
      .post(`/api/v1/stores/${store.id}/assistant/chat`)
      .json({ ...body, page: 'Cardápio' })
      .loginAs(manager)
    response.assertStatus(200)
    assert.include(response.header('content-type'), 'text/event-stream')

    const stream = chunks(response.text())
    const types = stream.map((chunk) => chunk.type)
    assert.includeMembers(types, [
      'start',
      'reasoning-delta',
      'tool-input-available',
      'tool-output-available',
      'finish',
    ])
    const output = stream.find((chunk) => chunk.type === 'tool-output-available')!.output
    assert.deepEqual(
      output.items.map((item: any) => item.name),
      ['Pastel de Carne']
    )
    assert.include(
      stream
        .filter((c) => c.type === 'text-delta')
        .map((c) => c.delta)
        .join(''),
      'R$ 15,00'
    )
    const metadata = stream.find((c) => c.type === 'finish')!.messageMetadata
    assert.equal(metadata.model, 'anthropic:test-model')
    assert.deepInclude(metadata.usage, { used: 1, limit: 200 })
    // The scripted model reports 10 in, 5 out per call (two calls).
    assert.deepEqual(metadata.tokens, { input: 20, output: 10, reasoning: 0, cachedInput: 0 })
    assert.equal(metadata.contextTokens, 10)
    // The thought was timed.
    const timed = stream.filter(
      (c) => c.type === 'message-metadata' && c.messageMetadata.reasoningMs
    )
    assert.lengthOf(timed.at(-1)!.messageMetadata.reasoningMs, 1)

    // Another model than the store's is refused.
    const other = await client
      .post(`/api/v1/stores/${store.id}/assistant/chat`)
      .json({ ...ask('Oi'), model: 'openai:not-offered' })
      .loginAs(manager)
    other.assertStatus(422)
    assert.equal(other.body().code, 'E_ASSISTANT_MODEL')

    // The model saw the context first, then its own call's result.
    const firstUser = calls[0].prompt.find((message) => message.role === 'user')!
    const context = firstUser.content[0] as { type: 'text'; text: string }
    assert.include(context.text, 'Tela aberta no painel: Cardápio')
    assert.include(context.text, '(gerente)')
    const [result] = toolResults(calls[1])
    assert.equal(result.output.type, 'json')
    assert.equal(result.output.value.items[0].name, 'Pastel de Carne')

    const saved = await AssistantConversation.findOrFail(body.id)
    assert.equal(saved.title, 'Quanto custa o pastel de carne?')
    assert.isNull(saved.busyUntil)
    // The context stays out of what the panel shows.
    assert.notInclude(JSON.stringify(saved.uiMessages[0].parts), '<contexto>')

    const list = await client
      .get(`/api/v1/stores/${store.id}/assistant/conversations`)
      .loginAs(manager)
    assert.deepEqual(
      list.body().data.map((row: any) => row.id),
      [body.id]
    )
    const detail = await client
      .get(`/api/v1/stores/${store.id}/assistant/conversations/${body.id}`)
      .loginAs(manager)
    assert.deepEqual(
      detail.body().data.messages.map((m: any) => m.role),
      ['user', 'assistant']
    )
  })

  test('attendants get "Sem permissão" from manager tools, not the data', async ({
    client,
    assert,
  }) => {
    const { store, attendant, turns, calls } = await setup()
    turns.push(say.tool('pay_later_open', {}), say.text('Isso fica com os gerentes.'))

    const stream = await streamOf(
      client
        .post(`/api/v1/stores/${store.id}/assistant/chat`)
        .json(ask('Quem está devendo?'))
        .loginAs(attendant)
    )
    const error = stream.find((chunk) => chunk.type === 'tool-output-error')
    assert.include(error!.errorText, 'Sem permissão')
    const [result] = toolResults(calls[1])
    assert.equal(result.output.type, 'error-text')
  })

  test('a write waits for approval, runs once when approved', async ({ client, assert }) => {
    const { store, manager, carne, turns, calls } = await setup()
    turns.push(
      say.tool('update_items', {
        changes: [{ itemId: carne.id, isAvailable: false }],
        summary: 'Pausar carne',
      }),
      say.text('Pausei o pastel de carne.')
    )

    const body = ask('Pausa o pastel de carne')
    const first = await streamOf(
      client.post(`/api/v1/stores/${store.id}/assistant/chat`).json(body).loginAs(manager)
    )
    const preview = first.find((chunk) => chunk.type === 'data-approval')!.data
    assert.deepEqual(preview.rows[0].before, { price: 15, isAvailable: true })
    assert.deepEqual(preview.rows[0].after, { price: 15, isAvailable: false })
    assert.exists(first.find((chunk) => chunk.type === 'tool-approval-request'))
    assert.isTrue(await field(Item.findOrFail(carne.id), 'isAvailable'))
    assert.lengthOf(calls, 1)

    const approve = answer(body.id, first, true)
    const second = await streamOf(
      client.post(`/api/v1/stores/${store.id}/assistant/chat`).json(approve).loginAs(manager)
    )
    assert.deepEqual(second.find((chunk) => chunk.type === 'tool-output-available')!.output, {
      updated: 1,
    })
    assert.isFalse(await field(Item.findOrFail(carne.id), 'isAvailable'))
    assert.lengthOf(calls, 2)
    assert.deepEqual(toolResults(calls[1])[0].output, { type: 'json', value: { updated: 1 } })

    // The same approval again: nothing runs, the model isn't called.
    const again = await client
      .post(`/api/v1/stores/${store.id}/assistant/chat`)
      .json(approve)
      .loginAs(manager)
    again.assertStatus(200)
    assert.lengthOf(calls, 2)
    const saved = await AssistantConversation.findOrFail(body.id)
    const part = (saved.uiMessages.at(-1)!.parts as any[]).find(
      (p) => p.type === 'tool-update_items'
    )
    assert.equal(part.state, 'output-available')
  })

  test('a denied write changes nothing and the model is told', async ({ client, assert }) => {
    const { store, manager, carne, turns, calls } = await setup()
    turns.push(
      say.tool('update_items', {
        changes: [{ itemId: carne.id, price: 99 }],
        summary: 'Carne a 99',
      }),
      say.text('Tudo bem.')
    )
    const body = ask('Carne a 99')
    const first = await streamOf(
      client.post(`/api/v1/stores/${store.id}/assistant/chat`).json(body).loginAs(manager)
    )
    const second = await streamOf(
      client
        .post(`/api/v1/stores/${store.id}/assistant/chat`)
        .json(answer(body.id, first, false))
        .loginAs(manager)
    )

    assert.isTrue(second.some((chunk) => chunk.type === 'tool-output-denied'))
    assert.equal(await field(Item.findOrFail(carne.id), 'price'), 15)
    const [result] = toolResults(calls[1])
    assert.equal(result.output.type, 'execution-denied')
    assert.equal(result.output.reason, DENIED_REASON)
  })

  test('a write left unanswered is declined by the next message', async ({ client, assert }) => {
    const { store, manager, carne, turns, calls } = await setup()
    turns.push(
      say.tool('update_items', { changes: [{ itemId: carne.id, price: 20 }], summary: 'x' })
    )
    const body = ask('Carne a 20')
    await client.post(`/api/v1/stores/${store.id}/assistant/chat`).json(body).loginAs(manager)

    await client
      .post(`/api/v1/stores/${store.id}/assistant/chat`)
      .json(ask('Deixa pra lá, e o queijo?', body.id))
      .loginAs(manager)
    // Declined with the reason, before the new question.
    const [result] = toolResults(calls[1])
    assert.deepEqual(result.output, { type: 'error-text', value: SKIPPED_REASON })
    assert.equal(await field(Item.findOrFail(carne.id), 'price'), 15)
  })

  test('every read tool answers with real data', async ({ client, assert }) => {
    const { store, manager, carne, turns, calls } = await setup()
    store.inventoryEnabled = true
    await store.save()
    await Ingredient.create({
      storeId: store.id,
      name: 'Massa',
      unit: 'un',
      stockQuantity: 3,
      minStock: 5,
    })
    await client
      .post(`/api/v1/stores/${store.id}/orders`)
      .json({
        customer: { name: 'Ana' },
        lines: [{ itemId: carne.id, quantity: 2 }],
        counterMethod: 'pix',
      })
      .loginAs(manager)
    const day = today()
    turns.push([
      ...say.tool('sales_summary', { from: day, to: day }),
      ...say.tool('item_sales', {
        query: 'carne',
        from: day,
        to: day,
        compareFrom: day,
        compareTo: day,
      }),
      ...say.tool('stock_forecast', { baseFrom: day, baseTo: day, days: 1 }),
      ...say.tool('orders_now', {}),
      ...say.tool('find_orders', { from: day, to: day, search: 'Ana' }),
      ...say.tool('pay_later_open', {}),
      ...say.tool('menu_items', {}),
    ])

    const stream = await streamOf(
      client.post(`/api/v1/stores/${store.id}/assistant/chat`).json(ask('Tudo')).loginAs(manager)
    )
    assert.notExists(stream.find((chunk) => chunk.type === 'tool-output-error'))
    const nameOf = (id: string) =>
      stream.find((c) => c.type === 'tool-input-available' && c.toolCallId === id)!.toolName
    const outputs = new Map<string, any>(
      stream
        .filter((chunk) => chunk.type === 'tool-output-available')
        .map((chunk) => [nameOf(chunk.toolCallId), chunk.output])
    )
    assert.equal(outputs.size, 7)
    assert.equal(outputs.get('sales_summary').summary.orders, 1)
    assert.equal(outputs.get('sales_summary').summary.revenue, 30)
    assert.equal(outputs.get('item_sales').period.units, 2)
    assert.deepEqual(outputs.get('item_sales').matches, ['Pastel de Carne'])
    assert.equal(outputs.get('stock_forecast').ingredients[0].status, 'low')
    assert.equal(outputs.get('orders_now').orders[0].customerName, 'Ana')
    assert.equal(outputs.get('find_orders').total, 1)
    assert.equal(outputs.get('pay_later_open').count, 0)
    assert.lengthOf(outputs.get('menu_items').items, 3)
    assert.lengthOf(toolResults(calls[1]), 7)
  })

  test('stock entries and new menu items wait for approval too', async ({ client, assert }) => {
    const { store, manager, turns } = await setup()
    const massa = await Ingredient.create({
      storeId: store.id,
      name: 'Massa',
      unit: 'un',
      stockQuantity: 3,
      minStock: 0,
    })
    turns.push([
      ...say.tool('record_stock', { ingredientId: massa.id, type: 'purchase', quantity: 10 }),
      ...say.tool('create_menu_items', {
        categories: [
          {
            name: 'Pastéis',
            items: [
              { name: 'Pastel de Palmito', price: 16 },
              { name: 'Pastel de Carne', price: 15 },
            ],
          },
          {
            name: 'Doces',
            items: [{ name: 'Pastel de Chocolate', price: 18, description: 'Com granulado' }],
          },
        ],
      }),
    ])
    const body = ask('Lança a massa e cria os itens da foto')
    const first = await streamOf(
      client.post(`/api/v1/stores/${store.id}/assistant/chat`).json(body).loginAs(manager)
    )
    const previews = first
      .filter((chunk) => chunk.type === 'data-approval')
      .map((chunk) => chunk.data)
    assert.deepInclude(previews[0], { kind: 'record_stock', before: 3, after: 13 })
    assert.deepEqual(
      previews[1].categories.map((c: any) => c.isNew),
      [false, true]
    )

    await client
      .post(`/api/v1/stores/${store.id}/assistant/chat`)
      .json(answer(body.id, first, true))
      .loginAs(manager)

    await massa.refresh()
    assert.equal(massa.stockQuantity, 13)
    const created = await Item.query()
      .whereHas('category', (q) => q.where('store_id', store.id))
      .whereIn('name', ['Pastel de Palmito', 'Pastel de Chocolate'])
    assert.lengthOf(created, 2)
    assert.isTrue(created.every((row) => !row.isAvailable))
    // "Pastel de Carne" already existed in Pastéis: not duplicated.
    const carnes = await Item.query()
      .whereHas('category', (q) => q.where('store_id', store.id))
      .where('name', 'Pastel de Carne')
    assert.lengthOf(carnes, 1)
  })

  test('store, day and order tools: read, and approved writes', async ({ client, assert }) => {
    const { store, manager, carne, turns } = await setup()
    store.merge({ status: 'open', pickupEtaMinutes: 15 })
    await store.save()
    const created = await client
      .post(`/api/v1/stores/${store.id}/orders`)
      .json({ customer: { name: 'Ana' }, lines: [{ itemId: carne.id, quantity: 1 }] })
      .loginAs(manager)
    const number = created.body().data.number as number

    turns.push([
      ...say.tool('store_status', {}),
      ...say.tool('today_overview', {}),
      ...say.tool('order_details', { number }),
    ])
    const reads = await streamOf(
      client
        .post(`/api/v1/stores/${store.id}/assistant/chat`)
        .json(ask('Como está?'))
        .loginAs(manager)
    )
    assert.notExists(reads.find((chunk) => chunk.type === 'tool-output-error'))
    const [status, day, details] = reads
      .filter((chunk) => chunk.type === 'tool-output-available')
      .map((chunk) => chunk.output)
    assert.include(status, { status: 'open', pickupEtaMinutes: 15 })
    assert.equal(day.sales.orders, 1)
    assert.notProperty(day, 'pace')
    assert.equal(details.customerName, 'Ana')
    assert.equal(details.lines[0].name, carne.name)

    turns.push([
      ...say.tool('set_store_status', { status: 'closed' }),
      ...say.tool('set_pickup_time', { minutes: 30 }),
      ...say.tool('update_item_details', {
        itemId: carne.id,
        description: 'Carne moída temperada.',
      }),
      ...say.tool('cancel_order', { number }),
    ])
    const body = ask('Fecha a loja, 30 min, descrição e cancela o pedido')
    const first = await streamOf(
      client.post(`/api/v1/stores/${store.id}/assistant/chat`).json(body).loginAs(manager)
    )
    const previews = first
      .filter((chunk) => chunk.type === 'data-approval')
      .map((chunk) => chunk.data)
    assert.deepEqual(
      previews.map((preview: any) => preview.kind),
      ['store_status', 'pickup_time', 'item_details', 'cancel_order']
    )
    assert.equal(previews[3].customerName, 'Ana')
    await client
      .post(`/api/v1/stores/${store.id}/assistant/chat`)
      .json(answer(body.id, first, true))
      .loginAs(manager)

    await store.refresh()
    assert.equal(store.status, 'closed')
    assert.equal(store.pickupEtaMinutes, 30)
    assert.equal(await field(Item.findOrFail(carne.id), 'description'), 'Carne moída temperada.')
    const order = await db.from('orders').where('id', created.body().data.id).first()
    assert.equal(order.status, 'cancelled')
  })

  test('attendants open and close the store but cannot cancel orders', async ({
    client,
    assert,
  }) => {
    const { store, attendant, turns } = await setup()
    turns.push([
      ...say.tool('set_store_status', { status: 'closed' }),
      ...say.tool('cancel_order', { number: 1 }),
    ])
    const stream = await streamOf(
      client
        .post(`/api/v1/stores/${store.id}/assistant/chat`)
        .json(ask('Fecha e cancela'))
        .loginAs(attendant)
    )
    assert.deepEqual(
      stream.filter((chunk) => chunk.type === 'data-approval').map((chunk) => chunk.data.kind),
      ['store_status']
    )
    assert.include(
      stream.find((chunk) => chunk.type === 'tool-output-error')!.errorText,
      'Sem permissão'
    )
  })

  test('a reply cut off mid-thought or a failed one never breaks the next message', async ({
    client,
    assert,
  }) => {
    const { store, manager, calls } = await setup()
    const id = randomUUID()
    await AssistantConversation.create({
      id,
      storeId: store.id,
      userId: manager.id,
      title: 'Quebrada',
      uiMessages: [
        { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'Oi' }] },
        {
          id: 'a1',
          role: 'assistant',
          parts: [
            { type: 'step-start' },
            {
              type: 'reasoning',
              text: '**Pensando**',
              state: 'streaming',
              providerMetadata: { openai: { itemId: 'rs_cut' } },
            },
            {
              type: 'text',
              text: 'Começo de respo',
              state: 'streaming',
              providerMetadata: { openai: { itemId: 'msg_cut' } },
            },
          ],
        },
        { id: 'u2', role: 'user', parts: [{ type: 'text', text: 'E aí?' }] },
        { id: 'a2', role: 'assistant', parts: [{ type: 'step-start' }] },
      ] as any,
    })

    const response = await client
      .post(`/api/v1/stores/${store.id}/assistant/chat`)
      .json(ask('De novo', id))
      .loginAs(manager)
    response.assertStatus(200)

    const prompt = JSON.stringify(calls[0].prompt)
    assert.notInclude(prompt, 'rs_cut')
    assert.notInclude(prompt, 'msg_cut')
    assert.include(prompt, 'Começo de respo')
    assert.deepEqual(
      calls[0].prompt.map((message) => message.role),
      ['system', 'user', 'assistant', 'user', 'user']
    )
    // The empty reply is gone from the saved conversation too.
    const saved = await AssistantConversation.findOrFail(id)
    assert.notInclude(
      saved.uiMessages.map((message) => message.id),
      'a2'
    )
  })

  test('conversations are private to their owner and store', async ({ client, assert }) => {
    const { store, manager, attendant } = await setup()
    const body = ask('Oi')
    await client.post(`/api/v1/stores/${store.id}/assistant/chat`).json(body).loginAs(manager)

    const url = `/api/v1/stores/${store.id}/assistant/conversations/${body.id}`
    assert.equal(await statusOf(client.get(url).loginAs(attendant)), 404)
    assert.equal(await statusOf(client.delete(url).loginAs(attendant)), 404)
    // Writing into someone else's conversation id doesn't take it over.
    const chat = `/api/v1/stores/${store.id}/assistant/chat`
    assert.equal(await statusOf(client.post(chat).json(ask('Oi', body.id)).loginAs(attendant)), 404)

    const other = await createMenuStore()
    await linkUser(other.store, manager, StoreRole.MANAGER)
    const elsewhere = `/api/v1/stores/${other.store.id}/assistant/conversations/${body.id}`
    assert.equal(await statusOf(client.get(elsewhere).loginAs(manager)), 404)

    assert.equal(await statusOf(client.delete(url).loginAs(manager)), 200)
    assert.equal(await statusOf(client.get(url).loginAs(manager)), 404)
  })

  test('the daily limit, one request at a time and bad messages', async ({ client, assert }) => {
    const { store, manager } = await setup()
    const chat = `/api/v1/stores/${store.id}/assistant/chat`
    const body = ask('Oi')
    await client.post(chat).json(body).loginAs(manager)

    await db
      .from('assistant_conversations')
      .where('id', body.id)
      .update({ busy_until: new Date(Date.now() + 60_000) })
    const busy = await client.post(chat).json(ask('De novo', body.id)).loginAs(manager)
    busy.assertStatus(409)
    assert.equal(busy.body().code, 'E_ASSISTANT_BUSY')

    const empty = { id: randomUUID(), message: { id: 'x', role: 'user', parts: [] } }
    assert.equal(await statusOf(client.post(chat).json(empty).loginAs(manager)), 422)
    const pdf = {
      id: randomUUID(),
      message: {
        id: 'x',
        role: 'user',
        parts: [
          { type: 'file', mediaType: 'application/pdf', url: 'data:application/pdf;base64,AAAA' },
        ],
      },
    }
    assert.equal(await statusOf(client.post(chat).json(pdf).loginAs(manager)), 422)

    await db.table('assistant_usages').multiInsert(
      Array.from({ length: 199 }, () => ({
        store_id: store.id,
        model: 'test',
        created_at: new Date(),
      }))
    )
    const limited = await client.post(chat).json(ask('Oi')).loginAs(manager)
    limited.assertStatus(429)
    assert.equal(limited.body().code, 'E_ASSISTANT_LIMIT')
  })
})
