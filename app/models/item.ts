import { DateTime } from 'luxon'
import { BaseModel, belongsTo, column, manyToMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, ManyToMany } from '@adonisjs/lucid/types/relations'
import Category from './category.js'
import Addon from './addon.js'

export default class Item extends BaseModel {
  @column({ isPrimary: true })
  declare id: string

  @column()
  declare categoryId: number

  @column()
  declare name: string

  @column()
  declare description: string | null

  @column({ serialize: (value: string) => parseFloat(value) })
  declare price: number

  @column()
  declare photoUrl: string | null

  @column()
  declare views: number

  @column()
  declare order: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  @belongsTo(() => Category)
  declare category: BelongsTo<typeof Category>

  @manyToMany(() => Addon)
  declare addons: ManyToMany<typeof Addon>

  public async incrementViews() {
    this.views += 1
    await this.save()
    return this
  }

  serializeExtras() {
    const addonsCount = this.$extras.addonsCount ? Number(this.$extras.addonsCount) : undefined

    return {
      addonsCount,
    }
  }
}
