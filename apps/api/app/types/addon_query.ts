import type { SortSpec } from '#helpers/query_string_parser'
import type Addon from '#models/addon'

export type AddonPreloadKey = keyof Pick<Addon, 'items' | 'store'>

export type AddonPreloadOption = true | false | AddonPreloadKey[]

export type AddonFindOptions = {
  preload?: AddonPreloadOption
}

export type AddonListFilters = {
  storeId?: string | string[]
  name?: string | string[]
}

export type AddonListOptions = {
  page?: number
  perPage?: number
  sort?: SortSpec
  filters?: AddonListFilters
  preload?: AddonPreloadOption
}
