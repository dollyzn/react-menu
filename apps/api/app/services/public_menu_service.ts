import { optionPrice } from '#models/option_group'
import { inject } from '@adonisjs/core'
import Bowser from 'bowser'
import AppException from '#exceptions/app_exception'
import StoreStatus from '#enums/store_status'
import Store from '#models/store'
import type Addon from '#models/addon'
import type Item from '#models/item'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import InventoryService from '#services/inventory_service'
import PaymentService from '#services/payment_service'
import PaymentMethod from '#enums/payment_method'
import { cardFeePercents } from '#payments/card_fee'
import WhatsAppAccountService from '#services/whatsapp_account_service'

/** Public store fields; never includes credentials or internal settings. */
export function publicStore(
  store: Store,
  paymentMethods: PaymentMethod[],
  whatsapp: PublicWhatsApp = { notifications: false, login: null }
) {
  return {
    id: store.id,
    name: store.name,
    slug: store.slug,
    status: store.status,
    isOpen: store.isOpen,
    /** When an open store closes / a closed one opens (on a schedule), ISO or null. */
    closesAt: store.closesAt,
    opensAt: store.opensAt,
    openingHours: store.scheduleEnabled ? store.openingHours : null,
    description: store.description,
    address: store.address,
    phone: store.phone,
    instagramUrl: store.instagramUrl,
    ifoodUrl: store.ifoodUrl,
    bannerUrl: store.bannerUrl,
    bannerBlur: store.bannerBlur,
    photoUrl: store.photoUrl,
    photoBlur: store.photoBlur,
    pickupEtaMinutes: store.pickupEtaMinutes,
    /** Served at "/" (its /<slug> page points there as canonical). */
    isDefault: store.isDefault,
    updatedAt: store.updatedAt.toISO()!,
    /** Checkout options, in display order (online first). */
    paymentMethods,
    /** Card fee the customer pays on top online (percent per type); null: none. */
    cardFees: paymentMethods.includes(PaymentMethod.CARD) ? cardFeePercents(store) : null,
    /** WhatsApp (ADR 0025): notices at checkout, history sign-in ways (null: none). */
    whatsapp,
  }
}

type PublicWhatsApp = ReturnType<WhatsAppAccountService['publicFeatures']>

@inject()
export default class PublicMenuService {
  constructor(
    private inventory: InventoryService,
    private payments: PaymentService,
    private whatsapp: WhatsAppAccountService
  ) {}

  /** Menus a search engine may list (sitemap): every store not under maintenance. */
  async listStores() {
    const stores = await Store.query()
      .whereNot('status', StoreStatus.MAINTENANCE)
      .orderBy('isDefault', 'desc')
      .orderBy('name', 'asc')
    return stores.map((store) => ({
      slug: store.slug,
      isDefault: store.isDefault,
      updatedAt: store.updatedAt.toISO()!,
    }))
  }

  /** The menu of a store by slug, or of the default store when slug is omitted. */
  async menu(slug: string | undefined, userAgent: string | undefined, options = { track: true }) {
    const store = await this.loadMenu((query) =>
      query.if(
        slug,
        (scoped) => scoped.where('slug', slug!),
        (scoped) => scoped.where('isDefault', true)
      )
    )
    if (!store) throw new AppException('Cardápio não encontrado', 404)
    if (options.track) await this.trackView(store, userAgent)
    return await this.present(store)
  }

  /**
   * A store's menu by id, with only the items `include` keeps (a partner's
   * POS, ADR 0024: what the partner may sell). Not counted as a visit.
   */
  async menuOf(storeId: string, include: (item: Item) => boolean) {
    const store = await this.loadMenu((query) => query.where('id', storeId))
    if (!store) throw new AppException('Cardápio não encontrado', 404)
    return await this.present(store, include)
  }

  private async loadMenu(scope: (query: ModelQueryBuilderContract<typeof Store>) => void) {
    const query = Store.query()
    scope(query)
    return await query
      .preload('categories', (categories) =>
        categories.orderBy('order', 'asc').preload('items', (items) =>
          items
            .orderBy('order', 'asc')
            .preload('addons', (addons) => addons.orderBy('name', 'asc'))
            .preload('optionGroups', (groups) =>
              groups
                .orderBy('item_option_groups.order', 'asc')
                .preload('options', (opts) => opts.orderBy('option_group_addons.order', 'asc'))
            )
        )
      )
      .first()
  }

  private async present(store: Store, include: (item: Item) => boolean = () => true) {
    const left = await this.inventory.capacities(store)

    return {
      store: publicStore(
        store,
        this.payments.checkoutMethods(store),
        this.whatsapp.publicFeatures(await this.whatsapp.forStore(store.id))
      ),
      categories: store.categories
        .map((category) => ({ category, items: category.items.filter(include) }))
        .filter(({ items }) => items.length > 0)
        .map(({ category, items }) => ({
          id: category.id,
          name: category.name,
          description: category.description,
          items: items.map((item) => {
            const addon = (option: Addon) => ({
              id: option.id,
              name: option.name,
              description: option.description,
              price: option.price,
              photoUrl: option.photoUrl,
              photoBlur: option.photoBlur,
              isAvailable: option.isAvailable && left.addons.get(option.id) !== 0,
              stockLeft: left.addons.get(option.id) ?? null,
            })
            const optionGroups = item.optionGroups.map((group) => ({
              id: group.id,
              name: group.name,
              minChoices: group.minChoices,
              maxChoices: group.maxChoices,
              allowRepeat: group.allowRepeat,
              pickPrices: group.pickPrices?.length ? group.pickPrices.map(Number) : null,
              // The group's price for each option (null there = the add-on's own).
              options: group.options.map((option) => ({
                ...addon(option),
                price: optionPrice(option),
              })),
            }))
            // A required group without enough options left makes the item unorderable.
            const groupsOk = optionGroups.every(
              (group) =>
                group.options.filter((option) => option.isAvailable).length >= group.minChoices
            )
            return {
              id: item.id,
              name: item.name,
              description: item.description,
              price: item.price,
              photoUrl: item.photoUrl,
              photoBlur: item.photoBlur,
              isAvailable: item.isAvailable && left.items.get(item.id) !== 0 && groupsOk,
              stockLeft: left.items.get(item.id) ?? null,
              addons: item.addons.map(addon),
              optionGroups,
            }
          }),
        })),
    }
  }

  async findBySlug(slug: string) {
    const store = await Store.findBy('slug', slug)
    if (!store) throw new AppException('Loja não encontrada', 404)
    return store
  }

  private async trackView(store: Store, userAgent: string | undefined) {
    const platform = userAgent ? Bowser.parse(userAgent).platform.type : undefined
    await store.incrementViews(platform === 'mobile' ? 'mobile' : 'desktop')
  }
}
