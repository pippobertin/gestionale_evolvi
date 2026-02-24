import { NextRequest, NextResponse } from 'next/server'
import { getGmailClient } from '@/lib/gmail'
import { verifyJWT } from '@/lib/jwtAuth'

export async function GET(request: NextRequest) {
  try {
    // Get logged-in user ID
    const decoded = await verifyJWT(request)
    const userId = decoded?.userId

    // Get Gmail client with user's tokens
    const gmail = await getGmailClient(userId)

    // Count unread messages in INBOX
    const response = await gmail.users.messages.list({
      userId: 'me',
      labelIds: ['INBOX', 'UNREAD'],
      maxResults: 1 // We only need the count, not the actual messages
    })

    const unreadCount = response.data.resultSizeEstimate || 0

    return NextResponse.json({
      success: true,
      count: unreadCount
    })

  } catch (error: any) {
    console.error('Error fetching unread email count:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore durante il conteggio delle email non lette',
      count: 0
    }, { status: 500 })
  }
}
