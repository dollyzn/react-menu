import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import MenuService from '#services/menu_service'
import { storeExistValidator } from '#validators/menu'
import { ok } from '#helpers/api_response'

@inject()
export default class MenuController {
  constructor(private menuService: MenuService) {}

  async show({ params, request }: HttpContext) {
    const slug = await storeExistValidator.validate(params.slug)

    const store = await this.menuService.getPublicMenu(
      slug ?? undefined,
      request.header('user-agent') ?? null
    )

    return ok(store.serialize())
  }
}
