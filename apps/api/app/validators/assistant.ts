import vine from '@vinejs/vine'

/**
 * `POST /stores/:id/assistant/chat`: the chat's id (created by the panel) and
 * its last message, as the AI SDK sends it. A person's message (text and up
 * to four photos) asks something new; the assistant's own message comes back
 * with the answers to the writes that waited for approval. Everything else in
 * the conversation is read from the database, never from the client.
 */
export const assistantChatValidator = vine.create(
  vine.object({
    id: vine.string().uuid(),
    effort: vine.enum(['fast', 'deep'] as const).optional(),
    /** One of the store's models ("openai:gpt-6.2-sol"); the default when left out. */
    model: vine.string().trim().maxLength(130).optional(),
    /** The panel screen the person is on ("Relatórios"), for context. */
    page: vine.string().trim().maxLength(60).optional(),
    message: vine.object({
      id: vine.string().trim().minLength(1).maxLength(100),
      role: vine.enum(['user', 'assistant'] as const),
      parts: vine.array(vine.any()).maxLength(200),
    }),
  })
)

/** `POST …/conversations/:id/suggestions`: the model the chat is using. */
export const assistantSuggestionsValidator = vine.create(
  vine.object({ model: vine.string().trim().maxLength(130).optional() })
)

export const MAX_TEXT = 4000
export const MAX_IMAGES = 4
/** Decoded bytes per photo (the panel resizes them first). */
export const MAX_IMAGE_BYTES = 3_500_000
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const

const PROVIDERS = ['anthropic', 'openai', 'google'] as const
const apiKey = () => vine.string().trim().minLength(10).maxLength(400).nullable().optional()

/**
 * `PUT /stores/:id/assistant-settings` (managers): keys per provider (null
 * removes one, left out keeps it), the chat's models and the default one.
 */
export const assistantSettingsValidator = vine.create(
  vine.object({
    keys: vine.object({ anthropic: apiKey(), openai: apiKey(), google: apiKey() }).optional(),
    models: vine
      .array(
        vine.object({
          provider: vine.enum(PROVIDERS),
          model: vine
            .string()
            .trim()
            .regex(/^[\w.:/-]+$/)
            .maxLength(100),
          name: vine.string().trim().minLength(1).maxLength(100),
          contextWindow: vine.number().withoutDecimals().positive().nullable(),
          pricing: vine
            .object({
              input: vine.number().min(0).max(10_000),
              cachedInput: vine.number().min(0).max(10_000),
              output: vine.number().min(0).max(10_000),
            })
            .nullable()
            .optional(),
        })
      )
      .maxLength(20)
      .optional(),
    defaultModel: vine.string().trim().maxLength(130).nullable().optional(),
  })
)

/** `POST /stores/:id/assistant-settings/models`: which provider, and a key not saved yet. */
export const assistantModelsValidator = vine.create(
  vine.object({
    provider: vine.enum(PROVIDERS),
    apiKey: vine.string().trim().minLength(10).maxLength(400).optional(),
  })
)
