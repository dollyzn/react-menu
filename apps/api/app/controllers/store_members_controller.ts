import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import { created, messageOnly, ok, updated } from '#helpers/api_response'
import StoreMemberService from '#services/store_member_service'
import { storeExistValidator, uuidValidator } from '#validators/common'
import { addMemberValidator, updateMemberValidator } from '#validators/store_member'

/** The store's team (managers only, see routes). */
@inject()
export default class StoreMembersController {
  constructor(private members: StoreMemberService) {}

  async index({ params }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    return ok(await this.members.list(storeId))
  }

  async store({ params, request, auth }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const data = await request.validateUsing(addMemberValidator)

    const { member, invited } = await this.members.add(storeId, data, auth.getUserOrFail())

    return created(
      { ...member, invited },
      invited
        ? `Convite enviado para ${member.email}.`
        : `${member.name ?? member.email} agora faz parte da equipe.`
    )
  }

  async update({ params, request }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const userId = await uuidValidator.validate(params.userId)
    const { role } = await request.validateUsing(updateMemberValidator)

    return updated(await this.members.changeRole(storeId, userId, role), 'Função atualizada')
  }

  async destroy({ params }: HttpContext) {
    const storeId = await storeExistValidator.validate(params.storeId)
    const userId = await uuidValidator.validate(params.userId)

    await this.members.remove(storeId, userId)

    return messageOnly('Removido da equipe')
  }
}
