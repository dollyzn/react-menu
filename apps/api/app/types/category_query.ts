import type { SortSpec } from '#helpers/query_string_parser'
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
  sort?: SortSpec
  filters?: CategoryListFilters
  preload?: CategoryPreloadOption
}
