import User from '#models/user'
import { uuidValidator } from '#validators/common'
import { storeValidator, updateValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'

export default class UsersController {
  public async index({}: HttpContext) {
    return User.query().preload('stores')
  }

  public async show({ params }: HttpContext) {
    const id = await uuidValidator.validate(params.id)

    return User.query().preload('stores').where('id', id).firstOrFail()
  }

  public async store({ request }: HttpContext) {
    const data = await request.validateUsing(storeValidator)

    return User.create(data)
  }

  public async update({ request, params }: HttpContext) {
    const id = await uuidValidator.validate(params.id)

    const user = await User.findOrFail(id)

    const data = await request.validateUsing(updateValidator)

    const { storeIds, ...userData } = data

    user.merge(userData)
    await user.save()

    await user.related('stores').sync(data.storeIds)
    await user.load('stores')

    return user
  }

  public async destroy({ params }: HttpContext) {
    const id = await uuidValidator.validate(params.id)

    const user = await User.findOrFail(id)

    await user.delete()

    return user
  }
}
