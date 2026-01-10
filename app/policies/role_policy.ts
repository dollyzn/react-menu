import User from '#models/user'
import { BasePolicy } from '@adonisjs/bouncer'

export default class RolePolicy extends BasePolicy {
  async view(user: User) {
    return await user.can('view_role')
  }

  async list(user: User) {
    return await user.can('list_role')
  }

  async create(user: User) {
    return await user.can('create_role')
  }

  async update(user: User) {
    return await user.can('update_role')
  }

  async delete(user: User) {
    return await user.can('delete_role')
  }
}
