import User from '#models/user'
import { BasePolicy } from '@adonisjs/bouncer'

/**
 * Store-wide actions that go beyond membership. Day-to-day store access
 * is covered by the `accessStore` ability.
 */
export default class StorePolicy extends BasePolicy {
  async create(user: User) {
    return await user.can('create_store')
  }

  async delete(user: User) {
    return await user.can('delete_store')
  }
}
