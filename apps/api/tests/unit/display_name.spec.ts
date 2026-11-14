import { test } from '@japa/runner'
import { displayName } from '#orders/display_name'

test.group('displayName', () => {
  const cheese = (name: string) => ({ name, replaces: 'Queijo' })

  test('the pick takes the place of the word', ({ assert }) => {
    assert.equal(
      displayName('Pastel de Frango com Queijo', [cheese('Catupiry')]),
      'Pastel de Frango com Catupiry'
    )
    assert.equal(
      displayName('Pastel de Queijo', [cheese('Cream Cheese')]),
      'Pastel de Cream Cheese'
    )
  })

  test('whole words only, ignoring case', ({ assert }) => {
    assert.equal(displayName('Pastel de 4 Queijos', [cheese('Cheddar')]), null)
    assert.equal(displayName('pastel com queijo', [cheese('Cheddar')]), 'pastel com Cheddar')
  })

  test('null when nothing changes', ({ assert }) => {
    assert.isNull(displayName('Pastel de Pizza', [cheese('Catupiry')]))
    assert.isNull(displayName('Pastel de Frango com Queijo', [{ name: 'Carne', replaces: null }]))
    assert.isNull(displayName('Pastel de Frango com Queijo', []))
  })

  test('several picks of the same group are listed once each', ({ assert }) => {
    assert.equal(
      displayName('Pastel com Queijo', [cheese('Catupiry'), cheese('Cheddar'), cheese('Catupiry')]),
      'Pastel com Catupiry e Cheddar'
    )
  })
})
