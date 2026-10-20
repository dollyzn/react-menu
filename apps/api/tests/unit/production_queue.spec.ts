import { test } from '@japa/runner'
import { buildProductionQueue, type PendingUnit } from '#kitchen/production_queue'

let lineId = 0
function unit(orderIndex: number, name: string, extra: Partial<PendingUnit> = {}): PendingUnit {
  lineId += 1
  return {
    orderId: `o${orderIndex}`,
    orderNumber: orderIndex + 1,
    orderIndex,
    lineId,
    itemId: name,
    name,
    addons: [],
    notes: null,
    remaining: 1,
    ...extra,
  }
}

const summary = (queue: ReturnType<typeof buildProductionQueue>) =>
  queue.map((batch) => `${batch.quantity}x ${batch.name}`)

test.group('Production queue', () => {
  test('groups identical units from nearby orders', ({ assert }) => {
    const queue = buildProductionQueue([unit(0, 'Carne'), unit(1, 'Queijo'), unit(2, 'Carne')])

    assert.deepEqual(summary(queue), ['2x Carne', '1x Queijo'])
    assert.deepEqual(
      queue[0].units.map((u) => u.orderNumber),
      [1, 3]
    )
  })

  test('never pulls units from beyond the look-ahead window', ({ assert }) => {
    const queue = buildProductionQueue(
      [unit(0, 'Carne'), unit(1, 'Queijo'), unit(2, 'Frango'), unit(3, 'Pizza'), unit(4, 'Carne')],
      3
    )

    assert.deepEqual(summary(queue), ['1x Carne', '1x Queijo', '1x Frango', '1x Pizza', '1x Carne'])
  })

  test('the oldest pending unit always comes first', ({ assert }) => {
    const queue = buildProductionQueue([unit(0, 'Queijo'), unit(1, 'Carne'), unit(1, 'Carne')])

    assert.equal(queue[0].name, 'Queijo')
    assert.deepEqual(summary(queue), ['1x Queijo', '2x Carne'])
  })

  test('different add-ons or notes are never mixed', ({ assert }) => {
    const queue = buildProductionQueue([
      unit(0, 'Carne', { addons: ['Catupiry'] }),
      unit(1, 'Carne'),
      unit(2, 'Carne', { notes: 'sem cebola' }),
      unit(2, 'Carne', { addons: ['Catupiry'] }),
    ])

    assert.deepEqual(summary(queue), ['2x Carne', '1x Carne', '1x Carne'])
    assert.deepEqual(queue[0].addons, ['Catupiry'])
    assert.equal(queue[2].notes, 'sem cebola')
  })

  test('sums remaining quantities and skips finished lines', ({ assert }) => {
    const queue = buildProductionQueue([
      unit(0, 'Carne', { remaining: 2 }),
      unit(1, 'Carne', { remaining: 0 }),
      unit(2, 'Carne', { remaining: 3 }),
    ])

    assert.deepEqual(summary(queue), ['5x Carne'])
  })
})
