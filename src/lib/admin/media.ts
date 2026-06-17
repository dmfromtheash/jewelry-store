/**
 * AURELIA — Product media storage (Этап 26F) — server-only file I/O
 *
 * Writes uploaded product images to <cwd>/public/uploads/products and deletes
 * them safely. All path/validation rules live in ./media-path (pure); this
 * module only performs the filesystem side effects. `import 'server-only'`
 * keeps it out of any client bundle.
 *
 * Hard safety rules:
 *   - accept ONLY jpg/jpeg/png/webp, ONLY up to MAX_UPLOAD_BYTES
 *   - storage filename is ALWAYS generated (randomUUID) — original name ignored
 *   - delete ONLY files that resolve strictly inside the upload directory; a
 *     missing file is not an error; anything outside the dir is refused
 */

import 'server-only'

import { randomUUID } from 'crypto'
import { mkdir, unlink, writeFile } from 'fs/promises'
import path from 'path'
import {
  MAX_UPLOAD_BYTES,
  extForMime,
  publicUrlForStored,
  resolveManagedUploadAbsPath,
  uploadDirAbs,
} from './media-path'

export class ProductMediaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProductMediaError'
  }
}

export interface SavedImage {
  /** Public relative URL stored in the DB, e.g. "/uploads/products/<id>.webp". */
  url: string
}

/**
 * Validate and persist an uploaded image File. Returns the public URL to store
 * in ProductImage.url. Throws ProductMediaError (safe message) on rejection.
 */
export async function saveProductImageFile(file: unknown): Promise<SavedImage> {
  if (!(file instanceof File) || file.size === 0) {
    throw new ProductMediaError('Файл не выбран.')
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ProductMediaError('Файл слишком большой (максимум 5 МБ).')
  }

  const ext = extForMime(file.type)
  if (!ext) {
    throw new ProductMediaError('Недопустимый тип файла. Разрешены JPG, PNG, WEBP.')
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  if (bytes.length > MAX_UPLOAD_BYTES) {
    throw new ProductMediaError('Файл слишком большой (максимум 5 МБ).')
  }

  const dir = uploadDirAbs()
  await mkdir(dir, { recursive: true })

  const name = `${randomUUID()}.${ext}`
  const abs = path.join(dir, name)
  await writeFile(abs, bytes, { flag: 'wx' }) // wx: never clobber an existing file

  return { url: publicUrlForStored(name) }
}

/**
 * Delete a previously-stored image file by its public URL. Safe by construction:
 *   - only removes files that resolve strictly inside the upload directory;
 *   - a non-managed URL is ignored (no-op, no throw);
 *   - a missing file is ignored (ENOENT swallowed).
 * Never throws into the caller.
 */
export async function deleteProductImageFile(url: string | null | undefined): Promise<void> {
  const abs = resolveManagedUploadAbsPath(url)
  if (!abs) return // unmanaged/empty/traversal → refuse silently, never touch disk
  try {
    await unlink(abs)
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      console.error(
        `[media] failed to delete file: ${err instanceof Error ? err.message : 'unknown error'}`,
      )
    }
  }
}
