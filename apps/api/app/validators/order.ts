import vine from '@vinejs/vine'
import PaymentMethod from '#enums/payment_method'
import OrderStatus from '#enums/order_status'
import OrderChannel from '#enums/order_channel'
import { COUNTER_PAYMENT_METHODS } from '#enums/counter_payment_method'

const lines = vine
  .array(
    vine.object({
      itemId: vine.string().uuid(),
      quantity: vine.number().withoutDecimals().min(1).max(50),
      /** Add-ons outside choice groups (older bags send group options here too). */
      addonIds: vine.array(vine.string().uuid()).maxLength(20).optional(),
      /** Choice group picks: the group decides the price and the label. */
      choices: vine
        .array(vine.object({ groupId: vine.string().uuid(), addonId: vine.string().uuid() }))
        .maxLength(40)
        .optional(),
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
    // Checkout Pro (mercado_pago) is legacy: only older orders carry it.
    paymentMethod: vine.enum([PaymentMethod.PIX, PaymentMethod.CARD, PaymentMethod.COUNTER]),
    lines,
    notes,
  })
)

/**
 * Paying an order on its tracking page. Card data never reaches us: the
 * browser tokenizes it (Card Payment Brick) and sends only the token.
 */
const publicPaymentValidator = vine.create(
  vine.object({
    method: vine.enum([PaymentMethod.PIX, PaymentMethod.CARD]),
    payer: vine.object({ email: vine.string().trim().email().maxLength(254) }),
    card: vine
      .object({
        token: vine.string().trim().maxLength(255),
        installments: vine.number().withoutDecimals().min(1).max(24),
        paymentMethodId: vine.string().trim().maxLength(40),
        paymentTypeId: vine.string().trim().maxLength(20).optional(),
        issuerId: vine.string().trim().maxLength(40).optional(),
        identification: vine
          .object({
            type: vine.string().trim().maxLength(10),
            number: vine.string().trim().maxLength(20),
          })
          .optional(),
      })
      .optional()
      .requiredWhen('method', '=', PaymentMethod.CARD),
    /** The total the customer saw (order plus card fee); a changed one is refused. */
    amount: vine.number().min(0).decimal([0, 2]).optional(),
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
    /** Paid as it was sent: how. Left out: paid later (or on the card machine). */
    counterMethod: vine.enum(COUNTER_PAYMENT_METHODS).optional(),
    /** About to be charged on the card machine (the store may hold it until approved). */
    payOnMachine: vine.boolean().optional(),
    /** "Pagar depois" (fiado): handed over unpaid, settled another day (needs the phone). */
    payLater: vine.boolean().optional(),
  })
)

/** "Pagar depois" on an order already sent: the phone when the order has none. */
const payLaterValidator = vine.create(
  vine.object({
    name: customerName.optional(),
    phone: vine.string().trim().maxLength(25).optional(),
  })
)

/**
 * Items added to an order waiting in the queue: charged now (`counterMethod`)
 * or left to receive (the card machine, or at pickup).
 */
const addOrderItemsValidator = vine.create(
  vine.object({
    lines,
    counterMethod: vine.enum(COUNTER_PAYMENT_METHODS).optional(),
    /** With `counterMethod`: what the cashier showed and took (all that is due after adding). */
    amount: vine.number().min(0).max(999999.99).optional(),
  })
)

/** A customer's browser for "avise quando ficar pronto" (Firebase Installation ID). */
const orderPushValidator = vine.create(
  vine.object({
    fid: vine.string().trim().minLength(10).maxLength(200),
  })
)

/** "Receber pagamento": how the counter was paid. */
const receivePaymentValidator = vine.create(
  vine.object({
    method: vine.enum(COUNTER_PAYMENT_METHODS),
    /** The amount the cashier saw and took: refused (409) if what is due changed meanwhile. */
    amount: vine.number().min(0).max(999999.99).optional(),
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
    /** Also count each filter option (`meta.facets`): only the table asks, on its first page. */
    facets: vine.boolean().optional(),
  })
)

/** The managers' "Pagar depois" list: search, sort and pages like the history. */
const payLaterListValidator = vine.create(
  vine.object({
    customerName: vine.string().trim().maxLength(80).optional(),
    sort: vine
      .enum(['createdAt:asc', 'createdAt:desc', 'amountDue:desc', 'amountDue:asc'])
      .optional(),
    page: vine.number().withoutDecimals().min(1).optional(),
    perPage: vine.number().withoutDecimals().min(1).max(100).optional(),
  })
)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Keeps up to 30 well-formed tokens; anything else is ignored. */
function lookupTokens(tokens: string[] | undefined) {
  return (tokens ?? []).filter((token) => UUID.test(token)).slice(0, 30)
}

export {
  publicPaymentValidator,
  publicOrderValidator,
  posOrderValidator,
  payLaterValidator,
  addOrderItemsValidator,
  receivePaymentValidator,
  orderPushValidator,
  prepareUnitsValidator,
  orderListValidator,
  payLaterListValidator,
  lookupTokens,
}
