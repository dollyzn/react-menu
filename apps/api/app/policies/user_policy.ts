import User from '#models/user'
import { BasePolicy } from '@adonisjs/bouncer'

export default class UserPolicy extends BasePolicy {
  async view(user: User) {
    return await user.can('view_user')
  }

  async list(user: User) {
    return await user.can('list_user')
  }

  async create(user: User) {
    return await user.can('create_user')
  }

  async update(user: User) {
    return await user.can('update_user')
  }

  async delete(user: User) {
    return await user.can('delete_user')
  }
}
