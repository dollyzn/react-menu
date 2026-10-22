import type { HttpContext } from '@adonisjs/core/http'
import { bulkUpdateValidator } from '#validators/bulk_update'
import { inject } from '@adonisjs/core'
import AddonService from '#services/addon_service'
import {
  bulkDeleteValidator,
  itemExistValidator,
  storeValidator,
  updateValidator,
} from '#validators/addon'
import { storeExistValidator, uuidValidator } from '#validators/common'
import { bulkDeleted, created, messageOnly, ok, updated } from '#helpers/api_response'
import { parsePagination, parseSort, pickQueryFilters } from '#helpers/query_string_parser'

@inject()
export default class AddonsController {
  constructor(private addonService: AddonService) {}

  async index({ request, params }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const q = request.qs()

    const addons = await this.addonService.listInStore(storeId, {
      ...parsePagination(q),
      sort: parseSort(q, {
        name: 'name',
        description: 'description',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        price: 'price',
      }),
      filters: pickQueryFilters(q, ['name']),
    })

    return ok(addons.all(), addons.getMeta())
  }

  async indexByItem({ params }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const itemId = await itemExistValidator.validate(params.itemId)

    const addons = await this.addonService.getByItemInStore(storeId, itemId)

    return ok(addons)
  }

  async show({ params }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const addonId = await uuidValidator.validate(params.addonId)

    const addon = await this.addonService.getInStore(storeId, addonId)

    return ok(addon)
  }

  async store({ params, request }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)

    const data = await request.validateUsing(storeValidator)

    const addon = await this.addonService.createForStore(storeId, data)

    return created(addon, 'Complemento criado com sucesso')
  }

  async update({ params, request }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const addonId = await uuidValidator.validate(params.addonId)

    const data = await request.validateUsing(updateValidator)

    const addon = await this.addonService.updateInStore(storeId, addonId, data)

    return updated(addon, 'Complemento atualizado com sucesso')
  }

  async destroy({ params }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const addonId = await uuidValidator.validate(params.addonId)

    await this.addonService.removeInStore(storeId, addonId)

    return messageOnly('Complemento excluído com sucesso')
  }

  async bulkUpdate({ params, request }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const { changes } = await request.validateUsing(bulkUpdateValidator)

    const count = await this.addonService.bulkUpdateForStore(storeId, changes)

    return updated(
      { updated: count },
      count === 1 ? '1 adicional atualizado' : `${count} adicionais atualizados`
    )
  }

  async bulkDelete({ params, request }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)

    const { ids } = await request.validateUsing(bulkDeleteValidator)

    const result = await this.addonService.bulkDeleteForStore(storeId, ids)

    return bulkDeleted(result, {
      success: 'Adicionais excluídos com sucesso',
      partial: 'Alguns adicionais não puderam ser excluídos',
    })
  }
}
