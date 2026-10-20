import router from '@adonisjs/core/services/router'
import { managersOnly } from '#routes/store/shared'

const IngredientsController = () => import('#controllers/ingredients_controller')
const RecipesController = () => import('#controllers/recipes_controller')

export default function registerStoreInventoryRoutes() {
  router.get('/ingredients', [IngredientsController, 'index']).as('ingredients.index')
  router
    .post('/ingredients', [IngredientsController, 'store'])
    .as('ingredients.store')
    .use(managersOnly)
  router
    .put('/ingredients/:ingredientId', [IngredientsController, 'update'])
    .as('ingredients.update')
    .use(managersOnly)
  router
    .delete('/ingredients/:ingredientId', [IngredientsController, 'destroy'])
    .as('ingredients.destroy')
    .use(managersOnly)
  router
    .get('/ingredients/:ingredientId/movements', [IngredientsController, 'movements'])
    .as('ingredients.movements')
  router
    .post('/ingredients/:ingredientId/movements', [IngredientsController, 'recordMovement'])
    .as('ingredients.recordMovement')
    .use(managersOnly)

  router.get('/items/:itemId/recipe', [RecipesController, 'showItem']).as('recipes.showItem')
  router
    .put('/items/:itemId/recipe', [RecipesController, 'updateItem'])
    .as('recipes.updateItem')
    .use(managersOnly)
  router.get('/addons/:addonId/recipe', [RecipesController, 'showAddon']).as('recipes.showAddon')
  router
    .put('/addons/:addonId/recipe', [RecipesController, 'updateAddon'])
    .as('recipes.updateAddon')
    .use(managersOnly)
}
