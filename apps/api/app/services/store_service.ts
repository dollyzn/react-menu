import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'
import drive from '@adonisjs/drive/services/main'
import { randomUUID } from 'node:crypto'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import Store from '#models/store'
import { DateTime } from 'luxon'
import StoreStatus from '#enums/store_status'
import AppException from '#exceptions/app_exception'
import {
  currentOpening,
  nextOpeningSpan,
  openingHoursError,
  type OpeningInterval,
} from '#helpers/opening_hours'
import { BUSINESS_TIMEZONE } from '#services/order_service'
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

  /**
   * Manual open/closed/maintenance. On a schedule, "closed" means "close
   * now": until the end of the current (or next) opening, then the schedule
   * again; "open" clears it and follows the schedule.
   */
  async updateStatus(id: string, status: StoreStatus, actor: User) {
    const { store, changed } = await db.transaction(async (trx) => {
      const current = await this.repo.requireById(id, trx)
      const wasOpen = current.isOpen
      const previous = current.status
      let data: Partial<Store> = { status, closedUntil: null }
      if (current.scheduleEnabled && status === StoreStatus.CLOSED) {
        const now = DateTime.now()
        const opening =
          currentOpening(current.openingHours, now, BUSINESS_TIMEZONE) ??
          nextOpeningSpan(current.openingHours, now, BUSINESS_TIMEZONE)
        data = { status: StoreStatus.OPEN, closedUntil: opening?.end ?? null }
        if (!opening) data.status = StoreStatus.CLOSED
      }
      const updated = await this.repo.update(id, data, trx)
      return { store: updated, changed: previous !== updated.status || wasOpen !== updated.isOpen }
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

  /** The weekly schedule and whether the store follows it. */
  async updateHours(
    id: string,
    data: { scheduleEnabled: boolean; openingHours: OpeningInterval[] }
  ) {
    const error = openingHoursError(data.openingHours)
    if (error) throw new AppException(error, 422, 'E_INVALID_HOURS')
    if (data.scheduleEnabled && data.openingHours.length === 0) {
      throw new AppException(
        'Adicione pelo menos um horário para abrir pelo horário.',
        422,
        'E_INVALID_HOURS'
      )
    }
    return await db.transaction(async (trx) => {
      const current = await this.repo.requireById(id, trx)
      let status = current.status
      if (status !== StoreStatus.MAINTENANCE && data.scheduleEnabled !== current.scheduleEnabled) {
        // Turning the schedule on: it decides from now on (a manual "closed"
        // would keep the store shut). Off: keep what it is right now.
        status = data.scheduleEnabled || current.isOpen ? StoreStatus.OPEN : StoreStatus.CLOSED
      }
      return await this.repo.update(
        id,
        {
          scheduleEnabled: data.scheduleEnabled,
          openingHours: data.openingHours,
          closedUntil: null,
          status,
        },
        trx
      )
    })
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

      const key = `banners/${store.id}_${randomUUID()}.${images.banner.extname}`
      await images.banner.moveToDisk(key)
      store.merge({ bannerUrl: await disk.getUrl(key) })
    }

    if (images.photo) {
      if (store.photoUrl) {
        const fileName = store.photoUrl.split('/').pop()
        const key = `photos/${fileName}`
        if (fileName) await disk.delete(key)
      }

      const key = `photos/${store.id}_${randomUUID()}.${images.photo.extname}`
      await images.photo.moveToDisk(key)
      store.merge({ photoUrl: await disk.getUrl(key) })
    }

    await store.save()
    return store
  }
}
