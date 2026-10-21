import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { ok } from '#helpers/api_response'
import CustomerService from '#services/customer_service'
import { storeExistValidator } from '#validators/common'
import { customerSearchValidator } from '#validators/customer'

@inject()
export default class CustomersController {
  constructor(private customers: CustomerService) {}

  /** POS autocomplete: `?search=` name or part of the phone. */
  async index({ params, request }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    // The query parser splits commas ("Silva, Ana" arrives as a list).
    const raw = request.qs().search
    const { search } = await customerSearchValidator.validate({
      search: raw === undefined ? undefined : [raw].flat().join(','),
    })
    return ok(await this.customers.search(storeId, search ?? ''))
  }
}
