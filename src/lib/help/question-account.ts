/**
 * AURELIA — Customer account Help-question reads (Этап 86A) — server-only
 *
 * Reads back the logged-in customer's OWN general Help questions so they can see the
 * status and any admin answer inside their account. HARD-SCOPED by `customerId`
 * (re-derived from the verified session by the caller), so one customer can never read
 * another's tickets.
 *
 * Privacy by construction: the select returns ONLY customer-appropriate fields
 * (subject/message/status/answer/dates). It NEVER selects `answeredBy` (admin actor),
 * `emailHash`, `recipientEmail`, or any moderation internals. Moderation-only states
 * (`spam`/`rejected`) are filtered out (see ../customer/account-qa). Guest submissions
 * (customerId null) are excluded by the `where` and are NOT linked here (deferred).
 */

import 'server-only'

import { prisma } from '../db/prisma'
import { isHelpQuestionVisibleToCustomer } from '../customer/account-qa'

export interface MyHelpQuestion {
  id: string
  categorySlug: string
  subject: string
  message: string
  status: string
  answer: string | null
  createdAt: Date
  answeredAt: Date | null
}

/** The customer's OWN Help questions (newest first), with moderation-only rows removed. */
export async function listMyHelpQuestions(customerId: string): Promise<MyHelpQuestion[]> {
  if (!customerId) return []
  const rows = await prisma.helpQuestion.findMany({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      categorySlug: true,
      subject: true,
      message: true,
      status: true,
      answer: true,
      createdAt: true,
      answeredAt: true,
    },
  })
  return rows.filter((r) => isHelpQuestionVisibleToCustomer(r.status))
}
