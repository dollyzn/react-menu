/** Role of a user inside one store (store_user.role). */
const StoreRole = {
  /** Everything: catalog, inventory, settings, orders. */
  MANAGER: 'manager',
  /** POS, orders board and pickup counter. */
  ATTENDANT: 'attendant',
  /** Kitchen production screen. */
  KITCHEN: 'kitchen',
} as const

type StoreRole = (typeof StoreRole)[keyof typeof StoreRole]

export default StoreRole
