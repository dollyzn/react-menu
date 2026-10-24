import { inject } from '@adonisjs/core'
import { UAParser } from 'ua-parser-js'
import AppException from '#exceptions/app_exception'
import StoreStatus from '#enums/store_status'
import Store from '#models/store'
import type Addon from '#models/addon'
import InventoryService from '#services/inventory_service'
import PaymentService from '#services/payment_service'
import type PaymentMethod from '#enums/payment_method'

/** Public store fields; never includes credentials or internal settings. */
export function publicStore(store: Store, paymentMethods: PaymentMethod[]) {
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
    photoUrl: store.photoUrl,
    pickupEtaMinutes: store.pickupEtaMinutes,
    /** Served at "/" (its /<slug> page points there as canonical). */
    isDefault: store.isDefault,
    updatedAt: store.updatedAt.toISO()!,
    /** Checkout options, in display order (online first). */
    paymentMethods,
  }
}

@inject()
export default class PublicMenuService {
  constructor(
    private inventory: InventoryService,
    private payments: PaymentService
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
    const store = await Store.query()
      .if(
        slug,
        (query) => query.where('slug', slug!),
        (query) => query.where('isDefault', true)
      )
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
    if (!store) throw new AppException('Cardápio não encontrado', 404)

    const left = await this.inventory.capacities(store)
    if (options.track) await this.trackView(store, userAgent)

    return {
      store: publicStore(store, this.payments.checkoutMethods(store)),
      categories: store.categories
        .filter((category) => category.items.length > 0)
        .map((category) => ({
          id: category.id,
          name: category.name,
          description: category.description,
          items: category.items.map((item) => {
            const addon = (option: Addon) => ({
              id: option.id,
              name: option.name,
              description: option.description,
              price: option.price,
              photoUrl: option.photoUrl,
              isAvailable: option.isAvailable && left.addons.get(option.id) !== 0,
              stockLeft: left.addons.get(option.id) ?? null,
            })
            const optionGroups = item.optionGroups.map((group) => ({
              id: group.id,
              name: group.name,
              minChoices: group.minChoices,
              maxChoices: group.maxChoices,
              options: group.options.map(addon),
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
    const { device } = UAParser(userAgent)
    await store.incrementViews(device.is('mobile') ? 'mobile' : 'desktop')
  }
}
