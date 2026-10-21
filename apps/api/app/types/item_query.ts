import type { SortSpec } from '#helpers/query_string_parser'
import type Item from '#models/item'

export type ItemPreloadKey = keyof Pick<Item, 'addons' | 'category'>

export type ItemPreloadOption = true | false | ItemPreloadKey[]

export type ItemFindOptions = {
  preload?: ItemPreloadOption
}

export type ItemListFilters = {
  categoryId?: number | number[]
  name?: string | string[]
  categoryName?: string | string[]
}

export type ItemListOptions = {
  page?: number
  perPage?: number
  sort?: SortSpec
  filters?: ItemListFilters
  preload?: ItemPreloadOption
}
