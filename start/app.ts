import { BaseModel } from '@adonisjs/lucid/orm'
import { HttpContext } from '@adonisjs/core/http'
import logger from '@adonisjs/core/services/logger'
import app from '@adonisjs/core/services/app'

if (app.getEnvironment() === 'web') {
  const boot = BaseModel.boot

  function logAction(action: string, model: any, ctx: HttpContext, item?: any) {
    const userId = ctx.auth.user?.id || 'Unknown'
    const itemId = item?.id ? ` (ID: ${item.id}` : ''
    const itemName = item?.name ? `, Name: ${item.name}` : ''
    const idAndName = itemId ? `${itemId}${itemName})` : ''
    const act = action.toLowerCase()

    logger.info(
      `[${action}] User ${userId} ${act.endsWith('ed') ? `has ${act}` : `is ${act}`} ${model.name}${idAndName}`
    )
  }

  BaseModel.boot = function () {
    if (this.booted) return
    boot.call(this)

    const log = async (action: string, item?: any) => {
      const ctx = HttpContext.getOrFail()
      logAction(action, this, ctx, item)
    }

    this.before('create', async () => log('CREATING'))
    this.after('create', async (item: any) => log('CREATED', item))

    this.before('update', async () => log('UPDATING'))
    this.after('update', async (item: any) => log('UPDATED', item))

    this.before('delete', async () => log('DELETING'))
    this.after('delete', async (item: any) => log('DELETED', item))
  }
}
