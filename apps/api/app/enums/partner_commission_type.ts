/** How a partner's commission is worked out (ADR 0024). */
const PartnerCommissionType = {
  /** A percentage of the order's subtotal. */
  PERCENT: 'percent',
  /** A fixed amount for each unit sold. */
  PER_UNIT: 'per_unit',
} as const

type PartnerCommissionType = (typeof PartnerCommissionType)[keyof typeof PartnerCommissionType]

export default PartnerCommissionType
