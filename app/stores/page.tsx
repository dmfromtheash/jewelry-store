import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import InfoPageLayout from '../../src/components/content/InfoPageLayout'
import { getInfoPageForPublic } from '../../src/lib/site-pages/server'

// Этап 46E: content now comes from the DB (SitePage) with a static fallback to
// src/data/info-pages.ts on missing/unpublished/invalid/DB-error. Markup unchanged.
const SLUG = 'stores'

export async function generateMetadata(): Promise<Metadata> {
  const page = await getInfoPageForPublic(SLUG)
  return { title: page?.metaTitle, description: page?.metaDescription }
}

export default async function StoresPage() {
  const page = await getInfoPageForPublic(SLUG)
  if (!page) notFound()
  return <InfoPageLayout page={page} />
}
