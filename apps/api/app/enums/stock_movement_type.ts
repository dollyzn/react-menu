/** Quantities are signed: positive adds stock, negative removes it. */
const StockMovementType = {
  PURCHASE: 'purchase',
  ADJUSTMENT: 'adjustment',
  WASTE: 'waste',
  /** Automatic, when an order enters the kitchen. */
  CONSUMPTION: 'consumption',
  /** Automatic, when a consumed order is cancelled. */
  REVERSAL: 'reversal',
} as const

type StockMovementType = (typeof StockMovementType)[keyof typeof StockMovementType]

export default StockMovementType
