/**
 * AURELIA — Order lifecycle / methods verification (Этап 26B)
 *
 * Decision-free invariant check for the order-spine hardening. This script is
 * PURE: it imports the transition guard + method allowlists and asserts their
 * behaviour. It does NOT open the database (no PrismaClient, no reads, no
 * writes) — every invariant is a property of pure functions, so it can never
 * mutate real data.
 *
 * Run with: npm run db:verify:lifecycle
 */

import {
  ALLOWED_ORDER_TRANSITIONS,
  canTransitionOrderStatus,
  getSelectableOrderStatuses,
  isSameOrderStatus,
} from '../src/lib/orders/transitions'
import {
  DELIVERY_METHODS,
  PAYMENT_METHODS,
  isAllowedDeliveryMethod,
  isAllowedPaymentMethod,
} from '../src/lib/orders/methods'

const problems: string[] = []
let total = 0
function expect(cond: boolean, msg: string) {
  total++
  if (!cond) problems.push(msg)
}

// 1) Allowed transitions are accepted by the helper.
expect(canTransitionOrderStatus('submitted', 'cancelled'), 'submitted→cancelled should be allowed')
expect(canTransitionOrderStatus('draft', 'submitted'), 'draft→submitted should be allowed')
expect(canTransitionOrderStatus('draft', 'cancelled'), 'draft→cancelled should be allowed')

// 2) Forbidden transitions are rejected by the helper.
expect(!canTransitionOrderStatus('cancelled', 'submitted'), 'cancelled→submitted must be denied')
expect(!canTransitionOrderStatus('cancelled', 'draft'), 'cancelled→draft must be denied')
expect(!canTransitionOrderStatus('submitted', 'draft'), 'submitted→draft must be denied')

// 3) cancelled is terminal.
expect(ALLOWED_ORDER_TRANSITIONS.cancelled.length === 0, 'cancelled must be terminal')

// 4) Same-status is an idempotent no-op, not a transition.
expect(isSameOrderStatus('submitted', 'submitted'), 'same status should be detected')
expect(!canTransitionOrderStatus('submitted', 'submitted'), 'same status must not count as a transition')

// 5) Selectable statuses = current + allowed next only.
const selectable = getSelectableOrderStatuses('submitted')
expect(
  selectable.includes('submitted') && selectable.includes('cancelled') && !selectable.includes('draft'),
  'submitted should offer exactly [submitted, cancelled]',
)
expect(
  getSelectableOrderStatuses('cancelled').join(',') === 'cancelled',
  'cancelled should offer only itself (terminal)',
)

// 6) Method allowlists accept every current value.
for (const m of DELIVERY_METHODS) {
  expect(isAllowedDeliveryMethod(m), `delivery method '${m}' should be allowed`)
}
for (const m of PAYMENT_METHODS) {
  expect(isAllowedPaymentMethod(m), `payment method '${m}' should be allowed`)
}

// 7) Unknown / empty methods are rejected.
expect(!isAllowedDeliveryMethod('teleport'), 'unknown delivery method must be denied')
expect(!isAllowedDeliveryMethod(''), 'empty delivery method must be denied')
expect(!isAllowedPaymentMethod('bitcoin'), 'unknown payment method must be denied')
expect(!isAllowedPaymentMethod(''), 'empty payment method must be denied')

console.log('Lifecycle / methods invariants (pure — no DB):')
console.log(`  delivery methods: ${DELIVERY_METHODS.join(', ')}`)
console.log(`  payment methods:  ${PAYMENT_METHODS.join(', ')}`)
console.log(`  checks run:       ${total}`)

if (problems.length === 0) {
  console.log('\nLIFECYCLE VERIFY OK: transition guard + method allowlists behave as specified.')
} else {
  console.error('\nLIFECYCLE VERIFY FAILED:')
  for (const p of problems) console.error(`  - ${p}`)
  process.exitCode = 1
}
