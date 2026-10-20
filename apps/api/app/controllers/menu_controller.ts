import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import MenuService from '#services/menu_service'
import { storeExistValidator } from '#validators/common'
import { ok } from '#helpers/api_response'

@inject()
export default class MenuController {
  constructor(private menuService: MenuService) {}

  async show({ params, request }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)

    const store = await this.menuService.getPublicMenuByStoreId(
      storeId,
      request.header('user-agent') ?? null
    )

    return ok(store.serialize())
  }
}
