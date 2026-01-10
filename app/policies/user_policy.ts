import User from '#models/user'
import { BasePolicy } from '@adonisjs/bouncer'

export default class UserPolicy extends BasePolicy {
  async view(User: User) {
    return await User.can('view_user')
  }

  async list(User: User) {
    return await User.can('list_user')
  }

  async create(User: User) {
    return await User.can('create_user')
  }

  async update(User: User) {
    return await User.can('update_user')
  }

  async delete(User: User) {
    return await User.can('delete_user')
  }
}
