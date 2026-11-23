import type { Metadata } from 'next'
import './globals.css'
import SessionProvider from '@/components/SessionProvider'
import DisableNumberInputScroll from '@/components/DisableNumberInputScroll'

export const metadata: Metadata = {
  title: 'Gestionale Evolvi',
  description: 'Sistema di gestione integrato per bandi, progetti e scadenze',
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="it">
      <body className="antialiased">
        <DisableNumberInputScroll />
        <SessionProvider>
          {/* Niente avvisi via email dal gestionale: i promemoria arrivano dal calendario Google */}
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}