import PartnerCommissionType from '#enums/partner_commission_type'

/**
 * A partner's commission on an order (ADR 0024). Pure, so the API (the
 * snapshot kept on the order) and the tests agree; the partner's POS shows
 * a preview with the same rule.
 *
 * - percent: of the subtotal (the items, without the card fee), to the cent.
 * - per_unit: the value for each unit sold, whatever the item.
 */
export function commissionFor(
  rule: { type: PartnerCommissionType; value: number },
  order: { subtotal: number; units: number }
) {
  const amount =
    rule.type === PartnerCommissionType.PERCENT
      ? (order.subtotal * rule.value) / 100
      : order.units * rule.value
  // Half up to the cent, without floating point leftovers (10.005 → 10.01).
  return Math.round(Math.round(amount * 1000) / 10) / 100
}
