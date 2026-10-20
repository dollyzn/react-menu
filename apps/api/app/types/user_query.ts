import type User from '#models/user'

export type UserPreloadKey = keyof Pick<User, 'stores'>

export type UserPreloadOption = true | false | UserPreloadKey[]

export type UserFindOptions = {
  preload?: UserPreloadOption
}

export type UserListFilters = {
  name?: string | string[]
  email?: string | string[]
}

export type UserListOptions = {
  page?: number
  perPage?: number
  filters?: UserListFilters
  preload?: UserPreloadOption
}
