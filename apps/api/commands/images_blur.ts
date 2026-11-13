import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import Addon from '#models/addon'
import Item from '#models/item'
import Store from '#models/store'
import User from '#models/user'
import { blurPlaceholderOf } from '#helpers/image_placeholder'

/**
 * Makes the blurred previews (shown while an image loads) of images stored
 * before they existed: item and add-on photos, store banners and logos, avatars. Images
 * that already have one are skipped unless --force. Safe to run again:
 *
 *   node ace images:blur [--store=<slug>]
 */
export default class ImagesBlur extends BaseCommand {
  static commandName = 'images:blur'
  static description = 'Make the blurred previews of stored images that have none'
  static options: CommandOptions = { startApp: true }

  @flags.boolean({ description: 'Make them again for every image', default: false })
  declare force: boolean

  @flags.string({ description: "Only this store's photos (slug); avatars are skipped then" })
  declare store?: string

  async run() {
    let made = 0
    const unreadable = new Set<string>()
    // Catalog photos are shared by many items: read and encode each URL once.
    const byUrl = new Map<string, Promise<string | null>>()
    /** The preview to store, or null to leave the field as it is. */
    const preview = async (url: string | null, current: string | null) => {
      if (!url || (current && !this.force)) return null
      if (!byUrl.has(url)) byUrl.set(url, blurPlaceholderOf(url))
      const blur = await byUrl.get(url)!
      if (!blur) {
        if (!unreadable.has(url)) this.logger.warning(`Não foi possível ler ${url}`)
        unreadable.add(url)
        return null
      }
      made++
      return blur
    }

    const only = this.store ? await Store.findBy('slug', this.store) : null
    if (this.store && !only) {
      this.logger.error(`Nenhuma loja com o slug "${this.store}".`)
      this.exitCode = 1
      return
    }

    /** Rows with an uploaded photo: the ones without a preview (all with --force). */
    const photos = async (
      rows: { photoUrl: string | null; photoBlur: string | null; save(): Promise<unknown> }[]
    ) => {
      for (const row of rows) {
        const blur = await preview(row.photoUrl, row.photoBlur)
        if (!blur) continue
        row.photoBlur = blur
        await row.save()
      }
    }
    const items = Item.query().whereNotNull('photoUrl')
    if (!this.force) items.whereNull('photoBlur')
    if (only) items.whereHas('category', (query) => query.where('storeId', only.id))
    await photos(await items)
    const addons = Addon.query().whereNotNull('photoUrl')
    if (!this.force) addons.whereNull('photoBlur')
    if (only) addons.where('storeId', only.id)
    await photos(await addons)
    for (const store of only ? [only] : await Store.query()) {
      const banner = await preview(store.bannerUrl, store.bannerBlur)
      const logo = await preview(store.photoUrl, store.photoBlur)
      if (banner) store.bannerBlur = banner
      if (logo) store.photoBlur = logo
      if (banner || logo) await store.save()
    }
    const users = User.query().whereNotNull('avatarUrl')
    if (!this.force) users.whereNull('avatarBlur')
    for (const user of only ? [] : await users) {
      const blur = await preview(user.avatarUrl, user.avatarBlur)
      if (blur) {
        user.avatarBlur = blur
        await user.save()
      }
    }

    this.logger.success(`${made} prévias geradas.`)
    if (unreadable.size) this.logger.warning(`${unreadable.size} imagens não puderam ser lidas.`)
  }
}
