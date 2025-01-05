/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import router from '@adonisjs/core/services/router'

import '#routes/auth'
import '#routes/user'
import '#routes/store'
import '#routes/category'
import '#routes/item'
import '#routes/addon'
import '#routes/menu'

router.get('/', async () => {
  return {
    hello: 'world',
  }
})
