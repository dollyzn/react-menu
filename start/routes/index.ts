/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'

import './auth.ts'
import './user.ts'
import './store.ts'
import './category.ts'
import './item.ts'
import './addon.ts'
import './menu.ts'

router.get('/', async () => {
  return {
    hello: 'world',
  }
})
