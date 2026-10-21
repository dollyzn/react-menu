import vine from '@vinejs/vine'
import PaymentMethod from '#enums/payment_method'
import OrderStatus from '#enums/order_status'
import OrderChannel from '#enums/order_channel'

const lines = vine
  .array(
    vine.object({
      itemId: vine.string().uuid(),
      quantity: vine.number().withoutDecimals().min(1).max(50),
      addonIds: vine.array(vine.string().uuid()).maxLength(20).optional(),
      notes: vine.string().trim().maxLength(200).optional(),
    })
  )
  .minLength(1)
  .maxLength(50)

const customerName = vine.string().trim().minLength(2).maxLength(80)
const notes = vine.string().trim().maxLength(500).optional()

/** Customer checkout on the public menu. */
const publicOrderValidator = vine.create(
  vine.object({
    customer: vine.object({
      name: customerName,
      phone: vine.string().trim().minLength(8).maxLength(25),
    }),
    paymentMethod: vine.enum(Object.values(PaymentMethod)),
    lines,
    notes,
  })
)

/** Staff entering an order at the point of sale. */
const posOrderValidator = vine.create(
  vine.object({
    customer: vine.object({
      name: customerName,
      phone: vine.string().trim().maxLength(25).optional(),
    }),
    lines,
    notes,
  })
)

const prepareUnitsValidator = vine.create(
  vine.object({
    units: vine
      .array(
        vine.object({
          lineId: vine.number().withoutDecimals(),
          quantity: vine.number().withoutDecimals().min(-50).max(50),
        })
      )
      .minLength(1)
      .maxLength(100),
  })
)

/**
 * Orders board and history. Without `page` the result is the plain list of
 * one business day (the live board); with `page` it is paginated.
 * `customerName` searches number, customer name or phone; `createdAt` is a
 * business-date range `YYYY-MM-DD~YYYY-MM-DD` (either side optional).
 */
const orderListValidator = vine.create(
  vine.object({
    status: vine.array(vine.enum(Object.values(OrderStatus))).optional(),
    channel: vine.array(vine.enum(Object.values(OrderChannel))).optional(),
    paymentMethod: vine.array(vine.enum(Object.values(PaymentMethod))).optional(),
    date: vine.date({ formats: ['YYYY-MM-DD'] }).optional(),
    createdAt: vine
      .string()
      .regex(/^(\d{4}-\d{2}-\d{2})?~(\d{4}-\d{2}-\d{2})?$/)
      .optional(),
    customerName: vine.string().trim().maxLength(80).optional(),
    sort: vine.enum(['createdAt:desc', 'createdAt:asc', 'total:desc', 'total:asc']).optional(),
    page: vine.number().withoutDecimals().min(1).optional(),
    perPage: vine.number().withoutDecimals().min(1).max(100).optional(),
  })
)

/** `?tokens=a,b`: the public tokens of orders this device placed. */
const orderLookupValidator = vine.create(
  vine.object({
    tokens: vine
      .string()
      .trim()
      .transform((value) => [...new Set(value.split(',').filter(Boolean))])
      .optional(),
  })
)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Keeps up to 30 well-formed tokens; anything else is ignored. */
function lookupTokens(tokens: string[] | undefined) {
  return (tokens ?? []).filter((token) => UUID.test(token)).slice(0, 30)
}

export {
  publicOrderValidator,
  posOrderValidator,
  prepareUnitsValidator,
  orderListValidator,
  orderLookupValidator,
  lookupTokens,
}
