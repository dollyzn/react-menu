import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import Item from '#models/item'
import Store from '#models/store'
import User from '#models/user'
import { blurPlaceholderOf } from '#helpers/image_placeholder'

/**
 * Makes the blurred previews (shown while an image loads) of images stored
 * before they existed: item photos, store banners and logos, avatars. Images
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
    let failed = 0
    const fill = async (
      url: string | null,
      current: string | null,
      save: (blur: string) => Promise<void>
    ) => {
      if (!url || (current && !this.force)) return
      const blur = await blurPlaceholderOf(url)
      if (!blur) {
        failed++
        this.logger.warning(`Não foi possível ler ${url}`)
        return
      }
      await save(blur)
      made++
    }

    const only = this.store ? await Store.findBy('slug', this.store) : null
    if (this.store && !only) {
      this.logger.error(`Nenhuma loja com o slug "${this.store}".`)
      this.exitCode = 1
      return
    }

    const items = Item.query().whereNotNull('photoUrl')
    if (only) items.whereHas('category', (query) => query.where('storeId', only.id))
    for (const item of await items) {
      await fill(item.photoUrl, item.photoBlur, async (blur) => {
        item.photoBlur = blur
        await item.save()
      })
    }
    for (const store of only ? [only] : await Store.query()) {
      await fill(store.bannerUrl, store.bannerBlur, async (blur) => {
        store.bannerBlur = blur
        await store.save()
      })
      await fill(store.photoUrl, store.photoBlur, async (blur) => {
        store.photoBlur = blur
        await store.save()
      })
    }
    for (const user of only ? [] : await User.query().whereNotNull('avatarUrl')) {
      await fill(user.avatarUrl, user.avatarBlur, async (blur) => {
        user.avatarBlur = blur
        await user.save()
      })
    }

    this.logger.success(`${made} prévias geradas.`)
    if (failed) this.logger.warning(`${failed} imagens não puderam ser lidas.`)
  }
}
