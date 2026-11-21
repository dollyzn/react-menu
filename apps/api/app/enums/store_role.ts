/** Role of a user inside one store (store_user.role). */
const StoreRole = {
  /** Everything: catalog, inventory, settings, orders. */
  MANAGER: 'manager',
  /** POS, orders board and pickup counter. */
  ATTENDANT: 'attendant',
  /** Kitchen production screen. */
  KITCHEN: 'kitchen',
  /**
   * Sells the store's menu outside it (ADR 0024): only the partner area
   * (`/stores/:storeId/partner/*`), for the partner in `store_user.partner_id`.
   */
  PARTNER: 'partner',
} as const

type StoreRole = (typeof StoreRole)[keyof typeof StoreRole]

export default StoreRole
