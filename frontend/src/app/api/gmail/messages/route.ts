import { NextRequest, NextResponse } from 'next/server'
import { getGmailClient } from '@/lib/gmail'
import { verifyJWT } from '@/lib/jwtAuth'

export async function GET(request: NextRequest) {
  try {
    // Get logged-in user ID
    const decoded = await verifyJWT(request)
    const userId = decoded?.userId

    const { searchParams } = new URL(request.url)
    const labelIds = searchParams.get('labelIds')?.split(',') || ['INBOX']
    const maxResults = parseInt(searchParams.get('maxResults') || '50')
    const pageToken = searchParams.get('pageToken')
    const query = searchParams.get('q')

    // Get Gmail client with user's tokens
    const gmail = await getGmailClient(userId)

    // Fetch messages list
    const messagesResponse = await gmail.users.messages.list({
      userId: 'me',
      labelIds: labelIds,
      maxResults: maxResults,
      pageToken: pageToken || undefined,
      q: query || undefined
    })

    const messageIds = messagesResponse.data.messages || []

    // Fetch detailed information for each message
    const messages = await Promise.all(
      messageIds.map(async (msg) => {
        try {
          const messageDetail = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id!,
            format: 'metadata',
            metadataHeaders: ['From', 'To', 'Subject', 'Date']
          })
          return messageDetail.data
        } catch (error) {
          console.warn(`Error fetching message ${msg.id}:`, error)
          return null
        }
      })
    )

    // Filter out null messages and sort by date
    const validMessages = messages.filter(msg => msg !== null)
      .sort((a, b) => parseInt(b.internalDate) - parseInt(a.internalDate))

    return NextResponse.json({
      success: true,
      messages: validMessages,
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