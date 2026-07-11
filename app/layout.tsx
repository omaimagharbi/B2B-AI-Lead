import './globals.css'

export const metadata = {
  title: 'B2B AI Lead Machine',
  description: 'Diagnostic IA pour cabinets de formation et conseil',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
