import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import drive from '@adonisjs/drive/services/main'
import { cuid } from '@adonisjs/core/helpers'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import Store from '#models/store'
import type StoreStatus from '#enums/store_status'
import { broadcastStoreEvent } from '#helpers/realtime'
import StoreRepository from '#repositories/store_repository'
import NotificationService from '#services/notification_service'
import type User from '#models/user'
import type { StoreFindOptions, StoreListOptions } from '#types/store_query'

export type StoreImagePayload = {
  banner?: MultipartFile
  photo?: MultipartFile
}

@inject()
export default class StoreService {
  constructor(
    private repo: StoreRepository,
    private notificationService: NotificationService
  ) {}

  async list(options?: StoreListOptions) {
    return await this.repo.paginate(options)
  }

  async get(id: string, options?: StoreFindOptions) {
    return await this.repo.findById(id, options)
  }

  async create(data: Partial<Store>, ownerId: string) {
    return await db.transaction(async (trx) => {
      const store = await this.repo.create(data, trx)
      await store.useTransaction(trx).related('users').attach([ownerId])
      return store
    })
  }

  async update(id: string, data: Partial<Store>) {
    return await db.transaction(async (trx) => {
      return await this.repo.update(id, data, trx)
    })
  }

  async updateStatus(id: string, status: StoreStatus, actor: User) {
    const { store, changed } = await db.transaction(async (trx) => {
      const current = await this.repo.requireById(id, trx)
      const previous = current.status
      const updated = await this.repo.update(id, { status }, trx)
      return { store: updated, changed: previous !== status }
    })

    if (changed) {
      broadcastStoreEvent({ type: 'store.status_changed', storeId: store.id, status: store.status })

      await this.notificationService.notifyStoreMembers(
        store.id,
        'store.status_changed',
        {
          storeId: store.id,
          storeName: store.name,
          status: store.status,
          changedBy: actor.name ?? actor.email,
        },
        { exceptUserId: actor.id }
      )
    }

    return store
  }

  async remove(id: string) {
    return await db.transaction(async (trx) => {
      await this.repo.delete(id, trx)
    })
  }

  async all(options?: StoreFindOptions) {
    return await this.repo.all(options)
  }

  async updateImages(id: string, images: StoreImagePayload) {
    const store = await this.repo.requireById(id)
    const disk = drive.use()

    if (images.banner) {
      if (store.bannerUrl) {
        const fileName = store.bannerUrl.split('/').pop()
        const key = `banners/${fileName}`
        if (fileName) await disk.delete(key)
      }

      const key = `banners/${store.id}_${cuid()}.${images.banner.extname}`
      await images.banner.moveToDisk(key)
      store.merge({ bannerUrl: await disk.getUrl(key) })
    }

    if (images.photo) {
      if (store.photoUrl) {
        const fileName = store.photoUrl.split('/').pop()
        const key = `photos/${fileName}`
        if (fileName) await disk.delete(key)
      }

      const key = `photos/${store.id}_${cuid()}.${images.photo.extname}`
      await images.photo.moveToDisk(key)
      store.merge({ photoUrl: await disk.getUrl(key) })
    }

    await store.save()
    return store
  }
}
