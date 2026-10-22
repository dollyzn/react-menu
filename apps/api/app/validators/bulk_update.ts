import vine from '@vinejs/vine'

/**
 * Bulk edit of items or add-ons (see `#helpers/bulk_update`): final values
 * per row plus the `updatedAt` the client saw.
 */
export const bulkUpdateValidator = vine.create(
  vine.object({
    changes: vine
      .array(
        vine.object({
          id: vine.string().uuid(),
          updatedAt: vine.string().trim().minLength(1),
          price: vine.number().positive().max(99999.99).decimal([0, 2]).optional(),
          isAvailable: vine.boolean().optional(),
        })
      )
      .minLength(1)
      .maxLength(500)
      .distinct('id'),
  })
)
