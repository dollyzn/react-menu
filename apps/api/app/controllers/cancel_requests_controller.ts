import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { ok, updated } from '#helpers/api_response'
import CancelRequestService from '#services/cancel_request_service'
import { numberValidator, storeExistValidator, uuidValidator } from '#validators/common'
import { cancelDecisionValidator } from '#validators/partner'

/** Cancellation requests waiting for a manager (ADR 0024; managers only). */
@inject()
export default class CancelRequestsController {
  constructor(private requests: CancelRequestService) {}

  async index({ params }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    return ok(await this.requests.listPending(storeId))
  }

  async approve(ctx: HttpContext) {
    const { storeId, orderId, requestId, note } = await this.input(ctx)
    const request = await this.requests.approve(
      storeId,
      orderId,
      requestId,
      ctx.auth.getUserOrFail(),
      note
    )
    return updated(request.present(), 'Cancelamento aprovado: pedido cancelado')
  }

  async reject(ctx: HttpContext) {
    const { storeId, orderId, requestId, note } = await this.input(ctx)
    const request = await this.requests.reject(
      storeId,
      orderId,
      requestId,
      ctx.auth.getUserOrFail(),
      note
    )
    return updated(request.present(), 'Cancelamento recusado: o pedido segue')
  }

  private async input({ params, request }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const orderId = await uuidValidator.validate(params.orderId)
    const requestId = await numberValidator.validate(Number(params.requestId))
    const { note } = await request.validateUsing(cancelDecisionValidator)
    return { storeId, orderId, requestId, note: note ?? null }
  }
}
