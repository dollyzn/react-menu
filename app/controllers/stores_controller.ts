import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import StoreService from '#services/store_service'
import { uuidValidator } from '#validators/common'
import {
  storeValidator,
  updateImagesValidator,
  updateStatusValidator,
  updateValidator,
} from '#validators/store'
import { created, messageOnly, ok, updated } from '#helpers/api_response'
import { parsePagination, pickQueryFilters } from '#helpers/query_string_parser'

@inject()
export default class StoresController {
  constructor(private storeService: StoreService) {}

  async index({ request }: HttpContext) {
    const q = request.qs()
    const stores = await this.storeService.list({
      ...parsePagination(q),
      filters: pickQueryFilters(q, ['name', 'status']),
    })

    return ok(stores.all(), stores.getMeta())
  }

  async show({ params }: HttpContext) {
    const id = await uuidValidator.validate(params.id)

    const store = await this.storeService.get(id)

    return ok(store)
  }

  async store({ request }: HttpContext) {
    const data = await request.validateUsing(storeValidator)

    const store = await this.storeService.create(data)

    return created(store, 'Loja criada com sucesso')
  }

  async update({ params, request }: HttpContext) {
    const id = await uuidValidator.validate(params.id)

    const data = await request.validateUsing(updateValidator)

    const store = await this.storeService.update(id, data)

    return updated(store, 'Loja atualizada com sucesso')
  }

  async updateImages({ params, request }: HttpContext) {
    const id = await uuidValidator.validate(params.id)

    const images = await request.validateUsing(updateImagesValidator)

    const store = await this.storeService.updateImages(id, {
      banner: images.banner,
      photo: images.photo,
    })

    return updated(store, 'Imagens atualizadas com sucesso')
  }

  async updateStatus({ params, request }: HttpContext) {
    const id = await uuidValidator.validate(params.id)

    const { status } = await request.validateUsing(updateStatusValidator)

    const store = await this.storeService.update(id, { status })

    return updated(store, 'Status da loja atualizado com sucesso')
  }

  async destroy({ params }: HttpContext) {
    const id = await uuidValidator.validate(params.id)

    await this.storeService.remove(id)

    return messageOnly('Loja excluída com sucesso')
  }
}
