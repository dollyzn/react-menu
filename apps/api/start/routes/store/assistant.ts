import router from '@adonisjs/core/services/router'
import { frontOfHouse, managersOnly } from '#routes/store/shared'

const AssistantController = () => import('#controllers/assistant_controller')

/**
 * The store assistant: managers and attendants (each tool checks the role
 * again: attendants only read today's orders, the menu and whether the store
 * is open, as their screens in the panel show).
 */
export default function registerStoreAssistantRoutes() {
  router
    .group(() => {
      router.get('/', [AssistantController, 'status']).as('assistant.status')
      router.post('/chat', [AssistantController, 'chat']).as('assistant.chat')
      router
        .get('/conversations', [AssistantController, 'conversations'])
        .as('assistant.conversations')
      router
        .get('/conversations/:conversationId', [AssistantController, 'show'])
        .as('assistant.conversations.show')
      router
        .delete('/conversations/:conversationId', [AssistantController, 'destroy'])
        .as('assistant.conversations.destroy')
    })
    .prefix('/assistant')
    .use(frontOfHouse)

  router
    .put('/assistant-settings', [AssistantController, 'updateSettings'])
    .as('assistant.settings')
    .use(managersOnly)
  router
    .get('/assistant-costs', [AssistantController, 'costs'])
    .as('assistant.costs')
    .use(managersOnly)
  router
    .post('/assistant-settings/models', [AssistantController, 'models'])
    .as('assistant.models')
    .use(managersOnly)
}
