import { test } from '@japa/runner'
import {
  ingredientBadge,
  suggestIngredientBadge,
  suggestIngredientIcon,
} from '#kitchen/ingredient_icons'

const auto = { icon: null, iconColor: null, iconLabel: null }

test.group('Ingredient icons', () => {
  test('specific keywords win over general ones', ({ assert }) => {
    assert.equal(suggestIngredientIcon('Carne seca'), '🥩')
    assert.equal(suggestIngredientIcon('Camarão rosa'), '🦐')
    assert.equal(suggestIngredientIcon('Pimentão'), '🫑')
    assert.equal(suggestIngredientIcon('Pimenta calabresa'), '🌶️')
    assert.equal(suggestIngredientIcon('Chocolate branco'), '🤍')
    assert.equal(suggestIngredientIcon('Suco de Goiaba (Lata 290ml)'), '🧃')
    assert.equal(suggestIngredientIcon('Goiabada'), '🍬')
    assert.equal(suggestIngredientIcon('Batata frita'), '🍟')
    assert.equal(suggestIngredientIcon('Batata palha'), '🥔')
    assert.equal(suggestIngredientIcon('Sal grosso'), '🧂')
    assert.equal(suggestIngredientIcon('Salsicha'), '🌭')
    // Whole words and bread first: no apple for pasta, no garlic or patty for bread.
    assert.equal(suggestIngredientIcon('Macarrão'), '🍝')
    assert.equal(suggestIngredientIcon('Macaxeira'), '🥔')
    assert.equal(suggestIngredientIcon('Maçã verde'), '🍎')
    assert.equal(suggestIngredientIcon('Pão de alho'), '🍞')
    assert.equal(suggestIngredientIcon('Pão de hambúrguer'), '🍞')
    assert.equal(suggestIngredientIcon('Hambúrguer'), '🍔')
  })

  test('accents and case do not matter; unknown names get none', ({ assert }) => {
    assert.equal(suggestIngredientIcon('MUÇARELA'), '🧀')
    assert.equal(suggestIngredientIcon('brócolis'), '🥦')
    assert.isNull(suggestIngredientIcon('Ingrediente secreto'))
  })

  test('ingredients sharing an emoji get apart by color and tag', ({ assert }) => {
    const catupiry = suggestIngredientBadge('Catupiry')
    const mussarela = suggestIngredientBadge('Mussarela')
    assert.equal(catupiry.emoji, mussarela.emoji)
    assert.notEqual(catupiry.color, mussarela.color)
    assert.equal(catupiry.label, 'CAT')
    assert.equal(mussarela.label, 'MUS')
    assert.isNull(suggestIngredientBadge('Tomate').label)
  })

  test('unknown names get a color that is the same every time', ({ assert }) => {
    const color = suggestIngredientBadge('Ingrediente secreto').color
    assert.equal(suggestIngredientBadge('ingrediente SECRETO').color, color)
    assert.notEqual(color, 'gray')
  })

  test("the manager's picks win; null follows the name, an empty tag hides it", ({ assert }) => {
    assert.deepEqual(ingredientBadge('Catupiry', auto), suggestIngredientBadge('Catupiry'))
    assert.deepEqual(
      ingredientBadge('Catupiry', { icon: '🥛', iconColor: 'pink', iconLabel: 'CP' }),
      {
        emoji: '🥛',
        color: 'pink',
        label: 'CP',
      }
    )
    assert.isNull(ingredientBadge('Catupiry', { ...auto, iconLabel: false }).label)
  })
})
