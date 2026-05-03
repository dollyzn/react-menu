import type Store from '#models/store'

export type StorePreloadKey = keyof Pick<Store, 'categories' | 'addons'>

export type StorePreloadOption = true | false | StorePreloadKey[]

export type StoreFindOptions = {
  preload?: StorePreloadOption
}

export type StoreListFilters = {
  name?: string | string[]
  status?: string | string[]
}

export type StoreListOptions = {
  page?: number
  perPage?: number
  filters?: StoreListFilters
  preload?: StorePreloadOption
}
