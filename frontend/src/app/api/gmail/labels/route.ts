import { NextRequest, NextResponse } from 'next/server'
import { getGmailClient } from '@/lib/gmail'
import { verifyJWT } from '@/lib/jwtAuth'

/**
 * Cartelle mostrate dal client con i loro contatori. Gmail restituisce già i
 * totali e i non letti di ogni etichetta: prima il gestionale li contava
 * scaricando fino a 500 messaggi per cartella.
 */
const CARTELLE = ['INBOX', 'STARRED', 'SENT', 'SPAM', 'TRASH']

export async function GET(request: NextRequest) {
  try {
    const decoded = await verifyJWT(request)
    const gmail = await getGmailClient(decoded?.userId)
    const labels = await Promise.all(CARTELLE.map(async id => {
      try {
        const { data } = await gmail.users.labels.get({ userId: 'me', id })
        return { ...data, messagesTotal: data.messagesTotal || 0, messagesUnread: id === 'INBOX' ? (data.messagesUnread || 0) : 0 }
      } catch (error) {
        console.warn(`Contatori non disponibili per ${id}:`, error)
        return { id, name: id, type: 'system', messagesTotal: 0, messagesUnread: 0 }
      }
    }))
    return NextResponse.json({ success: true, labels })
  } catch (error: any) {
    console.error('Error fetching Gmail labels:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore durante il caricamento delle etichette'
    }, { status: 500 })
  }
}
