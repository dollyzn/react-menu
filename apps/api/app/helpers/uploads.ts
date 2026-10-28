import drive from '@adonisjs/drive/services/main'
import logger from '@adonisjs/core/services/logger'

/**
 * The drive key of a file this app uploaded under `prefix` ("items"), from
 * its public URL (fs: …/uploads/items/x.webp; s3/r2: …/items/x.webp), or
 * null for anything else: seeded demo photos (shared between items) and
 * external URLs are never ours to delete.
 */
export function uploadKey(url: string | null | undefined, prefix: string) {
  if (!url) return null
  let path: string
  try {
    // Absolute (s3/r2, fs with a base URL) or relative ("/uploads/…").
    path = decodeURIComponent(new URL(url, 'http://local').pathname)
  } catch {
    return null
  }
  const at = path.indexOf(`/${prefix}/`)
  if (at === -1) return null
  const key = path.slice(at + 1)
  // One file right under the prefix, nothing that walks out of it.
  return /^[\w-]+\/[\w.-]+$/.test(key) && !key.includes('..') ? key : null
}

/** Deletes an uploaded file; a failure is logged, never thrown (the row already changed). */
export async function deleteUpload(url: string | null | undefined, prefix: string) {
  const key = uploadKey(url, prefix)
  if (!key) return
  try {
    await drive.use().delete(key)
  } catch (error) {
    logger.warn({ err: error, key }, 'could not delete an uploaded file')
  }
}
