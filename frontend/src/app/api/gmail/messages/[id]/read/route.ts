import { NextRequest, NextResponse } from 'next/server'
import { getGmailClient } from '@/lib/gmail'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const messageId = resolvedParams.id
    const gmail = await getGmailClient()

    // Mark message as read by removing UNREAD label
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        removeLabelIds: ['UNREAD']
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Messaggio marcato come letto'
    })

  } catch (error: any) {
    console.error('Error marking message as read:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore durante la marcatura come letto'
    }, { status: 500 })
  }
}