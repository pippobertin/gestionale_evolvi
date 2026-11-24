import type { Metadata } from 'next'
import './globals.css'
import SessionProvider from '@/components/SessionProvider'
import DisableNumberInputScroll from '@/components/DisableNumberInputScroll'
import ChiusuraFinestre from '@/components/ChiusuraFinestre'

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
        {/* Tutte le finestre si chiudono anche con un clic fuori dal riquadro */}
        <ChiusuraFinestre />
        <SessionProvider>
          {/* Niente avvisi via email dal gestionale: i promemoria arrivano dal calendario Google */}
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}