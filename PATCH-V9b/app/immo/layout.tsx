import './immo.css'
import Shell from './shell'

export const metadata = { title: 'PiloBrain Real Estate' }

export default function ImmoLayout({ children }: { children: React.ReactNode }) {
  return <Shell>{children}</Shell>
}
