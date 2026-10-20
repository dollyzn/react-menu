const StoreStatus = {
  OPEN: 'open',
  CLOSED: 'closed',
  MAINTENANCE: 'maintenance',
} as const

type StoreStatus = (typeof StoreStatus)[keyof typeof StoreStatus]

export { StoreStatus }
export default StoreStatus
