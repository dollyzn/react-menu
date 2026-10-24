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
  /** The options, in display order (the store's add-ons). */
  addonIds: string[]
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
        { storeId, name: input.name, minChoices: input.minChoices, maxChoices: input.maxChoices },
        { client: trx }
      )
      await this.syncOptions(group, input.addonIds, trx)
      return await this.find(storeId, group.id, trx)
    })
  }

  async update(storeId: string, id: string, input: OptionGroupInput) {
    return await db.transaction(async (trx) => {
      const group = await this.find(storeId, id, trx)
      await this.assertValid(storeId, input, trx)
      group.merge({ name: input.name, minChoices: input.minChoices, maxChoices: input.maxChoices })
      await group.useTransaction(trx).save()
      await this.syncOptions(group, input.addonIds, trx)
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
    const options = new Set(input.addonIds)
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
    if (input.maxChoices > options.size) {
      throw new AppException(
        `O grupo tem ${options.size} ${options.size === 1 ? 'opção' : 'opções'}: o máximo não pode passar disso.`,
        422,
        'E_INVALID_GROUP'
      )
    }
  }

  private async syncOptions(
    group: OptionGroup,
    addonIds: string[],
    trx: TransactionClientContract
  ) {
    const unique = [...new Set(addonIds)]
    await group
      .useTransaction(trx)
      .related('options')
      .sync(Object.fromEntries(unique.map((id, order) => [id, { order }])))
  }
}
