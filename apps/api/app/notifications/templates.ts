import type { NotificationCategory } from '@react-menu/contracts'
import StoreStatus from '#enums/store_status'

/**
 * Every notification the system can send is declared here. To add a new
 * one, add an entry: its `data` type is enforced at every
 * `NotificationService.notify()` call site, and `render` produces the text
 * shown in the app, in the realtime toast and in web push.
 *
 * `category` drives the tabs and icons in the web notifications popover
 * (`NotificationCategory` in @react-menu/contracts).
 */

export type { NotificationCategory } from '@react-menu/contracts'

export type RenderedNotification = {
  title: string
  body: string
  /** In-app path opened when the notification is clicked. */
  url?: string
}

type Template<Data> = {
  category: NotificationCategory
  render: (data: Data) => RenderedNotification
}

function defineTemplate<Data extends Record<string, unknown>>(template: Template<Data>) {
  return template
}

const storeStatusLabels: Record<StoreStatus, string> = {
  [StoreStatus.OPEN]: 'aberta',
  [StoreStatus.CLOSED]: 'fechada',
  [StoreStatus.MAINTENANCE]: 'em manutenção',
}

export const notificationTemplates = {
  'store.status_changed': defineTemplate<{
    storeId: string
    storeName: string
    status: StoreStatus
    changedBy: string
  }>({
    category: 'store',
    render: ({ storeId, storeName, status, changedBy }) => ({
      title: `${storeName} está ${storeStatusLabels[status]}`,
      body: `${changedBy} alterou o status da loja para ${storeStatusLabels[status]}.`,
      url: `/app/stores/${storeId}`,
    }),
  }),

  'system.announcement': defineTemplate<{ title: string; body: string; url?: string }>({
    category: 'system',
    render: ({ title, body, url }) => ({ title, body, url }),
  }),
}

export type NotificationType = keyof typeof notificationTemplates

export type NotificationData<Type extends NotificationType> = Parameters<
  (typeof notificationTemplates)[Type]['render']
>[0]

export function renderNotification<Type extends NotificationType>(
  type: Type,
  data: NotificationData<Type>
) {
  const template = notificationTemplates[type] as Template<NotificationData<Type>>
  return { category: template.category, ...template.render(data) }
}
