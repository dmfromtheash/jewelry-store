/**
 * AURELIA — Local demo rehearsal (Этап 53A)
 *
 * One command to rehearse the local demo/sale readiness checks. It runs the SAFE,
 * offline checks that need no live server (preflight, typecheck, prisma validate,
 * sale-docs consistency) and then PRINTS the ordered live sequence for the steps that
 * need the AURELIA DB (6700) + a running dev server. It deliberately does NOT start a
 * server or DB itself (same philosophy as `demo:preflight:full`) — so it can never
 * leave a server/DB running, deploy, tunnel, reset, seed, or print secrets.
 *
 *   node scripts/demo/rehearsal.mjs
 *
 * Exit 1 if any offline check fails.
 */

import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

let fails = 0

function run(label, cmd) {
  try {
    execSync(cmd, { cwd: ROOT, stdio: ['ignore', 'ignore', 'ignore'], timeout: 300000 })
    console.log(`  OK   ${label}`)
  } catch {
    console.log(`  FAIL ${label} — run \`${cmd}\` to see details`)
    fails++
  }
}

function main() {
  console.log('AURELIA local demo rehearsal — offline checks (no server/DB started):\n')

  run('demo:preflight (security gate)', 'npm run demo:preflight')
  run('typecheck', 'npm run typecheck')
  run('prisma validate', 'npx prisma validate')
  run('demo:sale-docs-check (buyer-doc consistency)', 'npm run demo:sale-docs-check')

  console.log('\nLive rehearsal — run these in order WITH the DB + dev server (NOT auto-run):\n')
  console.log('  1.  npm run db:start')
  console.log('  2.  npm run db:verify:customer-auth && npm run db:verify:email-ops')
  console.log('  3.  npm run db:verify:orders && npm run db:verify:order-lifecycle \\')
  console.log('         && npm run db:verify:order-confirmation && npm run db:verify:checkout-options')
  console.log('  4.  npm run dev                 # separate terminal — http://127.0.0.1:5000')
  console.log('  5.  npm run smoke:routes        # storefront + admin-gated routes')
  console.log('  6.  npm run smoke:admin         # authenticated admin surfaces (needs ADMIN_* in .env)')
  console.log('  7.  npm run build')
  console.log('  8.  npm run db:stop             # when finished')

  console.log('\nReminders:')
  console.log('  •  Rehearsal is NOT a deployment. It does not deploy, tunnel, or expose anything.')
  console.log('  •  A public demo still needs EXPLICIT, per-demo owner approval.')
  console.log('  •  See docs/sale/DEMO_SALE_READINESS_REPORT.md for the full readiness picture.')

  console.log('')
  if (fails === 0) {
    console.log('REHEARSAL (offline) OK — then run the live sequence above. Not approval to deploy.')
  } else {
    console.error(`REHEARSAL FAILED — ${fails} offline check(s) failed.`)
    process.exit(1)
  }
}

main()
