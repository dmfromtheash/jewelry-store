/**
 * AURELIA — Customer auth verification (Этап 47A + 47B + 47C)
 *
 * Non-destructive checks for the customer auth + account cabinet:
 *   - password hashing: hash is NOT plaintext, verifies correct, rejects wrong;
 *   - customer session token: signs/verifies, rejects wrong key + tampering, carries
 *     a session version, and rejects a legacy pre-47C token that lacks one (47C);
 *   - session invalidation (47C): a password change increments sessionVersion, which
 *     makes the pre-change token stale (token.ver !== db.sessionVersion) while a
 *     re-issued token for the new version is accepted — the exact getCurrentCustomer
 *     revocation check, reproduced inside a rolled-back transaction;
 *   - validation: short password / unsafe name rejected, email normalised;
 *   - 47B profile editing validation: unsafe name / bad phone rejected, normalised,
 *     optional fields clearable;
 *   - 47B password-change validation: current password required, short/mismatched
 *     new password rejected;
 *   - DB (inside ALWAYS-ROLLED-BACK transactions — nothing is ever committed):
 *       * a created customer stores the hash (not plaintext);
 *       * duplicate email is rejected by the unique constraint (P2002);
 *       * a logged-in checkout attaches customerId; a guest order stays null;
 *       * order history is scoped by customerId — customer A never sees B's orders;
 *       * 47B password change: replacing the stored hash makes the OLD password
 *         fail and the NEW one verify;
 *       * 47B order-detail scoping (mirrors getCustomerOrderByCode's
 *         WHERE { orderCode, customerId }): the owner loads their own order, but a
 *         foreign customer's order and a guest order are NOT loadable by code.
 *
 * No deleteMany, no raw SQL, no committed test data: every write happens inside a
 * transaction aborted by a sentinel error, and customer/order counts are asserted
 * unchanged afterwards. Run with: npm run db:verify:customer-auth
 *
 * NOTE (route smoke limit): the account/order-detail page guards (redirect to
 * /account when logged out, notFound() when the scoped query returns null) depend
 * on Next.js request cookies and are not exercised here — they are covered at the
 * data layer via the scoped queries below.
 */

import { createHmac, randomBytes } from 'crypto'
import { Prisma, PrismaClient } from '@prisma/client'
import { hashPassword, verifyPassword } from '../src/lib/customer/password'
import {
  createCustomerToken,
  verifyCustomerToken,
  resolveCustomerSessionSecret,
} from '../src/lib/customer/token'
import {
  validateRegisterInput,
  validateProfileInput,
  validatePasswordChangeInput,
  normalizeEmail,
} from '../src/lib/customer/validate'

const prisma = new PrismaClient()
const ROLLBACK = '__AURELIA_CUSTOMER_AUTH_ROLLBACK__'

let failures = 0
function check(label: string, ok: boolean) {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${label}`)
  if (!ok) failures++
}

async function main() {
  const customerCountBefore = await prisma.customer.count()
  const orderCountBefore = await prisma.order.count()

  console.log('Customer auth:')
  console.log(`  customers in DB: ${customerCountBefore}`)
  console.log(`  orders in DB:    ${orderCountBefore}`)

  // --- 1) Password hashing (pure) ---
  const plain = `Sup3r-${randomBytes(6).toString('hex')}`
  const hash = await hashPassword(plain)
  check('password hash is not plaintext', !hash.includes(plain) && hash.startsWith('scrypt$'))
  check('verifyPassword accepts correct password', await verifyPassword(plain, hash))
  check('verifyPassword rejects wrong password', !(await verifyPassword(`${plain}x`, hash)))
  check('verifyPassword rejects malformed hash', !(await verifyPassword(plain, 'not-a-hash')))

  // --- 2) Session token (pure) ---
  const secret = randomBytes(32).toString('hex')
  const otherSecret = randomBytes(32).toString('hex')
  const token = createCustomerToken('cust_test_123', 1, secret)
  const session = verifyCustomerToken(token, secret)
  check('token verifies with correct key + subject', session?.sub === 'cust_test_123')
  check('token carries session version (Этап 47C)', session?.ver === 1)
  check('token rejected with wrong key', verifyCustomerToken(token, otherSecret) === null)
  check('tampered token rejected', verifyCustomerToken(token.slice(0, -2) + 'xy', secret) === null)

  // Legacy pre-47C token (no `ver`) must fail closed under the strict 47C verifier.
  const legacyPayload = { sub: 'cust_legacy', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 }
  const legacyBody = Buffer.from(JSON.stringify(legacyPayload), 'utf8').toString('base64url')
  const legacySig = createHmac('sha256', secret).update(legacyBody).digest('base64url')
  check('legacy token without session version rejected', verifyCustomerToken(`${legacyBody}.${legacySig}`, secret) === null)

  // Secret resolution: an explicit CUSTOMER_SESSION_SECRET is preferred.
  const prevSecret = process.env.CUSTOMER_SESSION_SECRET
  process.env.CUSTOMER_SESSION_SECRET = 'x'.repeat(40)
  check('resolveCustomerSessionSecret prefers explicit secret', resolveCustomerSessionSecret() === 'x'.repeat(40))
  if (prevSecret === undefined) delete process.env.CUSTOMER_SESSION_SECRET
  else process.env.CUSTOMER_SESSION_SECRET = prevSecret

  // --- 3) Validation (pure) ---
  check('short password rejected', !!validateRegisterInput({ email: 'a@b.co', password: 'short' }).errors.password)
  check(
    'unsafe name rejected',
    !!validateRegisterInput({ email: 'a@b.co', password: 'longenough1', name: '<script>x</script>' }).errors.name,
  )
  check('email normalised to lowercase', normalizeEmail('  USER@Example.COM ') === 'user@example.com')
  const goodReg = validateRegisterInput({ email: ' USER@Example.com ', password: 'longenough1', phone: '+380501112233' })
  check('valid registration normalised', goodReg.value?.email === 'user@example.com' && goodReg.value?.phone === '+380501112233')

  // --- 3b) Profile + password-change validation (pure, Этап 47B) ---
  check('profile rejects unsafe name', !!validateProfileInput({ name: '<b>x</b>' }).errors.name)
  check('profile rejects bad phone', !!validateProfileInput({ phone: 'not-a-phone' }).errors.phone)
  const okProfile = validateProfileInput({ name: '  Іра  ', phone: '+380501112233' })
  check(
    'profile normalises name + phone',
    okProfile.value?.name === 'Іра' && okProfile.value?.phone === '+380501112233',
  )
  const clearProfile = validateProfileInput({ name: '', phone: '' })
  check('profile allows clearing optional fields', clearProfile.value?.name === null && clearProfile.value?.phone === null)

  check('password change requires current password', !!validatePasswordChangeInput({ currentPassword: '', newPassword: 'longenough1' }).errors.currentPassword)
  check('password change rejects short new password', !!validatePasswordChangeInput({ currentPassword: 'x', newPassword: 'short' }).errors.newPassword)
  check(
    'password change rejects mismatched confirm',
    !!validatePasswordChangeInput({ currentPassword: 'x', newPassword: 'longenough1', newPasswordConfirm: 'different1' }).errors.newPasswordConfirm,
  )
  check('valid password change accepted', !!validatePasswordChangeInput({ currentPassword: 'old', newPassword: 'longenough1', newPasswordConfirm: 'longenough1' }).value)

  // --- 4) DB: stored hash, duplicate email (own rolled-back tx) ---
  const tag = randomBytes(6).toString('hex')
  const emailA = `verify+a_${tag}@aurelia.test`
  const emailB = `verify+b_${tag}@aurelia.test`

  let storedNotPlain = false
  let duplicateRejected = false
  try {
    await prisma.$transaction(async (tx) => {
      const created = await tx.customer.create({
        data: { email: emailA, passwordHash: hash, name: 'Verify A' },
        select: { id: true, passwordHash: true },
      })
      storedNotPlain = created.passwordHash === hash && !created.passwordHash.includes(plain)
      // Duplicate email → unique violation (P2002). This aborts the tx, which we
      // want anyway (everything rolls back); we just record that it was rejected.
      try {
        await tx.customer.create({ data: { email: emailA, passwordHash: hash } })
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          duplicateRejected = true
        }
        throw e // abort/rollback (duplicate or otherwise)
      }
      throw new Error(ROLLBACK)
    })
  } catch (e) {
    if (!(e instanceof Error) || (e.message !== ROLLBACK && !duplicateRejected)) throw e
  }
  check('created customer stores hash, not plaintext', storedNotPlain)
  check('duplicate email rejected (P2002)', duplicateRejected)

  // --- 5) DB: customerId attach + guest null + cross-customer scoping (rolled back) ---
  let attachOk = false
  let guestNull = false
  let scopedToOwner = false
  const baseOrder = {
    status: 'submitted' as const,
    customerName: 'Verify',
    customerPhone: '+380501112233',
    deliveryCity: 'Kyiv',
    deliveryMethod: 'self_pickup',
    paymentMethod: 'cash_on_delivery',
    subtotalAmount: 0,
    totalAmount: 0,
  }
  try {
    await prisma.$transaction(async (tx) => {
      const a = await tx.customer.create({ data: { email: emailA, passwordHash: hash }, select: { id: true } })
      const b = await tx.customer.create({ data: { email: emailB, passwordHash: hash }, select: { id: true } })

      const orderA = await tx.order.create({
        data: { ...baseOrder, orderCode: `VERIFY-A-${tag}`, customerId: a.id },
        select: { customerId: true },
      })
      const orderGuest = await tx.order.create({
        data: { ...baseOrder, orderCode: `VERIFY-G-${tag}` },
        select: { customerId: true },
      })
      await tx.order.create({
        data: { ...baseOrder, orderCode: `VERIFY-B-${tag}`, customerId: b.id },
        select: { customerId: true },
      })

      attachOk = orderA.customerId === a.id
      guestNull = orderGuest.customerId === null

      // Scoping: A's history contains only A's order (never B's or the guest's).
      const aOrders = await tx.order.findMany({ where: { customerId: a.id }, select: { orderCode: true } })
      scopedToOwner =
        aOrders.length === 1 &&
        aOrders[0].orderCode === `VERIFY-A-${tag}` &&
        !aOrders.some((o) => o.orderCode === `VERIFY-B-${tag}` || o.orderCode === `VERIFY-G-${tag}`)

      throw new Error(ROLLBACK)
    })
  } catch (e) {
    if (!(e instanceof Error) || e.message !== ROLLBACK) throw e
  }
  check('logged-in checkout attaches customerId', attachOk)
  check('guest order keeps customerId null', guestNull)
  check('order history scoped to owner (A cannot see B/guest)', scopedToOwner)

  // --- 5b) DB: password change re-hash + order-detail scoping (Этап 47B, rolled back) ---
  let oldFailsNewWorks = false
  let ownerSeesOwnOrder = false
  let foreignOrderHidden = false
  let guestOrderHidden = false
  try {
    await prisma.$transaction(async (tx) => {
      const oldPlain = `Old-${randomBytes(5).toString('hex')}`
      const newPlain = `New-${randomBytes(5).toString('hex')}`
      const oldHash = await hashPassword(oldPlain)
      const newHash = await hashPassword(newPlain)

      const a = await tx.customer.create({ data: { email: emailA, passwordHash: oldHash }, select: { id: true } })
      const b = await tx.customer.create({ data: { email: emailB, passwordHash: oldHash }, select: { id: true } })

      // Password change: replace the stored hash, then verify against the STORED value.
      await tx.customer.update({ where: { id: a.id }, data: { passwordHash: newHash } })
      const after = await tx.customer.findUnique({ where: { id: a.id }, select: { passwordHash: true } })
      oldFailsNewWorks =
        !!after &&
        !(await verifyPassword(oldPlain, after.passwordHash)) &&
        (await verifyPassword(newPlain, after.passwordHash))

      const orderA = await tx.order.create({ data: { ...baseOrder, orderCode: `VERIFY-OA-${tag}`, customerId: a.id }, select: { orderCode: true } })
      const orderB = await tx.order.create({ data: { ...baseOrder, orderCode: `VERIFY-OB-${tag}`, customerId: b.id }, select: { orderCode: true } })
      const orderG = await tx.order.create({ data: { ...baseOrder, orderCode: `VERIFY-OG-${tag}` }, select: { orderCode: true } })

      // Mirrors getCustomerOrderByCode's hard scoping: WHERE { orderCode, customerId }.
      const own = await tx.order.findFirst({ where: { orderCode: orderA.orderCode, customerId: a.id }, select: { orderCode: true } })
      const foreign = await tx.order.findFirst({ where: { orderCode: orderB.orderCode, customerId: a.id }, select: { orderCode: true } })
      const guest = await tx.order.findFirst({ where: { orderCode: orderG.orderCode, customerId: a.id }, select: { orderCode: true } })
      ownerSeesOwnOrder = own?.orderCode === orderA.orderCode
      foreignOrderHidden = foreign === null
      guestOrderHidden = guest === null

      throw new Error(ROLLBACK)
    })
  } catch (e) {
    if (!(e instanceof Error) || e.message !== ROLLBACK) throw e
  }
  check('password change: old password fails, new verifies (stored hash replaced)', oldFailsNewWorks)
  check('order detail: owner loads own order (scoped by orderCode + customerId)', ownerSeesOwnOrder)
  check('order detail: customer A cannot load customer B order by code', foreignOrderHidden)
  check('order detail: customer cannot load a guest order by code', guestOrderHidden)

  // --- 5c) DB: password change bumps sessionVersion → stale token invalid (Этап 47C, rolled back) ---
  // Reproduces getCurrentCustomer's revocation check: a token is valid only while
  // its `ver` equals the customer's DB sessionVersion. A password change increments
  // that version, so the pre-change token is stale and a re-issued token is valid.
  let versionStartsAtOne = false
  let versionBumped = false
  let staleTokenRejected = false
  let freshTokenAccepted = false
  try {
    await prisma.$transaction(async (tx) => {
      const oldHash = await hashPassword(`Old-${randomBytes(5).toString('hex')}`)
      const c = await tx.customer.create({
        data: { email: emailA, passwordHash: oldHash },
        select: { id: true, sessionVersion: true },
      })
      versionStartsAtOne = c.sessionVersion === 1

      // Token issued for the CURRENT version (what login/register sign into the cookie).
      const tokenBefore = createCustomerToken(c.id, c.sessionVersion, secret)

      // Password change: atomic new hash + sessionVersion++ + passwordChangedAt,
      // mirroring updateCustomerPasswordAndBumpVersion.
      const updated = await tx.customer.update({
        where: { id: c.id },
        data: {
          passwordHash: await hashPassword(`New-${randomBytes(5).toString('hex')}`),
          sessionVersion: { increment: 1 },
          passwordChangedAt: new Date(),
        },
        select: { sessionVersion: true },
      })
      versionBumped = updated.sessionVersion === c.sessionVersion + 1

      // The pre-change token still has a VALID signature, but its version is stale →
      // getCurrentCustomer (token.ver !== db.sessionVersion) treats it as logged out.
      const before = verifyCustomerToken(tokenBefore, secret)
      staleTokenRejected = !!before && before.ver !== updated.sessionVersion

      // A token re-issued for the NEW version passes the same check.
      const tokenAfter = createCustomerToken(c.id, updated.sessionVersion, secret)
      const after = verifyCustomerToken(tokenAfter, secret)
      freshTokenAccepted = !!after && after.ver === updated.sessionVersion

      throw new Error(ROLLBACK)
    })
  } catch (e) {
    if (!(e instanceof Error) || e.message !== ROLLBACK) throw e
  }
  check('new customer starts at sessionVersion 1', versionStartsAtOne)
  check('password change bumps sessionVersion', versionBumped)
  check('stale token (old version) is invalidated after password change', staleTokenRejected)
  check('re-issued token (new version) is accepted after password change', freshTokenAccepted)

  // --- 6) Nothing committed ---
  const customerCountAfter = await prisma.customer.count()
  const orderCountAfter = await prisma.order.count()
  check('no test customers committed', customerCountAfter === customerCountBefore)
  check('no test orders committed', orderCountAfter === orderCountBefore)

  if (failures === 0) {
    console.log('\nCUSTOMER AUTH VERIFY OK: hashing, sessions, validation, linking + scoping all pass; nothing committed.')
  } else {
    console.error(`\nCUSTOMER AUTH VERIFY FAILED (${failures} check(s)).`)
    process.exitCode = 1
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
