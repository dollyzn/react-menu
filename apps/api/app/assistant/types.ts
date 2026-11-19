import type StoreRole from '#enums/store_role'
import type Store from '#models/store'
import type User from '#models/user'

/** Who is asking, where: every tool runs with this (never with ids from the model). */
export type ToolContext = {
  store: Store
  user: User
  role: StoreRole
}
