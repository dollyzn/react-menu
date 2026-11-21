import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, ManyToMany } from '@adonisjs/lucid/types/relations'
import type PartnerCancelPolicy from '#enums/partner_cancel_policy'
import type PartnerCatalogMode from '#enums/partner_catalog_mode'
import type PartnerCommissionType from '#enums/partner_commission_type'
import { decimal } from '#helpers/columns'
import Category from '#models/category'
import Item from '#models/item'
import Store from '#models/store'

/**
 * Someone who sells the store's menu to their own customers (ADR 0024),
 * on a card machine the store lent them, for a commission.
 */
export default class StorePartner extends BaseModel {
  static table = 'store_partners'

  @column({ isPrimary: true })
  declare id: string

  @column({ serializeAs: null })
  declare storeId: string

  @column()
  declare name: string

  // Serialized as `{ id, name }` only (an order's partner on the staff's
  // screens); PartnerService presents the rest to the managers.
  @column({ serializeAs: null })
  declare commissionType: PartnerCommissionType

  /** Percent (10 = 10%) or R$ per unit. */
  @column({ ...decimal, serializeAs: null })
  declare commissionValue: number

  /** When the commission rule last changed: orders keep the one of their time. */
  @column.dateTime({ serializeAs: null })
  declare commissionUpdatedAt: DateTime

  @column({ serializeAs: null })
  declare cancelPolicy: PartnerCancelPolicy

  @column({ serializeAs: null })
  declare catalogMode: PartnerCatalogMode

  /** Paused: takes no new orders. */
  @column.dateTime({ serializeAs: null })
  declare pausedAt: DateTime | null

  @column.dateTime({ autoCreate: true, serializeAs: null })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true, serializeAs: null })
  declare updatedAt: DateTime

  @belongsTo(() => Store)
  declare store: BelongsTo<typeof Store>

  /** With `catalogMode` `selected`: the categories it may sell. */
  @manyToMany(() => Category, {
    pivotTable: 'store_partner_categories',
    pivotForeignKey: 'partner_id',
    pivotRelatedForeignKey: 'category_id',
  })
  declare categories: ManyToMany<typeof Category>

  /** Items left out of the chosen categories. */
  @manyToMany(() => Item, {
    pivotTable: 'store_partner_excluded_items',
    pivotForeignKey: 'partner_id',
    pivotRelatedForeignKey: 'item_id',
  })
  declare excludedItems: ManyToMany<typeof Item>
}
