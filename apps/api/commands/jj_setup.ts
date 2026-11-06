import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import Store from '#models/store'
import CatalogImportService from '#services/catalog_import_service'
import { JJ_PASTEIS, JJ_PASTEIS_PROFILE } from '#catalog/jj_pasteis'

/**
 * Loads the JJ Pastéis menu (pastries, portions, drinks), add-ons, choice
 * groups, stock and recipes into an existing store, once (the store must
 * have no menu yet), and fills its profile where it's empty: description,
 * address, Instagram, logo and banner. Production setup, after creating the
 * store in the panel:
 *
 *   node ace jj:setup --store=jj-pasteis
 */
export default class JjSetup extends BaseCommand {
  static commandName = 'jj:setup'
  static description = 'Load the JJ Pastéis menu, choice groups and stock into an empty store'
  static options: CommandOptions = { startApp: true }

  @flags.string({ description: 'Slug of the store (created in the panel)', required: true })
  declare store: string

  @flags.boolean({ description: 'Skip the illustrative item photos', default: false })
  declare noPhotos: boolean

  async run() {
    const store = await Store.findBy('slug', this.store)
    if (!store) {
      this.logger.error(`Nenhuma loja com o slug "${this.store}". Crie a loja no painel primeiro.`)
      this.exitCode = 1
      return
    }
    const importer = new CatalogImportService()
    try {
      const summary = await importer.import(store, JJ_PASTEIS, { photos: !this.noPhotos })
      this.logger.success(
        `${store.name}: ${summary.categories} categorias, ${summary.items} itens, ` +
          `${summary.addons} adicionais, ${summary.groups} grupos de escolha, ` +
          `${summary.ingredients} itens de estoque, ${summary.photos} fotos. Controle de estoque ligado.`
      )
      const filled = await importer.applyProfile(store, JJ_PASTEIS_PROFILE)
      const labels: Record<string, string> = {
        description: 'descrição',
        address: 'endereço',
        instagramUrl: 'Instagram',
        photoUrl: 'logo',
        bannerUrl: 'banner',
      }
      this.logger.info(
        filled.length
          ? `Perfil da loja: ${filled.map((field) => labels[field]).join(', ')} preenchido(s).`
          : 'Perfil da loja já estava preenchido: nada mudou.'
      )
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error))
      this.exitCode = 1
    }
  }
}
