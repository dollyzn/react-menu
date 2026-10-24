import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { DateTime } from 'luxon'
import AppException from '#exceptions/app_exception'
import { ok } from '#helpers/api_response'
import ReportService from '#services/report_service'
import { storeExistValidator } from '#validators/common'
import { reportPeriodValidator } from '#validators/report'

const MAX_DAYS = 366

/** Sales reports (managers only, see routes). */
@inject()
export default class ReportsController {
  constructor(private reports: ReportService) {}

  async sales({ params, request }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const { from, to } = await request.validateUsing(reportPeriodValidator, { data: request.qs() })
    const start = DateTime.fromJSDate(from)
    const end = DateTime.fromJSDate(to)
    if (end.diff(start, 'days').days + 1 > MAX_DAYS) {
      throw new AppException('Escolha um período de até um ano.', 422, 'E_PERIOD_TOO_LONG')
    }
    return ok(await this.reports.sales(storeId, { from: start.toISODate()!, to: end.toISODate()! }))
  }
}
