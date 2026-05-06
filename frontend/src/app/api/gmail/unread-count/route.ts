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

    // Get exact unread count from INBOX label metadata
    const response = await gmail.users.labels.get({
      userId: 'me',
      id: 'INBOX'
    })

    const unreadCount = response.data.messagesUnread || 0

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
