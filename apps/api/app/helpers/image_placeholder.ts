import sharp from 'sharp'
import drive from '@adonisjs/drive/services/main'
import logger from '@adonisjs/core/services/logger'
import type { MultipartFile } from '@adonisjs/core/bodyparser'

/** Longest side of the blurred copy: enough for a soft preview, a few hundred bytes. */
const SIZE = 12

/**
 * A tiny blurred copy of an image as a WebP data URL, shown by the web
 * (`next/image` `placeholder="blur"`) while the real image loads. Takes the
 * file's path or bytes. Null when it can't be read (the image still shows,
 * without a placeholder): never fails the upload.
 */
export async function blurPlaceholder(input: string | Buffer | Uint8Array): Promise<string | null> {
  try {
    const bytes = await sharp(input)
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
 * the Drive disk when the URL ends in one of its keys (…/uploads/<key> on
 * fs, …/<key> on s3/r2), otherwise downloaded. For `node ace images:blur`.
 */
export async function blurPlaceholderOf(url: string): Promise<string | null> {
  const disk = drive.use()
  let path: string | null = null
  try {
    path = decodeURIComponent(new URL(url, 'http://local').pathname)
  } catch {
    return null
  }
  // The key is the end of the path; how much of it depends on the disk.
  const segments = path.split('/').filter(Boolean)
  for (let start = 0; start < segments.length; start++) {
    const key = segments.slice(start).join('/')
    if (key.includes('..')) continue
    try {
      if (await disk.exists(key)) return await blurPlaceholder(await disk.getBytes(key))
    } catch {
      // Not on this disk under that key: try the next one.
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
