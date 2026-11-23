import { NextRequest, NextResponse } from 'next/server'
import { getGmailClient, metadatiMessaggi } from '@/lib/gmail'
import { verifyJWT } from '@/lib/jwtAuth'

/**
 * Elenco dei messaggi di una cartella: una richiesta per l'elenco e una sola
 * richiesta multipla per i dettagli (prima erano una per messaggio).
 */
export async function GET(request: NextRequest) {
  try {
    const decoded = await verifyJWT(request)
    const userId = decoded?.userId

    const { searchParams } = new URL(request.url)
    const labelIds = searchParams.get('labelIds')?.split(',') || ['INBOX']
    const maxResults = Math.min(parseInt(searchParams.get('maxResults') || '50') || 50, 100)
    const pageToken = searchParams.get('pageToken')
    const query = searchParams.get('q')

    const gmail = await getGmailClient(userId)
    const messagesResponse = await gmail.users.messages.list({
      userId: 'me',
      labelIds,
      maxResults,
      pageToken: pageToken || undefined,
      q: query || undefined
    })

    const ids = (messagesResponse.data.messages || []).map(m => m.id!).filter(Boolean)
    const messages = (await metadatiMessaggi(gmail, ids))
      .sort((a, b) => parseInt(b.internalDate) - parseInt(a.internalDate))

    return NextResponse.json({
      success: true,
      messages,
      nextPageToken: messagesResponse.data.nextPageToken,
      resultSizeEstimate: messagesResponse.data.resultSizeEstimate
    })
  } catch (error: any) {
    console.error('Error fetching Gmail messages:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore durante il caricamento dei messaggi'
    }, { status: 500 })
  }
}
