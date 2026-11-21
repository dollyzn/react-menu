/** A request to cancel an order, decided by a manager. */
const CancelRequestStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const

type CancelRequestStatus = (typeof CancelRequestStatus)[keyof typeof CancelRequestStatus]

export default CancelRequestStatus
