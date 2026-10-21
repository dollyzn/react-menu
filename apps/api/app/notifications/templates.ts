import type { NotificationCategory } from '@react-menu/contracts'
import StoreStatus from '#enums/store_status'
import StoreRole from '#enums/store_role'

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

export const storeRoleLabels: Record<StoreRole, string> = {
  [StoreRole.MANAGER]: 'gerente',
  [StoreRole.ATTENDANT]: 'atendente',
  [StoreRole.KITCHEN]: 'cozinha',
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

  'store.member_added': defineTemplate<{
    storeId: string
    storeName: string
    role: StoreRole
    addedBy: string
  }>({
    category: 'store',
    render: ({ storeId, storeName, role, addedBy }) => ({
      title: `Você agora faz parte da ${storeName}`,
      body: `${addedBy} adicionou você à equipe como ${storeRoleLabels[role]}.`,
      url: `/app/stores/${storeId}`,
    }),
  }),

  'order.received': defineTemplate<{
    storeId: string
    orderNumber: number
    customerName: string
    itemsCount: number
  }>({
    category: 'order',
    render: ({ storeId, orderNumber, customerName, itemsCount }) => ({
      title: `Novo pedido #${orderNumber}`,
      body: `${customerName} · ${itemsCount} ${itemsCount === 1 ? 'item' : 'itens'}`,
      url: `/app/stores/${storeId}/orders`,
    }),
  }),

  'order.refund_failed': defineTemplate<{
    storeId: string
    orderId: string
    orderNumber: number
  }>({
    category: 'order',
    render: ({ storeId, orderId, orderNumber }) => ({
      title: `Reembolso do pedido #${orderNumber} não concluído`,
      body: 'O reembolso automático falhou várias vezes. Tente "Reembolsar agora" no pedido ou faça pelo Mercado Pago.',
      url: `/app/stores/${storeId}/orders?view=historico&pedido=${orderId}`,
    }),
  }),

  'system.job_failed': defineTemplate<{ job: string; detail: string }>({
    category: 'system',
    render: ({ job, detail }) => ({
      title: 'Tarefa em segundo plano falhou',
      body: `${job} desistiu depois de todas as tentativas: ${detail}`,
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
