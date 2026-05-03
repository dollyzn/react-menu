import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import DashboardService from '#services/dashboard_service'
import { storeExistValidator } from '#validators/common'
import { ok } from '#helpers/api_response'

@inject()
export default class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  async overview({ params }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.id)

    const data = await this.dashboardService.overview(storeId)

    return ok(data)
  }

  async recentItems({ params }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.id)

    const items = await this.dashboardService.recentItems(storeId)

    return ok(items)
  }

  async chart({ params }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.id)

    const chart = await this.dashboardService.chart(storeId)

    return ok(chart)
  }
}
