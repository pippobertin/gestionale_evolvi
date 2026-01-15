import type { Metadata } from 'next'
import './globals.css'
import SessionProvider from '@/components/SessionProvider'
import AutoSchedulerProvider from '@/components/AutoSchedulerProvider'

export const metadata: Metadata = {
  title: 'Gestionale Evolvi',
  description: 'Sistema di gestione integrato per bandi, progetti e scadenze',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="it">
      <body className="antialiased">
        <SessionProvider>
          <AutoSchedulerProvider>
            {children}
          </AutoSchedulerProvider>
        </SessionProvider>
      </body>
    </html>
  )
}