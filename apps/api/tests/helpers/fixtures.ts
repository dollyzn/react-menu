import { cuid } from '@adonisjs/core/helpers'
import type StoreRole from '#enums/store_role'
import Addon from '#models/addon'
import Category from '#models/category'
import Item from '#models/item'
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

export async function createItem(category: Category, overrides: Partial<Item> = {}) {
  return await Item.create({
    categoryId: category.id,
    name: 'Pastel de carne',
    price: 10,
    ...overrides,
  })
}

export async function linkUser(store: Store, user: User, role: StoreRole) {
  await store.related('users').attach({ [user.id]: { role } })
}

/** A store open for orders with a small menu: two pastries, a drink, an add-on. */
export async function createMenuStore(members: User[] = []) {
  const store = await createStore(members)
  store.merge({ status: 'open', isDefault: false })
  await store.save()

  const pastries = await Category.create({ storeId: store.id, name: 'Pastéis', order: 1 })
  const drinks = await Category.create({
    storeId: store.id,
    name: 'Bebidas',
    order: 2,
    requiresPreparation: false,
  })
  const carne = await createItem(pastries, { name: 'Pastel de Carne', price: 15, order: 1 })
  const queijo = await createItem(pastries, { name: 'Pastel de Queijo', price: 14, order: 2 })
  const coca = await createItem(drinks, { name: 'Coca-Cola', price: 6, order: 1 })
  const catupiry = await Addon.create({ storeId: store.id, name: 'Catupiry', price: 3 })
  await carne.related('addons').attach([catupiry.id])

  return { store, carne, queijo, coca, catupiry }
}
