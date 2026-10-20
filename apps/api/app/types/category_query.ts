import type Category from '#models/category'

export type CategoryPreloadKey = keyof Pick<Category, 'items' | 'store'>

export type CategoryPreloadOption = true | false | CategoryPreloadKey[]

export type CategoryFindOptions = {
  preload?: CategoryPreloadOption
}

export type CategoryListFilters = {
  storeId?: string | string[]
  name?: string | string[]
}

export type CategoryListOptions = {
  page?: number
  perPage?: number
  filters?: CategoryListFilters
  preload?: CategoryPreloadOption
}
