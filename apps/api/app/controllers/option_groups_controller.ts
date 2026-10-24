import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import OptionGroupService from '#services/option_group_service'
import { created, messageOnly, ok, updated } from '#helpers/api_response'
import { parsePagination, parseSort, pickQueryFilters } from '#helpers/query_string_parser'
import { storeExistValidator, uuidValidator } from '#validators/common'
import { optionGroupValidator } from '#validators/option_group'

/** Choice groups of a store (writes: managers only, see routes). */
@inject()
export default class OptionGroupsController {
  constructor(private groups: OptionGroupService) {}

  async index({ params, request }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const q = request.qs()
    const groups = await this.groups.list(storeId, {
      ...parsePagination(q),
      sort: parseSort(q, { name: 'name', updatedAt: 'updated_at', createdAt: 'created_at' }),
      filters: pickQueryFilters(q, ['name']),
    })
    return ok(groups.all(), groups.getMeta())
  }

  async store({ params, request }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const data = await request.validateUsing(optionGroupValidator)
    return created(await this.groups.create(storeId, data), 'Grupo de escolha criado')
  }

  async update({ params, request }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const id = await uuidValidator.validate(params.groupId)
    const data = await request.validateUsing(optionGroupValidator)
    return updated(await this.groups.update(storeId, id, data), 'Grupo de escolha atualizado')
  }

  async destroy({ params }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const id = await uuidValidator.validate(params.groupId)
    await this.groups.remove(storeId, id)
    return messageOnly('Grupo de escolha excluído')
  }
}
