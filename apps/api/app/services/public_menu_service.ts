import { inject } from '@adonisjs/core'
import { UAParser } from 'ua-parser-js'
import AppException from '#exceptions/app_exception'
import StoreStatus from '#enums/store_status'
import Store from '#models/store'
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
    isOpen: store.status === StoreStatus.OPEN,
    description: store.description,
    address: store.address,
    phone: store.phone,
    instagramUrl: store.instagramUrl,
    ifoodUrl: store.ifoodUrl,
    bannerUrl: store.bannerUrl,
    photoUrl: store.photoUrl,
    pickupEtaMinutes: store.pickupEtaMinutes,
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

  /** The menu of a store by slug, or of the default store when slug is omitted. */
  async menu(slug: string | undefined, userAgent: string | undefined, options = { track: true }) {
    const store = await Store.query()
      .if(
        slug,
        (query) => query.where('slug', slug!),
        (query) => query.where('isDefault', true)
      )
      .preload('categories', (categories) =>
        categories
          .orderBy('order', 'asc')
          .preload('items', (items) =>
            items
              .orderBy('order', 'asc')
              .preload('addons', (addons) => addons.orderBy('name', 'asc'))
          )
      )
      .first()
    if (!store) throw new AppException('Cardápio não encontrado', 404)

    const unavailable = await this.inventory.unavailable(store)
    if (options.track) await this.trackView(store, userAgent)

    return {
      store: publicStore(store, this.payments.checkoutMethods(store)),
      categories: store.categories
        .filter((category) => category.items.length > 0)
        .map((category) => ({
          id: category.id,
          name: category.name,
          description: category.description,
          items: category.items.map((item) => ({
            id: item.id,
            name: item.name,
            description: item.description,
            price: item.price,
            photoUrl: item.photoUrl,
            isAvailable: item.isAvailable && !unavailable.items.has(item.id),
            addons: item.addons.map((addon) => ({
              id: addon.id,
              name: addon.name,
              description: addon.description,
              price: addon.price,
              photoUrl: addon.photoUrl,
              isAvailable: addon.isAvailable && !unavailable.addons.has(addon.id),
            })),
          })),
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
