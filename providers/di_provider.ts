import type { ApplicationService } from '@adonisjs/core/types'
import AddonRepository from '#repositories/addon_repository'
import CategoryRepository from '#repositories/category_repository'
import ItemRepository from '#repositories/item_repository'
import StoreRepository from '#repositories/store_repository'
import UserRepository from '#repositories/user_repository'
import AddonService from '#services/addon_service'
import AuthService from '#services/auth_service'
import CategoryService from '#services/category_service'
import DashboardService from '#services/dashboard_service'
import ItemService from '#services/item_service'
import MenuService from '#services/menu_service'
import StoreService from '#services/store_service'
import UserService from '#services/user_service'

export default class DiProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    const c = this.app.container

    c.singleton(StoreRepository, () => new StoreRepository())
    c.singleton(UserRepository, () => new UserRepository())
    c.singleton(CategoryRepository, () => new CategoryRepository())
    c.singleton(AddonRepository, () => new AddonRepository())
    c.singleton(ItemRepository, () => new ItemRepository())

    c.singleton(StoreService, async (resolver) => {
      return new StoreService(await resolver.make(StoreRepository))
    })
    c.singleton(UserService, async (resolver) => {
      return new UserService(await resolver.make(UserRepository))
    })
    c.singleton(CategoryService, async (resolver) => {
      return new CategoryService(await resolver.make(CategoryRepository))
    })
    c.singleton(AddonService, async (resolver) => {
      return new AddonService(await resolver.make(AddonRepository))
    })
    c.singleton(ItemService, async (resolver) => {
      return new ItemService(
        await resolver.make(ItemRepository),
        await resolver.make(AddonRepository)
      )
    })
    c.singleton(MenuService, async (resolver) => {
      return new MenuService(await resolver.make(StoreRepository))
    })
    c.singleton(DashboardService, () => new DashboardService())
    c.singleton(AuthService, () => new AuthService())
  }
}
