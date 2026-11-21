import OrderStatus from '#enums/order_status'
import PartnerCancelPolicy from '#enums/partner_cancel_policy'

export type PartnerCancelOption = 'cancel' | 'request' | 'none'

/**
 * What a partner may do about cancelling one of their orders (ADR 0024):
 *
 * - still unpaid with nothing received: always drop it (no food, no money);
 * - within the partner's window (`until_kitchen`: received; `until_ready`:
 *   received or preparing): cancel it (a paid order is refunded);
 * - past it (or `never`), until the store hands it over: ask a manager;
 * - handed over or cancelled: nothing.
 */
export function partnerCancelOption(
  policy: PartnerCancelPolicy,
  order: { status: OrderStatus; amountPaid: number }
): PartnerCancelOption {
  switch (order.status) {
    case OrderStatus.COMPLETED:
    case OrderStatus.CANCELLED:
      return 'none'
    case OrderStatus.PENDING_PAYMENT:
      return order.amountPaid > 0 ? 'request' : 'cancel'
    case OrderStatus.RECEIVED:
      return policy === PartnerCancelPolicy.NEVER ? 'request' : 'cancel'
    case OrderStatus.PREPARING:
      return policy === PartnerCancelPolicy.UNTIL_READY ? 'cancel' : 'request'
    case OrderStatus.READY:
      return 'request'
  }
}
