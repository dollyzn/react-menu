import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import AppException from '#exceptions/app_exception'
import Addon from '#models/addon'
import OptionGroup from '#models/option_group'
import type { SortSpec } from '#helpers/query_string_parser'

export type OptionGroupInput = {
  name: string
  minChoices: number
  maxChoices: number
  /** The same option may be picked more than once. */
  allowRepeat?: boolean
  /** Price by pick order (see OptionGroup.pickPrices); null/absent = per option. */
  pickPrices?: number[] | null
  /** The options, in display order (the store's add-ons), with their price here. */
  options: { addonId: string; price: number | null }[]
}

/** Choice groups of a store (see OptionGroup). */
export default class OptionGroupService {
  /** Paginated, with how many items use each group (`itemsCount`). */
  async list(
    storeId: string,
    options: {
      page?: number
      perPage?: number
      sort?: SortSpec
      filters?: Record<string, unknown>
    } = {}
  ) {
    const name = options.filters?.name
    const sort = options.sort?.length
      ? options.sort
      : [{ column: 'name', direction: 'asc' as const }]
    const query = OptionGroup.query()
      .where('storeId', storeId)
      .if(typeof name === 'string' && name.trim(), (byName) =>
        byName.whereILike('name', `%${String(name).trim()}%`)
      )
      .preload('options', (opts) => opts.orderBy('option_group_addons.order', 'asc'))
      .withCount('items')
    for (const { column, direction } of sort) query.orderBy(column, direction)
    return await query.paginate(options.page ?? 1, options.perPage ?? 20)
  }

  async create(storeId: string, input: OptionGroupInput) {
    return await db.transaction(async (trx) => {
      await this.assertValid(storeId, input, trx)
      const group = await OptionGroup.create(
        {
          storeId,
          name: input.name,
          minChoices: input.minChoices,
          maxChoices: input.maxChoices,
          allowRepeat: input.allowRepeat ?? false,
          pickPrices: input.pickPrices ?? null,
        },
        { client: trx }
      )
      await this.syncOptions(group, input.options, trx)
      return await this.find(storeId, group.id, trx)
    })
  }

  async update(storeId: string, id: string, input: OptionGroupInput) {
    return await db.transaction(async (trx) => {
      const group = await this.find(storeId, id, trx)
      await this.assertValid(storeId, input, trx)
      group.merge({
        name: input.name,
        minChoices: input.minChoices,
        maxChoices: input.maxChoices,
        allowRepeat: input.allowRepeat ?? false,
        pickPrices: input.pickPrices ?? null,
      })
      await group.useTransaction(trx).save()
      await this.syncOptions(group, input.options, trx)
      return await this.find(storeId, id, trx)
    })
  }

  async remove(storeId: string, id: string) {
    const group = await this.find(storeId, id)
    await group.delete()
  }

  async find(storeId: string, id: string, trx?: TransactionClientContract) {
    const group = await OptionGroup.query({ client: trx })
      .where({ id, storeId })
      .preload('options', (options) => options.orderBy('option_group_addons.order', 'asc'))
      .first()
    if (!group) throw new AppException('Grupo de escolha não encontrado.', 404)
    return group
  }

  /** Only groups of this store, in the given order (for an item). */
  async validIds(storeId: string, ids: string[], trx?: TransactionClientContract) {
    if (ids.length === 0) return []
    const rows = await OptionGroup.query({ client: trx })
      .where('storeId', storeId)
      .whereIn('id', ids)
    const found = new Set(rows.map((row) => row.id))
    if (found.size !== new Set(ids).size) {
      throw new AppException(
        'Um dos grupos de escolha não existe nesta loja.',
        422,
        'E_INVALID_GROUP'
      )
    }
    return ids
  }

  private async assertValid(
    storeId: string,
    input: OptionGroupInput,
    trx: TransactionClientContract
  ) {
    const options = new Set(input.options.map((option) => option.addonId))
    const count = await Addon.query({ client: trx })
      .where('storeId', storeId)
      .whereIn('id', [...options])
      .count('* as total')
      .first()
    if (Number(count?.$extras.total ?? 0) !== options.size) {
      throw new AppException('Use só adicionais desta loja como opções.', 422, 'E_INVALID_GROUP')
    }
    if (input.minChoices > input.maxChoices) {
      throw new AppException('O mínimo não pode ser maior que o máximo.', 422, 'E_INVALID_GROUP')
    }
    if (input.pickPrices && input.pickPrices.length > input.maxChoices) {
      throw new AppException(
        'Há mais preços por escolha do que escolhas permitidas.',
        422,
        'E_INVALID_GROUP'
      )
    }
    if (!input.allowRepeat && input.maxChoices > options.size) {
      throw new AppException(
        `O grupo tem ${options.size} ${options.size === 1 ? 'opção' : 'opções'}: o máximo não pode passar disso.`,
        422,
        'E_INVALID_GROUP'
      )
    }
  }

  private async syncOptions(
    group: OptionGroup,
    options: OptionGroupInput['options'],
    trx: TransactionClientContract
  ) {
    await group
      .useTransaction(trx)
      .related('options')
      .sync(
        Object.fromEntries(
          options.map((option, order) => [option.addonId, { order, price: option.price }])
        )
      )
  }
}
