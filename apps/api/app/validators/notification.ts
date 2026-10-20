import vine from '@vinejs/vine'

const endpoint = vine.string().url().maxLength(2048)

const pushSubscribeValidator = vine.create(
  vine.object({
    endpoint,
    keys: vine.object({
      p256dh: vine.string().maxLength(512),
      auth: vine.string().maxLength(512),
    }),
  })
)

const pushEndpointValidator = vine.create(vine.object({ endpoint }))

export { pushSubscribeValidator, pushEndpointValidator }
