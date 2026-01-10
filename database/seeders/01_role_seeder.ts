import Role from '#models/role'
import { BaseSeeder } from '@adonisjs/lucid/seeders'

export default class extends BaseSeeder {
  async run() {
    await Role.fetchOrCreateMany('name', [{ name: 'Administrador' }])
  }
}
