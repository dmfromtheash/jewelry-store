import type { Metadata } from 'next'
import InfoPageLayout from '../../src/components/content/InfoPageLayout'
import { getInfoPage } from '../../src/data/info-pages'

const page = getInfoPage('about')!

export const metadata: Metadata = {
  title: page.metaTitle,
  description: page.metaDescription,
}

export default function AboutPage() {
  return <InfoPageLayout page={page} />
}
