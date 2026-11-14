import sharp from 'sharp'
import drive from '@adonisjs/drive/services/main'
import logger from '@adonisjs/core/services/logger'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import { uploadKey } from '#helpers/uploads'

/** Longest side of the blurred copy: enough for a soft preview, a few hundred bytes. */
const SIZE = 12
/**
 * Uploads are small in bytes but could be huge in pixels (a 16k×16k PNG of
 * one color): decoding one would take gigabytes. Bigger than this (a 48 MP
 * phone photo fits) gets no preview.
 */
const MAX_PIXELS = 50_000_000
/** Where this app keeps the images that have previews (see `uploadKey`). */
const PREFIXES = ['items', 'addons', 'menu', 'banners', 'photos', 'avatars']

/**
 * A tiny blurred copy of an image as a WebP data URL, shown by the web
 * (`next/image` `placeholder="blur"`) while the real image loads. Takes the
 * file's path or bytes. Null when it can't be read (the image still shows,
 * without a placeholder): never fails the upload.
 */
export async function blurPlaceholder(input: string | Buffer | Uint8Array): Promise<string | null> {
  try {
    const bytes = await sharp(input, { limitInputPixels: MAX_PIXELS })
      .rotate()
      .resize(SIZE, SIZE, { fit: 'inside' })
      .webp({ quality: 50 })
      .toBuffer()
    return `data:image/webp;base64,${bytes.toString('base64')}`
  } catch (error) {
    logger.warn({ err: error }, 'could not make an image placeholder')
    return null
  }
}

/** The placeholder of an uploaded file, read before it is moved to the Drive disk. */
export async function uploadPlaceholder(file: MultipartFile) {
  return file.tmpPath ? await blurPlaceholder(file.tmpPath) : null
}

/**
 * The placeholder of an image already stored, by its public URL: read from
 * the Drive disk when it is one of this app's files (`uploadKey`: items/,
 * menu/, banners/, photos/, avatars/), otherwise downloaded. For
 * `node ace images:blur`.
 */
export async function blurPlaceholderOf(url: string): Promise<string | null> {
  const key = PREFIXES.map((prefix) => uploadKey(url, prefix)).find(Boolean)
  if (key) {
    try {
      return await blurPlaceholder(await drive.use().getBytes(key))
    } catch {
      // Not on this disk (moved, another environment's URL): download it.
    }
  }
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!response.ok) return null
    return await blurPlaceholder(Buffer.from(await response.arrayBuffer()))
  } catch {
    return null
  }
}
