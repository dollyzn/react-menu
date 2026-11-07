import db from '@adonisjs/lucid/services/db'
import type { NotificationPreferences, NotificationPreferencesInput } from '@react-menu/contracts'
import StoreRole from '#enums/store_role'
import NotificationPreference, { type ChannelChoices } from '#models/notification_preference'
import type User from '#models/user'
import { notificationTemplates, type NotificationType } from '#notifications/templates'

export type Delivery = { push: boolean; email: boolean }

const types = Object.entries(notificationTemplates) as [
  NotificationType,
  (typeof notificationTemplates)[NotificationType],
][]

/**
 * Each person's notification choices: push and e-mail per type (the bell
 * always records everything), stores muted entirely (no push or e-mail from
 * them), and the daily summary for the stores they manage.
 */
export default class NotificationPreferenceService {
  /** The types a person can receive: platform alerts only for super users. */
  private typesFor(user: Pick<User, 'superUser'>) {
    return types.filter(([, template]) => template.audience === 'staff' || user.superUser)
  }

  /** The stores the person works in (active memberships), with their role. */
  private async storesOf(userId: string) {
    return (await db
      .from('store_user as su')
      .join('stores as s', 's.id', 'su.store_id')
      .where('su.user_id', userId)
      .whereNull('su.disabled_at')
      .orderBy('s.name')
      .select('s.id', 's.name', 'su.role')) as { id: string; name: string; role: StoreRole }[]
  }

  async forUser(user: User): Promise<NotificationPreferences> {
    const saved = await NotificationPreference.findBy('userId', user.id)
    const stores = await this.storesOf(user.id)
    const muted = new Set(saved?.mutedStoreIds ?? [])
    return {
      types: this.typesFor(user).map(([type, template]) => ({
        type,
        category: template.category,
        label: template.label,
        description: template.description,
        push: saved?.channels[type]?.push ?? template.defaults.push,
        email: saved?.channels[type]?.email ?? template.defaults.email,
      })),
      stores: stores.map((store) => ({
        id: store.id,
        name: store.name,
        muted: muted.has(store.id),
      })),
      dailySummary: {
        // For the stores they manage.
        available: stores.some((store) => store.role === StoreRole.MANAGER),
        enabled: saved?.dailySummary ?? false,
        hour: saved?.dailySummaryHour ?? 8,
      },
    }
  }

  async update(user: User, input: NotificationPreferencesInput) {
    const allowed = new Map(this.typesFor(user))
    const channels: ChannelChoices = {}
    // Only what differs from the defaults: new defaults reach everyone else.
    for (const [type, choice] of Object.entries(input.channels)) {
      const template = allowed.get(type as NotificationType)
      if (!template) continue
      const entry: { push?: boolean; email?: boolean } = {}
      if (choice.push !== template.defaults.push) entry.push = choice.push
      if (choice.email !== template.defaults.email) entry.email = choice.email
      if (Object.keys(entry).length) channels[type] = entry
    }
    const stores = await this.storesOf(user.id)
    const mine = new Set(stores.map((store) => store.id))
    // The row is created once even when two saves arrive together (the
    // switches save on every change).
    const now = new Date()
    await db
      .table('notification_preferences')
      .insert({ user_id: user.id, created_at: now, updated_at: now })
      .onConflict('user_id')
      .ignore()
    const preference = await NotificationPreference.findByOrFail('userId', user.id)
    preference.merge({
      channels,
      mutedStoreIds: [...new Set(input.mutedStoreIds)].filter((id) => mine.has(id)),
      dailySummary: input.dailySummary.enabled,
      dailySummaryHour: input.dailySummary.hour,
    })
    await preference.save()
    return await this.forUser(user)
  }

  /**
   * How a notification reaches each recipient besides the bell: push and
   * e-mail per their choices, nothing from a store they muted.
   */
  async deliveries(userIds: string[], type: NotificationType, storeId: string | null) {
    const template = notificationTemplates[type]
    const rows = userIds.length
      ? await NotificationPreference.query().whereIn('userId', userIds)
      : []
    const byUser = new Map(rows.map((row) => [row.userId, row]))
    const result = new Map<string, Delivery>()
    for (const userId of userIds) {
      const saved = byUser.get(userId)
      if (storeId && saved?.mutedStoreIds.includes(storeId)) {
        result.set(userId, { push: false, email: false })
        continue
      }
      result.set(userId, {
        push: saved?.channels[type]?.push ?? template.defaults.push,
        email: saved?.channels[type]?.email ?? template.defaults.email,
      })
    }
    return result
  }
}
