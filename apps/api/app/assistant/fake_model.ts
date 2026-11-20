import { SUGGESTIONS_MARKER } from '#assistant/prompt'
import { DateTime } from 'luxon'
import { BUSINESS_TIMEZONE } from '#services/order_service'
import { type ModelCall, say, scriptedModel, type StreamPart } from '#assistant/scripted_model'

type Message = ModelCall['prompt'][number]
type ToolResult = { toolName: string; output: { type: string; value?: unknown; reason?: string } }

const brl = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const dayMonth = (iso: string) => DateTime.fromISO(iso).toFormat('dd/MM')

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** The person's last question (not the context block the server adds). */
function lastQuestion(prompt: Message[]) {
  for (const message of [...prompt].reverse()) {
    if (message.role !== 'user') continue
    const text = message.content
      .map((part) => (part.type === 'text' && !part.text.startsWith('<contexto>') ? part.text : ''))
      .join(' ')
      .trim()
    if (text) return normalize(text)
  }
  return ''
}

const valueOf = (result: ToolResult) =>
  result.output.type === 'json' || result.output.type === 'text'
    ? (result.output.value as any)
    : null

/**
 * Development and e2e only (ASSISTANT_FAKE_MODEL): picks a tool by keywords
 * in the last question and sums up the result in a sentence. It goes through
 * the same tools, approvals and stream as a real model, without a key.
 */
export function fakeModel() {
  return scriptedModel(
    ({ prompt }) => {
      if (isSuggestionsRequest(prompt))
        return say.text(JSON.stringify({ suggestions: nextQuestions(prompt) }))
      const last = prompt.at(-1)
      if (last?.role === 'tool') {
        const results = last.content.filter((part) => part.type === 'tool-result') as ToolResult[]
        return followUp(prompt, results) ?? say.text(summarize(results))
      }
      return plan(lastQuestion(prompt))
    },
    { provider: 'fake', modelId: 'assistente-de-teste' }
  )
}

const isSuggestionsRequest = (prompt: Message[]) =>
  prompt.some(
    (message) => message.role === 'system' && message.content.includes(SUGGESTIONS_MARKER)
  )

/** The follow-ups of the last answer, by the tools it used. */
function nextQuestions(prompt: Message[]) {
  const transcript = JSON.stringify(prompt.at(-1)?.content ?? '')
  if (transcript.includes('sales_summary'))
    return ['E o horário de pico?', 'Qual item mais cresceu?', 'Compara com o mês passado']
  if (transcript.includes('stock_forecast'))
    return ['Quanto preciso comprar?', 'Quais itens usam esse insumo?', 'Lança uma compra']
  if (transcript.includes('menu_items'))
    return ['Quais itens estão pausados?', 'Quais grupos cada item usa?', 'Aumenta R$ 1 nos doces']
  if (transcript.includes('orders_now'))
    return ['Tem pedido atrasado?', 'Aumenta o tempo de retirada', 'Quem está com fiado?']
  return ['Como está o dia até agora?', 'O que pode acabar no sábado?', 'Quanto vendi ontem?']
}

function plan(q: string): StreamPart[] {
  const today = DateTime.now().setZone(BUSINESS_TIMEZONE)
  const day = (date: DateTime) => date.toISODate()!
  const lastWeek = { from: day(today.minus({ days: 6 })), to: day(today) }

  if (/(fecha|fechar|abre|abrir) a loja/.test(q)) {
    const status = /abr/.test(q.match(/(fecha|fechar|abre|abrir) a loja/)![1]) ? 'open' : 'closed'
    return [
      ...say.text(`Vou ${status === 'open' ? 'abrir' : 'fechar'} a loja. Confira:`),
      ...say.tool('set_store_status', { status }),
    ]
  }
  if (/fiado|devendo|pagar depois/.test(q)) {
    return [
      ...say.reasoning('Os fiados em aberto estão em "Pagar depois".'),
      ...say.tool('pay_later_open', {}),
    ]
  }
  if (/atras|demor|fila|quadro|agora/.test(q)) {
    return [...say.reasoning('Olho o quadro de pedidos de hoje.'), ...say.tool('orders_now', {})]
  }
  if (/estoque|acab|falt|insumo/.test(q)) {
    const saturday = today.minus({ days: (today.weekday + 1) % 7 || 7 })
    return [
      ...say.reasoning('Uso o último sábado como base e projeto um dia.'),
      ...say.tool('stock_forecast', { baseFrom: day(saturday), baseTo: day(saturday), days: 1 }),
    ]
  }
  if (/grupo|opciona|obrigat/.test(q)) {
    // The two asks of the store: optional cheese on the Premium ones, the optionals on the strips.
    const items = /tirinha/.test(q)
      ? say.tool('menu_items', { search: 'Tirinha' })
      : /porc/.test(q)
        ? say.tool('menu_items', { category: 'Porç' })
        : /premium/.test(q)
          ? say.tool('menu_items', { category: 'Premium' })
          : []
    return [
      ...say.reasoning('Vejo os grupos de escolha e quem usa cada um.'),
      ...say.tool('option_groups', {}),
      ...items,
    ]
  }
  if (/(cria|monta|cadastra) .*(itens|cardapio)/.test(q)) {
    // As from a menu photo: a few categories, one already in the store.
    const burger = (name: string, price: number, description: string) => ({
      name,
      price,
      description,
    })
    return [
      ...say.reasoning('Li o cardápio da foto e separei por categoria.'),
      ...say.tool('create_menu_items', {
        categories: [
          {
            name: 'Hambúrguer artesanal',
            items: [
              burger('X-Bacon', 24, 'Hambúrguer 150 g, presunto, muçarela e bacon.'),
              burger('X-Salada', 22, 'Alface, tomate, hambúrguer 150 g, presunto e muçarela.'),
              burger(
                'X-Tudo artesanal com nome bem comprido',
                29.9,
                'Hambúrguer 150 g, presunto, muçarela, salada, salsicha, ovo, milho e batata palha.'
              ),
            ],
          },
          {
            name: 'Lanches com frango',
            items: [
              burger('Frango bacon', 21, 'Frango, bacon, muçarela e salada.'),
              burger('Frango tudo', 25, 'Frango, muçarela, milho, salsicha, ovo e salada.'),
            ],
          },
          { name: 'Bebidas', items: [{ name: 'Refrigerante litro', price: 12 }] },
        ],
      }),
    ]
  }
  if (/pausa|volta a vender|preco|aument|reaj|cardapio|item|itens/.test(q)) {
    return [
      ...say.reasoning('Primeiro procuro os itens no cardápio.'),
      ...say.tool('menu_items', {}),
    ]
  }
  if (/pedido|cliente/.test(q)) {
    return say.tool('find_orders', lastWeek)
  }
  if (/vend|fatur|ticket|semana|hoje|ontem/.test(q)) {
    return [
      ...say.reasoning('Comparo os últimos 7 dias com os 7 anteriores.'),
      ...say.tool('sales_summary', lastWeek),
    ]
  }
  return say.text(
    'Este é o assistente de teste (sem modelo de verdade). Pergunte sobre **vendas da semana**, **o que pode acabar no estoque**, **pedidos atrasados**, **fiado em aberto**, **itens do cardápio** ou peça para **pausar** um item.'
  )
}

/** "Pausa o pastel de carne": after listing the menu, asks to switch the matching item off. */
function followUp(prompt: Message[], results: ToolResult[]): StreamPart[] | null {
  const q = lastQuestion(prompt)
  const groups = results.find((result) => result.toolName === 'option_groups')
  const listedItems = results.find((result) => result.toolName === 'menu_items')
  if (groups && listedItems) return groupFollowUp(q, valueOf(groups), valueOf(listedItems))
  const resume = /volta a vender|despausa/.test(q)
  if (!resume && !/\bpausa/.test(q)) return null
  const listed = results.find((result) => result.toolName === 'menu_items')
  const items: { id: string; name: string }[] = listed ? (valueOf(listed)?.items ?? []) : []
  if (!items.length) return null
  const words = q.split(/\s+/).filter((word) => word.length > 3)
  // The whole name first ("Pastel de Carne" over "Pastel de Carne Seca"), then any word.
  const match =
    [...items]
      .sort((a, b) => b.name.length - a.name.length)
      .find((item) => q.includes(normalize(item.name))) ??
    items.find((item) => words.some((word) => normalize(item.name).includes(word))) ??
    items[0]
  return [
    ...say.text(
      `Vou ${resume ? 'voltar a vender' : 'pausar'} **${match.name}**. Confira e aprove:`
    ),
    ...say.tool('update_items', {
      changes: [{ itemId: match.id, isAvailable: resume }],
      summary: `${resume ? 'Voltar a vender' : 'Pausar'} ${match.name}`,
    }),
  ]
}

/** After reading the groups and the items: the change, waiting for approval. */
function groupFollowUp(q: string, groups: any, listed: any): StreamPart[] | null {
  const itemIds = (listed?.items ?? []).map((item: { id: string }) => item.id)
  const byName = (name: string) =>
    (groups?.groups ?? []).find((group: { name: string }) => group.name === name)
  if (!itemIds.length) return null
  if (/tirinha|porc/.test(q) && byName('Opcionais')) {
    return [
      ...say.text('Coloco o grupo **Opcionais** (orégano e alho frito) nesses itens. Confira:'),
      ...say.tool('update_item_extras', { itemIds, addGroupIds: [byName('Opcionais').id] }),
    ]
  }
  const cheese = byName('Escolha o queijo')
  if (/premium/.test(q) && cheese) {
    return [
      ...say.text(
        '"Escolha o queijo" é usado por outros pastéis: crio uma cópia opcional só para os Premium. Confira:'
      ),
      ...say.tool('create_option_group', {
        name: 'Escolha o queijo (opcional)',
        minChoices: 0,
        maxChoices: cheese.maxChoices,
        copyFrom: cheese.id,
        itemIds,
        replaceGroupId: cheese.id,
      }),
    ]
  }
  return null
}

function summarize(results: ToolResult[]) {
  return results
    .map((result) => {
      if (result.output.type === 'execution-denied') return 'Tudo bem, não alterei nada.'
      if (result.output.type.startsWith('error'))
        return `Não consegui: ${String(result.output.value)}`
      const data = valueOf(result)
      switch (result.toolName) {
        case 'sales_summary':
          return `De ${dayMonth(data.period.from)} a ${dayMonth(data.period.to)}: **${brl(data.summary.revenue)}** em ${data.summary.orders} pedidos (antes: ${brl(data.summary.previous.revenue)}).`
        case 'stock_forecast':
          return data.enabled
            ? `${data.ingredients.filter((row: any) => row.status !== 'ok').length} insumos precisam de atenção.`
            : 'A loja não controla estoque.'
        case 'orders_now':
          return `${data.orders.length} pedidos abertos, ${data.orders.filter((row: any) => row.late).length} passando do tempo.`
        case 'pay_later_open':
          return `${data.count} pedidos em fiado, ${brl(data.total)} no total.`
        case 'menu_items':
          return `${data.items.length} itens no cardápio.`
        case 'option_groups':
          return `${data.groups.length} grupos de escolha.`
        case 'update_item_extras':
          return `Pronto: ${data.items} item(ns) alterado(s).`
        case 'create_option_group':
          return `Pronto: grupo **${data.name}** criado em ${data.items} item(ns).`
        case 'find_orders':
          return `${data.total} pedidos no período.`
        case 'update_items':
          return `Pronto: ${data.updated} item(ns) alterado(s).`
        case 'set_store_status':
          return data.isOpen ? 'Pronto: a loja está aberta.' : 'Pronto: a loja está fechada.'
        default:
          return 'Pronto.'
      }
    })
    .join('\n\n')
}
