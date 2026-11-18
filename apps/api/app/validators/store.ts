import vine from '@vinejs/vine'

/**
 * Paths the web owns at the root (`/<slug>` is a store's menu): a store with
 * one of these slugs would be unreachable. Scanner paths blocked by the web's
 * proxy are here too.
 */
const RESERVED_SLUGS = [
  'app',
  'api',
  'pedido',
  'pedidos',
  'privacy',
  'terms',
  'icons',
  'fonts',
  'screenshots',
  'login-marquee',
  'csp-report',
  'muitos-acessos',
  'opengraph-image',
  'wp-admin',
  'wp-content',
  'wp-includes',
  'wp-json',
  'wordpress',
  'phpmyadmin',
  'pma',
  'cgi-bin',
  'xmlrpc',
  'vendor',
]
import { MAX_KITCHEN_LOOKAHEAD } from '#kitchen/production_queue'
import StoreStatus from '../enums/store_status.js'

const name = vine.string().trim()
// Nullable: a field cleared in the form arrives as null (empty strings become
// null in the body parser) and must clear the column, not be skipped.
const address = vine.string().trim().nullable().optional()
const instagramUrl = vine
  .string()
  .url()
  .startsWith('https://www.instagram.com')
  .nullable()
  .optional()
const ifoodUrl = vine.string().url().startsWith('https://www.ifood.com.br').nullable().optional()
const isDefault = vine.boolean().optional()

const storeValidator = vine.create(
  vine.object({
    name,
    address,
    instagramUrl,
    ifoodUrl,
    slug: vine
      .string()
      .regex(/^[a-z0-9-]+$/)
      .notIn(RESERVED_SLUGS)
      .unique(async (db, value) => {
        const match = await db.from('stores').select('id').where('slug', value).first()

        return !match
      }),
    isDefault,
  })
)

const updateValidator = vine.create(
  vine.object({
    name: name.optional(),
    address,
    instagramUrl,
    ifoodUrl,
    slug: vine
      .string()
      .regex(/^[a-z0-9-]+$/)
      .notIn(RESERVED_SLUGS)
      .unique(async (db, value, field) => {
        const storeId = field.data.params.storeId
        const match = await db
          .from('stores')
          .select('id')
          .where('slug', value)
          .andWhereNot('id', storeId)
          .first()

        return !match
      })
      // The store page saves its profile and its operation separately.
      .optional(),
    isDefault,
    phone: vine
      .string()
      .trim()
      .maxLength(25)
      // Runs for null too (a cleared field).
      .transform((value) => (value ?? '').replace(/\D/g, '') || null)
      .nullable()
      .optional(),
    description: vine.string().trim().maxLength(500).nullable().optional(),
    pickupEtaMinutes: vine.number().withoutDecimals().min(1).max(240).optional(),
    inventoryEnabled: vine.boolean().optional(),
    counterPaymentEnabled: vine.boolean().optional(),
    kitchenBatchLookahead: vine
      .number()
      .withoutDecimals()
      .min(0)
      .max(MAX_KITCHEN_LOOKAHEAD)
      .optional(),
  })
)

const updateImagesValidator = vine.create(
  vine.object({
    banner: vine
      .file({
        size: '2mb',
        extnames: ['jpg', 'jpeg', 'png', 'webp'],
      })
      .optional()
      .requiredIfMissing('photo'),
    photo: vine
      .file({
        size: '2mb',
        extnames: ['jpg', 'jpeg', 'png', 'webp'],
      })
      .optional()
      .requiredIfMissing('banner'),
  })
)

const updateStatusValidator = vine.create(
  vine.object({
    status: vine.enum(Object.values(StoreStatus)),
  })
)

const time = vine.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)

/** Weekly schedule (see #helpers/opening_hours for overlap rules). */
const updateHoursValidator = vine.create(
  vine.object({
    scheduleEnabled: vine.boolean(),
    openingHours: vine
      .array(
        vine.object({
          day: vine.number().withoutDecimals().min(0).max(6),
          opens: time,
          closes: time,
        })
      )
      .maxLength(21),
  })
)

export {
  storeValidator,
  updateValidator,
  updateImagesValidator,
  updateStatusValidator,
  updateHoursValidator,
}
