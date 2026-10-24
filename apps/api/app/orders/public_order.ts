import PaymentAttemptStatus from '#enums/payment_attempt_status'
import OrderStatus from '#enums/order_status'
import type PaymentMethod from '#enums/payment_method'
import type Order from '#models/order'
import type Payment from '#models/payment'
import type Store from '#models/store'

/** What the tracking page needs to pay: the latest attempt and the options. */
export type CheckoutState = {
  payment: Payment | null
  methods: PaymentMethod[]
}

/** Customer-facing payment attempt: never gateway ids. */
function publicPayment(payment: Payment) {
  const pending = payment.status === PaymentAttemptStatus.PENDING
  return {
    method: payment.method,
    status: payment.status,
    statusDetail: payment.statusDetail,
    amount: payment.amount,
    pix:
      payment.pixQrCode && pending
        ? {
            qrCode: payment.pixQrCode,
            ticketUrl: payment.pixTicketUrl,
            expiresAt: payment.expiresAt?.toISO() ?? null,
          }
        : null,
    /** 3-D Secure: the bank's page where the payer confirms the card. */
    challenge:
      payment.challengeUrl && pending
        ? { url: payment.challengeUrl, expiresAt: payment.expiresAt?.toISO() ?? null }
        : null,
    /** Development fake gateway: the page offers "Simular pagamento". */
    simulated: payment.gateway === 'fake',
  }
}

/** Customer-facing order (PublicOrder contract): no ids, no phone. */
export function publicOrder(order: Order, store: Store, checkout?: CheckoutState) {
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
      photoUrl: store.photoUrl,
      address: store.address,
      phone: store.phone,
    },
    // Status changes with their time (needs `history` preloaded).
    timeline: (order.history ?? [])
      .slice()
      .sort((a, b) => a.id - b.id)
      .map((entry) => ({ status: entry.toStatus, at: entry.createdAt.toISO()! })),
    items: order.items.map((line) => ({
      itemId: line.itemId,
      name: line.name,
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      notes: line.notes,
      total: line.total,
      addons: line.addons.map((addon) => ({
        addonId: addon.addonId,
        name: addon.name,
        unitPrice: addon.unitPrice,
      })),
    })),
    payment: checkout?.payment ? publicPayment(checkout.payment) : null,
    // Only while the order waits for payment.
    checkout:
      order.status === OrderStatus.PENDING_PAYMENT && checkout
        ? {
            methods: checkout.methods,
            mercadoPagoPublicKey: store.mercadoPagoPublicKey,
            maxInstallments: store.maxInstallments,
          }
        : null,
  }
}

/** Compact order for history lists (PublicOrderSummary contract). */
export function publicOrderSummary(order: Order, store: Pick<Store, 'name' | 'slug'>) {
  return {
    publicToken: order.publicToken,
    number: order.number,
    status: order.status,
    paymentStatus: order.paymentStatus,
    total: order.total,
    createdAt: order.createdAt.toISO(),
    readyAt: order.readyAt?.toISO() ?? null,
    store: { name: store.name, slug: store.slug },
    items: order.items.map((line) => ({ name: line.name, quantity: line.quantity })),
  }
}
