/**
 * AURELIA — Customer password hashing (Этап 47A)
 *
 * Dependency-free password hashing using Node's built-in `crypto.scrypt` (a
 * memory-hard KDF). No bcrypt/argon2 package is added — scrypt is part of Node
 * and is a safe choice for a local/self-hosted store.
 *
 * Stored format (single opaque string in Customer.passwordHash):
 *     scrypt$<N>$<r>$<p>$<saltHex>$<hashHex>
 * The cost parameters are embedded so a future hardening (higher N) can verify
 * old hashes and transparently re-hash. Plaintext passwords are NEVER stored,
 * returned, or logged. Comparison is constant-time (timingSafeEqual).
 *
 * Pure crypto only (no `server-only`, no Prisma, no cookies) so the verify
 * script can unit-test it directly.
 */

import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'crypto'

/** Promise wrapper that preserves the options overload (util.promisify loses it). */
function scrypt(password: string, salt: Buffer, keylen: number, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err)
      else resolve(derivedKey)
    })
  })
}

// scrypt cost parameters. N must be a power of two; (128 * N * r) bytes of memory
// are used. 2^15 keeps hashing well under ~100ms on a dev box while staying
// memory-hard. maxmem is raised so Node does not reject these parameters.
const SCRYPT_N = 1 << 15 // 32768
const SCRYPT_r = 8
const SCRYPT_p = 1
const KEY_LEN = 64
const SALT_LEN = 16
const SCRYPT_MAXMEM = 128 * SCRYPT_N * SCRYPT_r * 2

/** Hashes a plaintext password into the opaque `scrypt$...` storage string. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN)
  const derived = (await scrypt(password, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_r,
    p: SCRYPT_p,
    maxmem: SCRYPT_MAXMEM,
  })) as Buffer
  return `scrypt$${SCRYPT_N}$${SCRYPT_r}$${SCRYPT_p}$${salt.toString('hex')}$${derived.toString('hex')}`
}

/**
 * Verifies a plaintext password against a stored `scrypt$...` hash. Returns false
 * for any malformed/unknown hash rather than throwing, so a corrupt row can never
 * crash login. Constant-time on the digest comparison.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false

  const N = Number(parts[1])
  const r = Number(parts[2])
  const p = Number(parts[3])
  const saltHex = parts[4]
  const hashHex = parts[5]
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false
  if (!saltHex || !hashHex) return false

  let salt: Buffer
  let expected: Buffer
  try {
    salt = Buffer.from(saltHex, 'hex')
    expected = Buffer.from(hashHex, 'hex')
  } catch {
    return false
  }
  if (salt.length === 0 || expected.length === 0) return false

  let derived: Buffer
  try {
    derived = (await scrypt(password, salt, expected.length, {
      N,
      r,
      p,
      maxmem: 128 * N * r * 2,
    })) as Buffer
  } catch {
    return false
  }

  if (derived.length !== expected.length) return false
  return timingSafeEqual(derived, expected)
}
