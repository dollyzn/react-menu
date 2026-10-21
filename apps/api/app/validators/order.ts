import vine from '@vinejs/vine'
import PaymentMethod from '#enums/payment_method'
import OrderStatus from '#enums/order_status'

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

const orderListValidator = vine.create(
  vine.object({
    status: vine.array(vine.enum(Object.values(OrderStatus))).optional(),
    date: vine.date({ formats: ['YYYY-MM-DD'] }).optional(),
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
