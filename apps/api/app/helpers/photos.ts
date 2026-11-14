import { randomUUID } from 'node:crypto'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import drive from '@adonisjs/drive/services/main'
import { uploadPlaceholder } from '#helpers/image_placeholder'
import { deleteUpload } from '#helpers/uploads'

/** A row with an uploaded photo and its blurred preview (an item, an add-on). */
export type PhotoRecord = {
  id: string
  photoUrl: string | null
  photoBlur: string | null
  save(): Promise<unknown>
}

/**
 * Replaces a row's photo with an upload under `prefix`. The new file is stored
 * and saved first and the old one deleted after, so a failure leaves an orphan
 * file at worst, never a row pointing at a missing photo.
 */
export async function replacePhoto(record: PhotoRecord, prefix: string, file: MultipartFile) {
  const previous = record.photoUrl
  const key = `${prefix}/${record.id}_${randomUUID()}.${file.extname}`
  const blur = await uploadPlaceholder(file)
  await file.moveToDisk(key)
  record.photoUrl = await drive.use().getUrl(key)
  record.photoBlur = blur
  await record.save()
  await deleteUpload(previous, prefix)
}

/** Back to no photo (the menu shows a placeholder). Repeating it is harmless. */
export async function clearPhoto(record: PhotoRecord, prefix: string) {
  const previous = record.photoUrl
  if (!previous) return
  record.photoUrl = null
  record.photoBlur = null
  await record.save()
  await deleteUpload(previous, prefix)
}
