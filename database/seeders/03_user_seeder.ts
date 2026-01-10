import { BaseSeeder } from '@adonisjs/lucid/seeders'
import User from '#models/user'
import env from '#start/env'
import Role from '#models/role'

export default class UserSeeder extends BaseSeeder {
  public async run() {
    const email = env.get('ADMIN_USER')
    const admin = await Role.findByOrFail('name', 'Administrador')

    await User.updateOrCreate(
      { email },
      {
        roleId: admin.id,
        name: 'Admin',
        email,
        password: env.get('ADMIN_PASS'),
      }
    )
  }
}
