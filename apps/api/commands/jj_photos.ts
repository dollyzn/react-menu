import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import Store from '#models/store'
import CatalogImportService from '#services/catalog_import_service'

/**
 * Puts photos from a local folder on a store's items and add-ons, matched by
 * name ("Pastel de Palmito" -> pastel-de-palmito.webp). The folder stays out
 * of git; empty and catalog photos are replaced, photos uploaded in the
 * panel only with --force:
 *
 *   node ace jj:photos --store=jj-pasteis --dir=../../../jj-fotos
 */
export default class JjPhotos extends BaseCommand {
  static commandName = 'jj:photos'
  static description = "Put photos from a local folder on a store's items and add-ons (by name)"
  static options: CommandOptions = { startApp: true }

  @flags.string({ description: 'Slug of the store', required: true })
  declare store: string

  @flags.string({ description: 'Folder with <item-name-slug>.webp|jpg|png', required: true })
  declare dir: string

  @flags.boolean({ description: 'Also replace photos uploaded in the panel', default: false })
  declare force: boolean

  async run() {
    const store = await Store.findBy('slug', this.store)
    if (!store) {
      this.logger.error(`Nenhuma loja com o slug "${this.store}".`)
      this.exitCode = 1
      return
    }
    const result = await new CatalogImportService().applyLocalPhotos(store, this.dir, {
      force: this.force,
    })
    this.logger.success(`${result.applied.length} fotos aplicadas em ${store.name}.`)
    if (result.skipped.length) {
      this.logger.info(`Mantidas (enviadas pelo painel; use --force): ${result.skipped.join(', ')}`)
    }
    if (result.unmatched.length) {
      this.logger.warning(`Arquivos sem item com esse nome: ${result.unmatched.join(', ')}`)
    }
  }
}
