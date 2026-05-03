import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import AddonService from '#services/addon_service'
import { itemExistValidator, storeValidator, updateValidator } from '#validators/addon'
import { storeExistValidator, uuidValidator } from '#validators/common'
import { created, messageOnly, ok, updated } from '#helpers/api_response'
import { parsePagination, pickQueryFilters } from '#helpers/query_string_parser'

@inject()
export default class AddonsController {
  constructor(private addonService: AddonService) {}

  async index({ request }: HttpContext) {
    const q = request.qs()

    const addons = await this.addonService.list({
      ...parsePagination(q),
      filters: pickQueryFilters(q, ['storeId', 'name']),
    })

    return ok(addons.all(), addons.getMeta())
  }

  async indexByStore({ params }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.id)

    const addons = await this.addonService.getByStore(storeId)

    return ok(addons)
  }

  async indexByItem({ params }: HttpContext) {
    const itemId = await itemExistValidator.validate(params.id)

    const addons = await this.addonService.getByItem(itemId)

    return ok(addons)
  }

  async show({ params }: HttpContext) {
    const id = await uuidValidator.validate(params.id)

    const addon = await this.addonService.get(id)

    return ok(addon)
  }

  async store({ params, request }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)

    const data = await request.validateUsing(storeValidator)

    const addon = await this.addonService.create({ storeId, ...data })

    return created(addon, 'Complemento criado com sucesso')
  }

  async update({ params, request }: HttpContext) {
    const id = await uuidValidator.validate(params.id)

    const data = await request.validateUsing(updateValidator)

    const addon = await this.addonService.update(id, data)

    return updated(addon, 'Complemento atualizado com sucesso')
  }

  async destroy({ params }: HttpContext) {
    const id = await uuidValidator.validate(params.id)

    await this.addonService.remove(id)

    return messageOnly('Complemento excluído com sucesso')
  }
}
