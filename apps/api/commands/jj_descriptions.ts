import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import Store from '#models/store'
import CatalogImportService from '#services/catalog_import_service'
import { JJ_PASTEIS } from '#catalog/jj_pasteis'

/**
 * Puts the JJ catalog's add-on descriptions (fillings, cheeses, optionals,
 * toppings, mini flavors) on a store loaded before they existed. Only empty
 * ones, unless --force; safe to run again:
 *
 *   node ace jj:descriptions --store=jj-pasteis
 */
export default class JjDescriptions extends BaseCommand {
  static commandName = 'jj:descriptions'
  static description = "Fill a store's add-on descriptions from the JJ Pastéis catalog"
  static options: CommandOptions = { startApp: true }

  @flags.string({ description: 'Slug of the store', required: true })
  declare store: string

  @flags.boolean({ description: 'Also replace descriptions typed in the panel', default: false })
  declare force: boolean

  async run() {
    const store = await Store.findBy('slug', this.store)
    if (!store) {
      this.logger.error(`Nenhuma loja com o slug "${this.store}".`)
      this.exitCode = 1
      return
    }
    const result = await new CatalogImportService().applyAddonDescriptions(store, JJ_PASTEIS, {
      force: this.force,
    })
    this.logger.success(`${result.filled.length} descrições aplicadas em ${store.name}.`)
    if (result.kept.length) {
      this.logger.info(`Mantidas (já tinham descrição; use --force): ${result.kept.join(', ')}`)
    }
    if (result.notFound.length) {
      this.logger.warning(
        `Sem complemento com esse nome e preço (preço mudou no painel?): ${result.notFound.join(', ')}`
      )
    }
    if (result.ambiguous.length) {
      this.logger.warning(
        `Mais de um complemento com o mesmo nome e preço: ${result.ambiguous.join(', ')}`
      )
    }
  }
}
