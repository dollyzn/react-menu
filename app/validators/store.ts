import vine from '@vinejs/vine'
import StoreStatus from '../enums/store-status.js'

const name = vine.string().trim()
const status = vine.enum(Object.values(StoreStatus)).optional()
const address = vine.string().optional()
const instagramUrl = vine.string().optional()
const ifoodUrl = vine.string().optional()
const bannerUrl = vine.string().optional()
const photoUrl = vine.string().optional()
const slug = vine
  .string()
  .regex(/^[a-z0-9-]+$/)
  .unique(async (db, value) => {
    const match = await db.from('stores').select('id').where('slug', value).first()

    return !match
  })
const isDefault = vine.boolean().optional()

const storeValidator = vine.compile(
  vine.object({
    name,
    status,
    address,
    instagramUrl,
    ifoodUrl,
    bannerUrl,
    photoUrl,
    slug,
    isDefault,
  })
)

const updateValidator = vine.compile(
  vine.object({
    name: name.optional(),
    status,
    address,
    instagramUrl,
    ifoodUrl,
    bannerUrl,
    photoUrl,
    slug: slug.optional(),
    isDefault,
  })
)

const updateStatusValidator = vine.compile(
  vine.object({
    status: vine.enum(Object.values(StoreStatus)),
  })
)

export { storeValidator, updateValidator, updateStatusValidator }
