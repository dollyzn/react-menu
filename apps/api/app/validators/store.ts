import vine from '@vinejs/vine'
import { MAX_KITCHEN_LOOKAHEAD } from '#kitchen/production_queue'
import StoreStatus from '../enums/store_status.js'

const name = vine.string().trim()
const address = vine.string().trim().optional()
const instagramUrl = vine.string().url().startsWith('https://www.instagram.com').optional()
const ifoodUrl = vine.string().url().startsWith('https://www.ifood.com.br').optional()
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
      .unique(async (db, value, field) => {
        const storeId = field.data.params.storeId
        const match = await db
          .from('stores')
          .select('id')
          .where('slug', value)
          .andWhereNot('id', storeId)
          .first()

        return !match
      }),
    isDefault,
    phone: vine
      .string()
      .trim()
      .maxLength(25)
      .transform((value) => value.replace(/\D/g, '') || null)
      .optional(),
    description: vine.string().trim().maxLength(500).optional(),
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

export { storeValidator, updateValidator, updateImagesValidator, updateStatusValidator }
