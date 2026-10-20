import { cuid } from '@adonisjs/core/helpers'
import Category from '#models/category'
import Permission from '#models/permission'
import Role from '#models/role'
import Store from '#models/store'
import User from '#models/user'

export async function createUser(overrides: Partial<User> = {}) {
  return await User.create({
    name: 'Test User',
    email: `${cuid()}@example.com`,
    password: 'secret123',
    ...overrides,
  })
}

export async function createUserWithPermissions(permissions: string[]) {
  const role = await Role.create({ name: `role-${cuid()}` })
  const records = await Permission.updateOrCreateMany(
    'name',
    permissions.map((name) => ({ name, label: name }))
  )
  await role.related('permissions').attach(records.map((p) => p.id))

  return await createUser({ roleId: role.id })
}

export async function createStore(members: User[] = []) {
  const store = await Store.create({ name: 'Test Store', slug: `store-${cuid()}` })
  if (members.length) {
    await store.related('users').attach(members.map((m) => m.id))
  }
  return store
}

export async function createCategory(store: Store) {
  return await Category.create({ storeId: store.id, name: 'Pastéis', order: 1 })
}
