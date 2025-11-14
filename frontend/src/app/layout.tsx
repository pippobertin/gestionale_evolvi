import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Gestione Scadenze Bandi',
  description: 'Sistema per la gestione delle scadenze di bandi e clienti',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="it">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}