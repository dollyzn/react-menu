import User from '#models/user'
import { BasePolicy } from '@adonisjs/bouncer'

export default class PermissionPolicy extends BasePolicy {
  async view(user: User) {
    return await user.can('view_permission')
  }

  async list(user: User) {
    return await user.can('list_permission')
  }

  async create(user: User) {
    return await user.can('create_permission')
  }

  async update(user: User) {
    return await user.can('update_permission')
  }

  async delete(user: User) {
    return await user.can('delete_permission')
  }
}
