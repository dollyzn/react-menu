import { randomUUID } from 'node:crypto'
import app from '@adonisjs/core/services/app'
import db from '@adonisjs/lucid/services/db'
import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import StoreRole from '#enums/store_role'
import OrderChannel from '#enums/order_channel'
import PaymentMethod from '#enums/payment_method'
import Order from '#models/order'
import StorePartner from '#models/store_partner'
import OrderService from '#services/order_service'
import AssistantConversation from '#models/assistant_conversation'
import Ingredient from '#models/ingredient'
import Addon from '#models/addon'
import Item from '#models/item'
import OptionGroupService from '#services/option_group_service'
import Store from '#models/store'
import AssistantModels from '#assistant/models'
import type { AssistantProvider } from '@react-menu/contracts'
import { say, scriptedModel, type ModelCall, type StreamPart } from '#assistant/scripted_model'
import { DENIED_REASON, SKIPPED_REASON } from '#services/assistant_service'
import { createMenuStore, createUser, linkUser } from '#tests/helpers/fixtures'
import { emptyDatabase } from '#tests/helpers/database'

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

/** The outputs of a stream by tool name: the tools of one step finish in any order. */
function outputsByTool(stream: Chunk[]) {
  const nameOf = (id: string) =>
    stream.find((c) => c.type === 'tool-input-available' && c.toolCallId === id)!.toolName
  return new Map<string, any>(
    stream
      .filter((chunk) => chunk.type === 'tool-output-available')
      .map((chunk) => [nameOf(chunk.toolCallId), chunk.output])
  )
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
  group.each.setup(() => emptyDatabase)
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
    const outputs = outputsByTool(stream)
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
    const { store, manager, attendant, carne, turns } = await setup()
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
    const outputs = outputsByTool(reads)
    const status = outputs.get('store_status')
    const day = outputs.get('today_overview')
    const details = outputs.get('order_details')
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
    // Closed through the assistant, the rest of the team hears it as from the panel.
    const notified = await db
      .from('notifications')
      .where('type', 'store.status_changed')
      .select('user_id')
    assert.includeMembers(
      notified.map((row) => row.user_id),
      [attendant.id]
    )
    assert.notInclude(
      notified.map((row) => row.user_id),
      manager.id
    )
  })

  test("attendants check whether the store is open, but opening, closing and stock are managers'", async ({
    client,
    assert,
  }) => {
    const { store, attendant, turns } = await setup()
    turns.push([
      ...say.tool('store_status', {}),
      ...say.tool('set_store_status', { status: 'closed' }),
      ...say.tool('stock_forecast', { baseFrom: '2026-11-07', baseTo: '2026-11-07', days: 1 }),
      ...say.tool('cancel_order', { number: 1 }),
    ])
    const stream = await streamOf(
      client
        .post(`/api/v1/stores/${store.id}/assistant/chat`)
        .json(ask('Tá aberta? Fecha, vê o estoque e cancela'))
        .loginAs(attendant)
    )
    assert.isUndefined(stream.find((chunk) => chunk.type === 'data-approval'))
    assert.isDefined(
      stream.find((chunk) => chunk.type === 'tool-output-available' && chunk.output?.status)
    )
    const denied = stream.filter((chunk) => chunk.type === 'tool-output-error')
    assert.lengthOf(denied, 3)
    for (const chunk of denied) assert.include(chunk.errorText, 'Sem permissão')
    await store.refresh()
    assert.notEqual(store.status, 'closed')
  })

  test('an approval answered is not a new question, and a change made is never asked again', async ({
    client,
    assert,
  }) => {
    const { store, manager, turns } = await setup()
    const url = `/api/v1/stores/${store.id}/assistant/chat`
    turns.push([...say.tool('set_pickup_time', { minutes: 30 })])
    turns.push([...say.text('Pronto, 30 minutos.')])
    const body = ask('Tempo de retirada 30')
    const first = await streamOf(client.post(url).json(body).loginAs(manager))
    await streamOf(
      client
        .post(url)
        .json(answer(body.id, first, true))
        .loginAs(manager)
    )
    await store.refresh()
    assert.equal(store.pickupEtaMinutes, 30)

    const status = await client.get(`/api/v1/stores/${store.id}/assistant`).loginAs(manager)
    assert.equal(status.body().data.usage.used, 1)

    // "Gerar de novo" on that question would drop the change and make it again.
    const again = await client.post(url).json(body).loginAs(manager)
    again.assertStatus(409)
    assert.equal(again.body().code, 'E_ASSISTANT_CHANGED')
  })

  test('managers make a choice group optional for some items, and add a group to others', async ({
    client,
    assert,
  }) => {
    const { store, manager, carne, queijo, coca, catupiry, turns, calls } = await setup()
    const mussarela = await Addon.create({ storeId: store.id, name: 'Mussarela', price: 0 })
    const oregano = await Addon.create({ storeId: store.id, name: 'Orégano', price: 1 })
    const groups = new OptionGroupService()
    const cheese = await groups.create(store.id, {
      name: 'Escolha o queijo',
      minChoices: 1,
      maxChoices: 1,
      replacesInName: 'Queijo',
      options: [
        { addonId: mussarela.id, price: 0 },
        { addonId: catupiry.id, price: 0 },
      ],
    })
    const optionals = await groups.create(store.id, {
      name: 'Opcionais',
      minChoices: 0,
      maxChoices: 1,
      options: [{ addonId: oregano.id, price: null }],
    })
    await db.table('item_option_groups').multiInsert([
      { item_id: carne.id, option_group_id: cheese.id, order: 0 },
      { item_id: queijo.id, option_group_id: cheese.id, order: 0 },
    ])
    const url = `/api/v1/stores/${store.id}/assistant/chat`

    // The groups, with who uses them.
    turns.push([...say.tool('option_groups', {})])
    turns.push([...say.text('Ok.')])
    await streamOf(client.post(url).json(ask('Quais grupos?')).loginAs(manager))
    const read = toolResults(calls[1]).find((result) => result.toolName === 'option_groups')!
    const listed = read.output.value.groups.find((row: any) => row.name === 'Escolha o queijo')
    assert.equal(listed.items.count, 2)
    assert.equal(listed.minChoices, 1)

    // An optional copy only for one item, in the original's place.
    turns.push([
      ...say.tool('create_option_group', {
        name: 'Escolha o queijo (opcional)',
        minChoices: 0,
        maxChoices: 1,
        copyFrom: cheese.id,
        itemIds: [carne.id],
        replaceGroupId: cheese.id,
      }),
      ...say.tool('update_item_extras', { itemIds: [coca.id], addGroupIds: [optionals.id] }),
    ])
    turns.push([...say.text('Feito.')])
    const body = ask('Queijo opcional no de carne e opcionais na coca')
    const first = await streamOf(client.post(url).json(body).loginAs(manager))
    const previews = first
      .filter((chunk) => chunk.type === 'data-approval')
      .map((chunk) => chunk.data)
    assert.deepEqual(
      previews.map((preview: any) => preview.kind),
      ['new_option_group', 'item_extras']
    )
    assert.equal(previews[0].copyOf, 'Escolha o queijo')
    assert.deepEqual(previews[0].items, ['Pastel de Carne'])
    assert.deepEqual(previews[1].rows[0].groups, { before: [], after: ['Opcionais'] })
    await client
      .post(url)
      .json(answer(body.id, first, true))
      .loginAs(manager)

    const groupsOf = async (itemId: string) => {
      const rows = await db
        .from('item_option_groups')
        .join('option_groups', 'option_groups.id', 'item_option_groups.option_group_id')
        .where('item_id', itemId)
        .select('option_groups.name', 'option_groups.min_choices', 'option_groups.replaces_in_name')
      return rows.map((row) => `${row.name}:${row.min_choices}:${row.replaces_in_name ?? ''}`)
    }
    assert.deepEqual(await groupsOf(carne.id), ['Escolha o queijo (opcional):0:Queijo'])
    assert.deepEqual(await groupsOf(queijo.id), ['Escolha o queijo:1:Queijo'])
    assert.deepEqual(await groupsOf(coca.id), ['Opcionais:0:'])

    // Editing the shared group changes it for everyone who uses it.
    turns.push([...say.tool('update_option_group', { groupId: cheese.id, minChoices: 0 })])
    turns.push([...say.text('Pronto.')])
    const edit = ask('Deixa o queijo opcional em todos')
    const card = await streamOf(client.post(url).json(edit).loginAs(manager))
    const preview = card.find((chunk) => chunk.type === 'data-approval')!.data
    assert.equal(preview.kind, 'option_group')
    assert.deepEqual(preview.items, { count: 1, names: ['Pastel de Queijo'] })
    assert.equal(preview.after.minChoices, 0)
    await client
      .post(url)
      .json(answer(edit.id, card, true))
      .loginAs(manager)
    assert.deepEqual(await groupsOf(queijo.id), ['Escolha o queijo:0:Queijo'])
  })

  test('a group change is checked before its card and applied only as the card showed it', async ({
    client,
    assert,
  }) => {
    const { store, manager, carne, catupiry, turns } = await setup()
    const mussarela = await Addon.create({ storeId: store.id, name: 'Mussarela', price: 0 })
    const groups = new OptionGroupService()
    const cheese = await groups.create(store.id, {
      name: 'Escolha o queijo',
      minChoices: 1,
      maxChoices: 2,
      options: [
        { addonId: mussarela.id, price: 0 },
        { addonId: catupiry.id, price: 0 },
      ],
    })
    const url = `/api/v1/stores/${store.id}/assistant/chat`

    // Up to 2 picks with 1 option left: refused before any card.
    turns.push([
      ...say.tool('update_option_group', { groupId: cheese.id, removeOptions: [catupiry.id] }),
    ])
    const refused = await streamOf(client.post(url).json(ask('Tira o catupiry')).loginAs(manager))
    assert.isUndefined(refused.find((chunk) => chunk.type === 'data-approval'))
    assert.include(
      refused.find((chunk) => chunk.type === 'tool-output-error')!.errorText,
      'o máximo não pode passar'
    )

    // A copy with an empty option list (models fill optional arrays) copies the options.
    turns.push([
      ...say.tool('create_option_group', {
        name: 'Queijo opcional',
        minChoices: 0,
        maxChoices: 1,
        copyFrom: cheese.id,
        options: [],
        itemIds: [carne.id],
      }),
    ])
    const copy = await streamOf(client.post(url).json(ask('Copia opcional')).loginAs(manager))
    const card = copy.find((chunk) => chunk.type === 'data-approval')!.data
    assert.deepEqual(
      card.group.options.map((option: { name: string }) => option.name),
      ['Mussarela', 'Catupiry']
    )

    // Edited on the panel after the card: approving changes nothing.
    turns.push([...say.tool('update_option_group', { groupId: cheese.id, minChoices: 0 })])
    const body = ask('Deixa opcional')
    const first = await streamOf(client.post(url).json(body).loginAs(manager))
    await groups.update(store.id, cheese.id, {
      name: 'Escolha o queijo',
      minChoices: 1,
      maxChoices: 1,
      options: [{ addonId: mussarela.id, price: 0 }],
    })
    const applied = await streamOf(
      client
        .post(url)
        .json(answer(body.id, first, true))
        .loginAs(manager)
    )
    assert.include(
      applied.find((chunk) => chunk.type === 'tool-output-error')!.errorText,
      'mudou depois do cartão'
    )
    const saved = await groups.find(store.id, cheese.id)
    assert.equal(saved.minChoices, 1)
  })

  test('attendants cannot read or change choice groups', async ({ client, assert }) => {
    const { store, attendant, turns } = await setup()
    turns.push([...say.tool('option_groups', {})])
    turns.push([...say.text('Ok.')])
    const stream = await streamOf(
      client
        .post(`/api/v1/stores/${store.id}/assistant/chat`)
        .json(ask('Grupos?'))
        .loginAs(attendant)
    )
    assert.include(
      stream.find((chunk) => chunk.type === 'tool-output-error')!.errorText,
      'Sem permissão'
    )
  })

  test('suggests next questions after an answer, never while a change waits', async ({
    client,
    assert,
  }) => {
    const { store, manager, attendant, carne, turns } = await setup()
    const base = `/api/v1/stores/${store.id}/assistant`
    turns.push([...say.text('Vendeu **R$ 100**.')])
    const body = ask('Quanto vendi ontem?')
    await streamOf(client.post(`${base}/chat`).json(body).loginAs(manager))

    turns.push([
      ...say.text(
        JSON.stringify({
          suggestions: [
            '"E anteontem?"',
            '1. Qual item mais vendeu?',
            '30 dias: compara com antes?',
          ],
        })
      ),
    ])
    const url = `${base}/conversations/${body.id}/suggestions`
    const response = await client.post(url).json({}).loginAs(manager)
    response.assertStatus(200)
    assert.deepEqual(response.body().data.suggestions, [
      'E anteontem?',
      'Qual item mais vendeu?',
      '30 dias: compara com antes?',
    ])
    // Asked once per answer: again, it comes from the answer itself (no model call).
    const again = await client.post(url).json({}).loginAs(manager)
    assert.deepEqual(again.body().data.suggestions, response.body().data.suggestions)
    // Not a question: the day's count stays.
    const status = await client.get(base).loginAs(manager)
    assert.equal(status.body().data.usage.used, 1)
    // Someone else's conversation isn't found.
    assert.equal(await statusOf(client.post(url).json({}).loginAs(attendant)), 404)

    // While a change waits for approval, the card is the next step.
    turns.push([
      ...say.tool('update_items', {
        changes: [{ itemId: carne.id, isAvailable: false }],
        summary: 'Pausar',
      }),
    ])
    await streamOf(client.post(`${base}/chat`).json(ask('Pausa', body.id)).loginAs(manager))
    const waiting = await client.post(url).json({}).loginAs(manager)
    assert.deepEqual(waiting.body().data.suggestions, [])
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

  test('partners: sales, commission marked paid and a cancellation answered, managers only', async ({
    client,
    assert,
  }) => {
    const { store, manager, attendant, carne, turns } = await setup()
    store.merge({ status: 'open' })
    await store.save()
    const partner = await StorePartner.create({
      storeId: store.id,
      name: 'Açaí da Praça',
      commissionType: 'percent',
      commissionValue: 10,
      commissionUpdatedAt: DateTime.now(),
      cancelPolicy: 'never',
      catalogMode: 'all',
    })
    const seller = await createUser({ name: 'Maria do Açaí' })
    await store.related('users').attach({
      [seller.id]: { role: StoreRole.PARTNER, partner_id: partner.id, partner_role: 'manager' },
    })
    // Two sales: one handed over (commission to pay), one in the kitchen and asked to be cancelled.
    const orders = await app.container.make(OrderService)
    const sell = async () => {
      const order = await orders.create(
        store.id,
        {
          channel: OrderChannel.PARTNER,
          paymentMethod: PaymentMethod.COUNTER,
          customer: { name: 'Ana' },
          lines: [{ itemId: carne.id, quantity: 2 }],
          partnerId: partner.id,
        },
        seller
      )
      await Order.query()
        .where('id', order.id)
        .update({ payment_status: 'paid', amount_paid: order.total, status: 'received' })
      return order
    }
    const handed = await sell()
    await Order.query()
      .where('id', handed.id)
      .update({ status: 'completed', completed_at: new Date() })
    const asked = await sell()
    const request = await client
      .post(`/api/v1/stores/${store.id}/partner/orders/${asked.id}/cancel-request`)
      .json({ reason: 'Cliente desistiu' })
      .loginAs(seller)
    request.assertStatus(200)

    turns.push([...say.tool('partners', {}), ...say.tool('cancel_requests', {})])
    const reads = await streamOf(
      client
        .post(`/api/v1/stores/${store.id}/assistant/chat`)
        .json(ask('Como estão os parceiros?'))
        .loginAs(manager)
    )
    const outputs = outputsByTool(reads)
    const partners = outputs.get('partners')
    const requests = outputs.get('cancel_requests')
    assert.deepInclude(partners.partners[0], {
      name: 'Açaí da Praça',
      orders: 2,
      sales: 60,
      commission: 6,
      toPay: { orders: 1, amount: 3 },
    })
    assert.deepInclude(requests.requests[0], {
      number: asked.number,
      partnerName: 'Açaí da Praça',
      reason: 'Cliente desistiu',
    })

    turns.push([
      ...say.tool('settle_partner_commission', { partner: 'açaí', until: today(), note: 'Pix' }),
      ...say.tool('answer_cancel_request', { number: asked.number, approve: true }),
    ])
    const body = ask('Paga a comissão do açaí e aprova o cancelamento')
    const first = await streamOf(
      client.post(`/api/v1/stores/${store.id}/assistant/chat`).json(body).loginAs(manager)
    )
    const previews = first
      .filter((chunk) => chunk.type === 'data-approval')
      .map((chunk) => chunk.data)
    assert.deepInclude(previews[0], { kind: 'settle_partner', orders: 1, total: 3 })
    assert.deepInclude(previews[1], {
      kind: 'cancel_request',
      approve: true,
      reason: 'Cliente desistiu',
    })
    await streamOf(
      client
        .post(`/api/v1/stores/${store.id}/assistant/chat`)
        .json(answer(body.id, first, true))
        .loginAs(manager)
    )
    assert.isNotNull(await field(Order.findOrFail(handed.id), 'partnerSettlementId'))
    assert.equal(await field(Order.findOrFail(asked.id), 'status'), 'cancelled')

    // Attendants of the store don't reach partners.
    turns.push(say.tool('partners', {}))
    const denied = await streamOf(
      client
        .post(`/api/v1/stores/${store.id}/assistant/chat`)
        .json(ask('E os parceiros?'))
        .loginAs(attendant)
    )
    assert.exists(denied.find((chunk) => chunk.type === 'tool-output-error'))
    // Partners never reach the assistant.
    const partnerChat = await client
      .post(`/api/v1/stores/${store.id}/assistant/chat`)
      .json(ask('Oi'))
      .loginAs(seller)
    partnerChat.assertStatus(403)
  })
})
