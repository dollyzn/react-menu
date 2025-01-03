import vine from '@vinejs/vine'
import StoreStatus from '../enums/store-status.js'

const name = vine.string().trim()
const address = vine.string().trim().optional()
const instagramUrl = vine.string().url().startsWith('https://www.instagram.com').optional()
const ifoodUrl = vine.string().url().startsWith('https://www.ifood.com.br').optional()
const isDefault = vine.boolean().optional()

const storeValidator = vine.compile(
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

const updateValidator = vine.compile(
  vine.object({
    name: name.optional(),
    address,
    instagramUrl,
    ifoodUrl,
    slug: vine
      .string()
      .regex(/^[a-z0-9-]+$/)
      .unique(async (db, value, field) => {
        const storeId = field.data.params.id
        const match = await db
          .from('stores')
          .select('id')
          .where('slug', value)
          .andWhereNot('id', storeId)
          .first()

        return !match
      }),
    isDefault,
  })
)

const updateImagesValidator = vine.compile(
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

const updateStatusValidator = vine.compile(
  vine.object({
    status: vine.enum(Object.values(StoreStatus)),
  })
)

export { storeValidator, updateValidator, updateImagesValidator, updateStatusValidator }
