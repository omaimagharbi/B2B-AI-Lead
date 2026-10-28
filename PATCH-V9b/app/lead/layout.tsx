import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Request a viewing', robots: { index: false, follow: false } }
export default function LeadLayout({ children }: { children: React.ReactNode }) { return children }
