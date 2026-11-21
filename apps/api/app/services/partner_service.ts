import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'
import type {
  PartnerCatalogInput,
  PartnerInput,
  StorePartner as StorePartnerDto,
} from '@react-menu/contracts'
import AppException from '#exceptions/app_exception'
import PartnerCatalogMode from '#enums/partner_catalog_mode'
import PartnerCommissionType from '#enums/partner_commission_type'
import StoreRole from '#enums/store_role'
import PartnerMemberRole from '#enums/partner_member_role'
import { broadcastPartnerEvent } from '#helpers/realtime'
import StorePartner from '#models/store_partner'
import type User from '#models/user'
import NotificationService from '#services/notification_service'

const money = (value: number) => Math.round(value * 100) / 100

function assertRule(input: PartnerInput) {
  if (input.commissionType === PartnerCommissionType.PERCENT && input.commissionValue > 100) {
    throw new AppException('A porcentagem da comissão vai até 100.', 422, 'E_INVALID_COMMISSION')
  }
}

/** What a partner may sell (ADR 0024), loaded once for a menu or an order. */
export type PartnerCatalog = {
  mode: PartnerCatalogMode
  categoryIds: Set<number>
  excludedItemIds: Set<string>
}

export function sellsItem(catalog: PartnerCatalog, item: { id: string; categoryId: number }) {
  if (catalog.mode === PartnerCatalogMode.ALL) return true
  return catalog.categoryIds.has(item.categoryId) && !catalog.excludedItemIds.has(item.id)
}

/**
 * Partners of a store (ADR 0024): the managers' side (rules, catalog,
 * pausing) and finding the partner a signed-in partner works for.
 */
@inject()
export default class PartnerService {
  constructor(private notifications: NotificationService) {}

  async list(storeId: string): Promise<StorePartnerDto[]> {
    const partners = await StorePartner.query().where('storeId', storeId).orderBy('name', 'asc')
    return await this.present(storeId, partners)
  }

  async show(storeId: string, partnerId: string) {
    const [partner] = await this.present(storeId, [await this.findInStore(storeId, partnerId)])
    return partner
  }

  async findInStore(
    storeId: string,
    partnerId: string,
    client?: TransactionClientContract,
    { lock = false } = {}
  ) {
    const partner = await StorePartner.query({ client })
      .where({ storeId, id: partnerId })
      .if(lock, (query) => query.forUpdate())
      .first()
    if (!partner) throw new AppException('Parceiro não encontrado nesta loja.', 404)
    return partner
  }

  async create(storeId: string, input: PartnerInput, client?: TransactionClientContract) {
    assertRule(input)
    const run = async (trx: TransactionClientContract) => {
      await this.assertNameFree(trx, storeId, input.name)
      return await StorePartner.create(
        {
          storeId,
          name: input.name.trim(),
          commissionType: input.commissionType,
          commissionValue: money(input.commissionValue),
          commissionUpdatedAt: DateTime.now(),
          cancelPolicy: input.cancelPolicy,
          catalogMode: PartnerCatalogMode.ALL,
        },
        { client: trx }
      )
    }
    const partner = client ? await run(client) : await db.transaction(run)
    return partner
  }

  /**
   * Changes the name and rules. A new commission rule applies from now on
   * (orders keep theirs) and the partner's people are told.
   */
  async update(storeId: string, partnerId: string, input: PartnerInput, actor: User) {
    assertRule(input)
    const { partner, commissionChanged } = await db.transaction(async (trx) => {
      const current = await this.findInStore(storeId, partnerId, trx, { lock: true })
      if (current.name !== input.name.trim()) {
        await this.assertNameFree(trx, storeId, input.name, partnerId)
      }
      const value = money(input.commissionValue)
      const changed =
        current.commissionType !== input.commissionType || current.commissionValue !== value
      current.merge({
        name: input.name.trim(),
        commissionType: input.commissionType,
        commissionValue: value,
        cancelPolicy: input.cancelPolicy,
        ...(changed && { commissionUpdatedAt: DateTime.now() }),
      })
      await current.useTransaction(trx).save()
      return { partner: current, commissionChanged: changed }
    })

    broadcastPartnerEvent({ type: 'partner.commission.changed', storeId, partnerId })
    if (commissionChanged) {
      await this.notifications.notifyPartnerMembers(
        storeId,
        partnerId,
        'partner.commission_changed',
        {
          storeId,
          partnerName: partner.name,
          commissionType: partner.commissionType,
          commissionValue: partner.commissionValue,
        },
        // The commission is the partner's managers' business only.
        { exceptUserId: actor.id, partnerRole: PartnerMemberRole.MANAGER }
      )
    }
    return await this.show(storeId, partnerId)
  }

  async setPaused(storeId: string, partnerId: string, paused: boolean) {
    await db.transaction(async (trx) => {
      const partner = await this.findInStore(storeId, partnerId, trx, { lock: true })
      if (Boolean(partner.pausedAt) === paused) return
      partner.pausedAt = paused ? DateTime.now() : null
      await partner.useTransaction(trx).save()
    })
    broadcastPartnerEvent({ type: 'partner.commission.changed', storeId, partnerId })
    return await this.show(storeId, partnerId)
  }

  /** What the partner may sell: the whole menu, or categories minus some items. */
  async setCatalog(storeId: string, partnerId: string, input: PartnerCatalogInput) {
    await db.transaction(async (trx) => {
      const partner = await this.findInStore(storeId, partnerId, trx, { lock: true })

      const categoryIds = [...new Set(input.categoryIds)]
      const itemIds = [...new Set(input.excludedItemIds)]
      if (categoryIds.length) {
        const found = await trx
          .from('categories')
          .where('store_id', storeId)
          .whereIn('id', categoryIds)
          .count('* as total')
        if (Number(found[0].total) !== categoryIds.length) {
          throw new AppException('Categoria não encontrada nesta loja.', 422, 'E_NOT_IN_STORE')
        }
      }
      if (itemIds.length) {
        const found = await trx
          .from('items')
          .join('categories', 'categories.id', 'items.category_id')
          .where('categories.store_id', storeId)
          .whereIn('items.id', itemIds)
          .count('* as total')
        if (Number(found[0].total) !== itemIds.length) {
          throw new AppException('Item não encontrado nesta loja.', 422, 'E_NOT_IN_STORE')
        }
      }
      if (input.mode === PartnerCatalogMode.SELECTED && categoryIds.length === 0) {
        throw new AppException(
          'Escolha pelo menos uma categoria que o parceiro pode vender.',
          422,
          'E_EMPTY_CATALOG'
        )
      }

      partner.catalogMode = input.mode
      await partner.useTransaction(trx).save()
      const selected = input.mode === PartnerCatalogMode.SELECTED
      await partner.related('categories').sync(selected ? categoryIds : [], true, trx)
      await partner.related('excludedItems').sync(selected ? itemIds : [], true, trx)
    })
    broadcastPartnerEvent({ type: 'partner.commission.changed', storeId, partnerId })
    return await this.show(storeId, partnerId)
  }

  async catalog(
    partner: StorePartner,
    client?: TransactionClientContract
  ): Promise<PartnerCatalog> {
    if (partner.catalogMode === PartnerCatalogMode.ALL) {
      return { mode: partner.catalogMode, categoryIds: new Set(), excludedItemIds: new Set() }
    }
    const query = client ?? db
    const [categories, excluded] = [
      await query.from('store_partner_categories').where('partner_id', partner.id),
      await query.from('store_partner_excluded_items').where('partner_id', partner.id),
    ]
    return {
      mode: partner.catalogMode,
      categoryIds: new Set(categories.map((row) => Number(row.category_id))),
      excludedItemIds: new Set(excluded.map((row) => row.item_id as string)),
    }
  }

  /**
   * The partner a signed-in partner works for in this store. The partner
   * area's routes only run for partners (`storeAccess`), so anything else
   * is a 403.
   */
  async forMember(storeId: string, user: User) {
    const { partner } = await this.memberOf(storeId, user)
    return partner
  }

  /** The partner and the person's role inside it (manager or attendant). */
  async memberOf(storeId: string, user: User) {
    const membership = await user.storeMembership(storeId)
    if (membership?.role !== StoreRole.PARTNER || !membership.partnerId) {
      throw new AppException('Esta área é só para parceiros.', 403, 'E_PARTNER_AREA')
    }
    return {
      partner: await this.findInStore(storeId, membership.partnerId),
      role: membership.partnerRole ?? PartnerMemberRole.ATTENDANT,
    }
  }

  private async assertNameFree(
    trx: TransactionClientContract,
    storeId: string,
    name: string,
    exceptId?: string
  ) {
    const taken = await trx
      .from('store_partners')
      .where('store_id', storeId)
      .whereRaw('lower(name) = lower(?)', [name.trim()])
      .if(exceptId, (query) => query.whereNot('id', exceptId!))
      .first()
    if (taken) {
      throw new AppException('Já existe um parceiro com esse nome.', 409, 'E_PARTNER_NAME_TAKEN')
    }
  }

  async present(storeId: string, partners: StorePartner[]): Promise<StorePartnerDto[]> {
    if (partners.length === 0) return []
    const ids = partners.map((partner) => partner.id)
    // One after the other: they may share a transaction's connection.
    const categories = await db.from('store_partner_categories').whereIn('partner_id', ids)
    const excluded = await db.from('store_partner_excluded_items').whereIn('partner_id', ids)
    const members = await db
      .from('store_user')
      .where('store_id', storeId)
      .whereIn('partner_id', ids)
      .groupBy('partner_id')
      .select('partner_id')
      .count('* as total')
    const terminals = await db
      .from('point_terminals')
      .where('store_id', storeId)
      .whereIn('partner_id', ids)
      .orderBy('name')
      .select('partner_id', 'terminal_id', 'name')

    return partners.map((partner) => ({
      id: partner.id,
      name: partner.name,
      commissionType: partner.commissionType,
      commissionValue: partner.commissionValue,
      commissionUpdatedAt: partner.commissionUpdatedAt.toISO()!,
      cancelPolicy: partner.cancelPolicy,
      catalogMode: partner.catalogMode,
      categoryIds: categories
        .filter((row) => row.partner_id === partner.id)
        .map((row) => Number(row.category_id)),
      excludedItemIds: excluded
        .filter((row) => row.partner_id === partner.id)
        .map((row) => row.item_id as string),
      pausedAt: partner.pausedAt?.toISO() ?? null,
      membersCount: Number(members.find((row) => row.partner_id === partner.id)?.total ?? 0),
      terminals: terminals
        .filter((row) => row.partner_id === partner.id)
        .map((row) => ({ terminalId: row.terminal_id, name: row.name })),
      createdAt: partner.createdAt.toISO()!,
      updatedAt: partner.updatedAt.toISO()!,
    }))
  }
}
