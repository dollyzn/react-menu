import { test } from '@japa/runner'
import { suggestIngredientIcon } from '#kitchen/ingredient_icons'

test.group('Ingredient icons', () => {
  test('specific keywords win over general ones', ({ assert }) => {
    assert.equal(suggestIngredientIcon('Carne seca'), '🥩')
    assert.equal(suggestIngredientIcon('Camarão rosa'), '🦐')
    assert.equal(suggestIngredientIcon('Pimentão'), '🫑')
    assert.equal(suggestIngredientIcon('Pimenta calabresa'), '🌶️')
    assert.equal(suggestIngredientIcon('Chocolate branco'), '🤍')
    assert.equal(suggestIngredientIcon('Suco de Goiaba (Lata 290ml)'), '🧃')
    assert.equal(suggestIngredientIcon('Goiabada'), '🍬')
  })

  test('accents and case do not matter; unknown names get none', ({ assert }) => {
    assert.equal(suggestIngredientIcon('MUÇARELA'), '🧀')
    assert.equal(suggestIngredientIcon('brócolis'), '🥦')
    assert.isNull(suggestIngredientIcon('Ingrediente secreto'))
  })
})
