import vine from '@vinejs/vine'

/** A report period: business days "YYYY-MM-DD", inclusive, up to a year. */
export const reportPeriodValidator = vine.create(
  vine.object({
    from: vine.date({ formats: ['YYYY-MM-DD'] }),
    to: vine.date({ formats: ['YYYY-MM-DD'] }).afterOrSameAs('from'),
  })
)
