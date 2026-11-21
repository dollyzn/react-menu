import { BaseSeeder } from '@adonisjs/lucid/seeders'
import StoreRole from '#enums/store_role'
import Store from '#models/store'
import StorePartner from '#models/store_partner'
import User from '#models/user'
import { DateTime } from 'luxon'

/** Shared password of the demo staff accounts (development only). */
export const DEMO_STAFF_PASSWORD = 'demo12345'

const STAFF = [
  { name: 'Bruna Atendente', email: 'atendente@jjpasteis.dev', role: StoreRole.ATTENDANT },
  { name: 'Seu Zé Pasteleiro', email: 'cozinha@jjpasteis.dev', role: StoreRole.KITCHEN },
]

/** A demo partner (ADR 0024) and the person who sells for it. */
const PARTNER = { name: 'Açaí da Praça', person: 'Maria do Açaí', email: 'parceiro@jjpasteis.dev' }

/** Demo attendant, kitchen and partner accounts linked to the JJ Pastéis store. */
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

    const partner = await StorePartner.firstOrCreate(
      { storeId: store.id, name: PARTNER.name },
      {
        storeId: store.id,
        name: PARTNER.name,
        commissionType: 'percent',
        commissionValue: 10,
        commissionUpdatedAt: DateTime.now(),
        cancelPolicy: 'until_kitchen',
        catalogMode: 'all',
      }
    )
    const person = await User.updateOrCreate(
      { email: PARTNER.email },
      { name: PARTNER.person, email: PARTNER.email, password: DEMO_STAFF_PASSWORD }
    )
    await store
      .related('users')
      .sync({ [person.id]: { role: StoreRole.PARTNER, partner_id: partner.id } }, false)
  }
}
