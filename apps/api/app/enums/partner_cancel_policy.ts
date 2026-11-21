/** Up to when a partner cancels an order on their own (ADR 0024). Later, they ask a manager. */
const PartnerCancelPolicy = {
  /** Never alone (an order still unpaid can always be dropped). */
  NEVER: 'never',
  /** While the kitchen hasn't started it (`received`). */
  UNTIL_KITCHEN: 'until_kitchen',
  /** Until it is ready (`received`, `preparing`). */
  UNTIL_READY: 'until_ready',
} as const

type PartnerCancelPolicy = (typeof PartnerCancelPolicy)[keyof typeof PartnerCancelPolicy]

export default PartnerCancelPolicy
