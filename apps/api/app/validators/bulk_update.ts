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
          // 0 for add-ons (included in the price); items refuse it in ItemService.
          price: vine.number().min(0).max(99999.99).decimal([0, 2]).optional(),
          isAvailable: vine.boolean().optional(),
        })
      )
      .minLength(1)
      .maxLength(500)
      .distinct('id'),
  })
)
