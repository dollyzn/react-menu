import type Order from '#models/order'
import type Store from '#models/store'

/** Customer-facing order (PublicOrder contract): no ids, no phone. */
export function publicOrder(order: Order, store: Store, checkoutUrl: string | null = null) {
  return {
    publicToken: order.publicToken,
    number: order.number,
    customerName: order.customerName,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    subtotal: order.subtotal,
    total: order.total,
    notes: order.notes,
    createdAt: order.createdAt.toISO(),
    readyAt: order.readyAt?.toISO() ?? null,
    completedAt: order.completedAt?.toISO() ?? null,
    store: {
      name: store.name,
      slug: store.slug,
      pickupEtaMinutes: store.pickupEtaMinutes,
      address: store.address,
      phone: store.phone,
    },
    items: order.items.map((line) => ({
      name: line.name,
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      notes: line.notes,
      total: line.total,
      addons: line.addons.map((addon) => ({ name: addon.name, unitPrice: addon.unitPrice })),
    })),
    checkoutUrl,
  }
}
