import { NextRequest, NextResponse } from 'next/server'
import { getGmailClient } from '@/lib/gmail'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const messageId = id
    const gmail = await getGmailClient()

    // Mark as read (remove UNREAD label)
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        removeLabelIds: ['UNREAD']
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Messaggio contrassegnato come letto'
    })

  } catch (error: any) {
    console.error('Error marking message as read:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore durante l\'aggiornamento del messaggio'
    }, { status: 500 })
  }
}