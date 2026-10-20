import { BaseSeeder } from '@adonisjs/lucid/seeders'
import StoreRole from '#enums/store_role'
import Store from '#models/store'
import User from '#models/user'

/** Shared password of the demo staff accounts (development only). */
export const DEMO_STAFF_PASSWORD = 'demo12345'

const STAFF = [
  { name: 'Bruna Atendente', email: 'atendente@jjpasteis.dev', role: StoreRole.ATTENDANT },
  { name: 'Seu Zé Pasteleiro', email: 'cozinha@jjpasteis.dev', role: StoreRole.KITCHEN },
]

/** Demo attendant and kitchen accounts linked to the JJ Pastéis store. */
export default class DemoStaffSeeder extends BaseSeeder {
  static environment = ['development', 'test']

  async run() {
    const store = await Store.findBy('slug', 'jj-pasteis')
    if (!store) return

    for (const member of STAFF) {
      const user = await User.updateOrCreate(
        { email: member.email },
        { name: member.name, email: member.email, password: DEMO_STAFF_PASSWORD }
      )
      await store.related('users').sync({ [user.id]: { role: member.role } }, false)
    }
  }
}
