/** A person's role inside a partner (ADR 0024; `store_user.partner_role`). */
const PartnerMemberRole = {
  /** Sells, follows the orders, and sees the commission. */
  MANAGER: 'manager',
  /** Sells and follows the orders; no commission anywhere. */
  ATTENDANT: 'attendant',
} as const

type PartnerMemberRole = (typeof PartnerMemberRole)[keyof typeof PartnerMemberRole]

export default PartnerMemberRole
