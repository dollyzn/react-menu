import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import DashboardService from '#services/dashboard_service'
import { storeExistValidator } from '#validators/common'
import { ok } from '#helpers/api_response'

@inject()
export default class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  async today({ params }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    return ok(await this.dashboardService.today(storeId))
  }
}
