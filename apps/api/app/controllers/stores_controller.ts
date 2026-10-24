import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import StoreService from '#services/store_service'
import { uuidValidator } from '#validators/common'
import {
  storeValidator,
  updateImagesValidator,
  updateStatusValidator,
  updateHoursValidator,
  updateValidator,
} from '#validators/store'
import { created, messageOnly, ok, updated } from '#helpers/api_response'

@inject()
export default class StoresController {
  constructor(private storeService: StoreService) {}

  async show({ params }: HttpContext) {
    const id = await uuidValidator.validate(params.storeId)

    const store = await this.storeService.get(id)

    return ok(store)
  }

  async store({ request, auth, bouncer }: HttpContext) {
    await bouncer.with('StorePolicy').authorize('create')

    const data = await request.validateUsing(storeValidator)

    const store = await this.storeService.create(data, auth.getUserOrFail().id)

    return created(store, 'Loja criada com sucesso')
  }

  async update({ params, request }: HttpContext) {
    const id = await uuidValidator.validate(params.storeId)

    const data = await request.validateUsing(updateValidator)

    const store = await this.storeService.update(id, data)

    return updated(store, 'Loja atualizada com sucesso')
  }

  async updateImages({ params, request }: HttpContext) {
    const id = await uuidValidator.validate(params.storeId)

    const images = await request.validateUsing(updateImagesValidator)

    const store = await this.storeService.updateImages(id, {
      banner: images.banner,
      photo: images.photo,
    })

    return updated(store, 'Imagens atualizadas com sucesso')
  }

  async updateStatus({ params, request, auth }: HttpContext) {
    const id = await uuidValidator.validate(params.storeId)

    const { status } = await request.validateUsing(updateStatusValidator)

    const store = await this.storeService.updateStatus(id, status, auth.getUserOrFail())

    return updated(store, 'Status da loja atualizado com sucesso')
  }

  async updateHours({ params, request }: HttpContext) {
    const id = await uuidValidator.validate(params.storeId)
    const data = await request.validateUsing(updateHoursValidator)

    const store = await this.storeService.updateHours(id, data)

    return updated(store, 'Horário de funcionamento salvo')
  }

  async destroy({ params, bouncer }: HttpContext) {
    await bouncer.with('StorePolicy').authorize('delete')

    const id = await uuidValidator.validate(params.storeId)

    await this.storeService.remove(id)

    return messageOnly('Loja excluída com sucesso')
  }
}
