/**
 * AURELIA — Product media path helpers (Этап 26F) — PURE, no I/O
 *
 * Filename/URL validation and path-traversal-safe resolution for locally
 * uploaded product images. Intentionally free of `fs`, Prisma and `server-only`
 * so it can be unit-tested from a plain Node script (prisma/verify-*.ts) and
 * shared by both the server-only IO module and any caller.
 *
 * Security model:
 *   - uploads live ONLY under <cwd>/public/uploads/products
 *   - the public URL is ONLY ever "/uploads/products/<safe-name>"
 *   - original filenames are NEVER trusted: storage names are generated
 *   - a managed URL resolves back to an absolute path ONLY when it stays inside
 *     the upload directory (any traversal / external path resolves to null)
 */

import path from 'path'

/** Public URL prefix every managed product image lives under. */
export const UPLOAD_URL_PREFIX = '/uploads/products/'

/** Filesystem segments (relative to cwd) of the upload directory. */
export const UPLOAD_DIR_SEGMENTS = ['public', 'uploads', 'products'] as const

/** Allowed image extensions (lowercase, no dot). */
export const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const

/** Allowed MIME types, mapped to the canonical stored extension. */
export const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

/** Maximum accepted upload size: 5 MB. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

/** Absolute path to the upload directory for the current process. */
export function uploadDirAbs(): string {
  return path.join(process.cwd(), ...UPLOAD_DIR_SEGMENTS)
}

/** True when a URL is one this module manages (and is safe to delete on disk). */
export function isManagedUploadUrl(url: string | null | undefined): url is string {
  if (!url) return false
  if (!url.startsWith(UPLOAD_URL_PREFIX)) return false
  // The remainder must be a single safe filename — never a nested/relative path.
  const name = url.slice(UPLOAD_URL_PREFIX.length)
  return isSafeStoredFilename(name)
}

/**
 * A stored filename is a single segment of safe chars with an allowed image
 * extension. No slashes, no "..", no leading dot.
 */
export function isSafeStoredFilename(name: string): boolean {
  if (!name || name.includes('/') || name.includes('\\') || name.includes('..')) return false
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) return false
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(ext)
}

/**
 * Resolve a managed URL to an absolute on-disk path, but ONLY if it stays
 * strictly inside the upload directory. Returns null for anything else
 * (unmanaged URL, traversal attempt, escape outside the dir).
 */
export function resolveManagedUploadAbsPath(url: string | null | undefined): string | null {
  if (!isManagedUploadUrl(url)) return null
  const name = url.slice(UPLOAD_URL_PREFIX.length)
  const dir = uploadDirAbs()
  const abs = path.resolve(dir, name)
  // Defense in depth: the resolved path must live directly under the dir.
  const rel = path.relative(dir, abs)
  if (rel.startsWith('..') || path.isAbsolute(rel) || rel.includes(path.sep)) return null
  return abs
}

/** Canonical stored extension for a given MIME type, or null if unsupported. */
export function extForMime(mime: string | null | undefined): string | null {
  if (!mime) return null
  return ALLOWED_MIME_TO_EXT[mime.toLowerCase()] ?? null
}

/** Build the public URL for a stored filename. */
export function publicUrlForStored(name: string): string {
  return `${UPLOAD_URL_PREFIX}${name}`
}
