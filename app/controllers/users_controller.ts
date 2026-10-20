import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import UserService from '#services/user_service'
import { uuidValidator } from '#validators/common'
import { storeValidator, updateValidator } from '#validators/user'
import { created, messageOnly, ok, updated } from '#helpers/api_response'
import { parsePagination, pickQueryFilters } from '#helpers/query_string_parser'

@inject()
export default class UsersController {
  constructor(private userService: UserService) {}

  async index({ request, bouncer }: HttpContext) {
    await bouncer.with('UserPolicy').authorize('list')

    const q = request.qs()
    const users = await this.userService.list({
      ...parsePagination(q),
      filters: pickQueryFilters(q, ['name', 'email']),
    })

    return ok(users.all(), users.getMeta())
  }

  async show({ params, bouncer }: HttpContext) {
    await bouncer.with('UserPolicy').authorize('view')

    const id = await uuidValidator.validate(params.id)

    const user = await this.userService.get(id)

    return ok(user)
  }

  async store({ request, bouncer }: HttpContext) {
    await bouncer.with('UserPolicy').authorize('create')

    const data = await request.validateUsing(storeValidator)

    const user = await this.userService.create(data)

    return created(user, 'Usuário criado com sucesso')
  }

  async update({ request, params, bouncer }: HttpContext) {
    await bouncer.with('UserPolicy').authorize('update')

    const id = await uuidValidator.validate(params.id)

    const data = await request.validateUsing(updateValidator)

    const user = await this.userService.update(id, data)

    return updated(user, 'Usuário atualizado com sucesso')
  }

  async destroy({ params, bouncer }: HttpContext) {
    await bouncer.with('UserPolicy').authorize('delete')

    const id = await uuidValidator.validate(params.id)

    await this.userService.remove(id)

    return messageOnly('Usuário excluído com sucesso')
  }
}
