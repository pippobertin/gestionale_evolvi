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

    // Get current message to check if it's starred
    const messageResponse = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'minimal'
    })

    const isStarred = messageResponse.data.labelIds?.includes('STARRED')

    // Toggle star status
    if (isStarred) {
      // Remove star
      await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          removeLabelIds: ['STARRED']
        }
      })
    } else {
      // Add star
      await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          addLabelIds: ['STARRED']
        }
      })
    }

    return NextResponse.json({
      success: true,
      starred: !isStarred,
      message: isStarred ? 'Stella rimossa' : 'Messaggio contrassegnato con stella'
    })

  } catch (error: any) {
    console.error('Error toggling star:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore durante l\'aggiornamento della stella'
    }, { status: 500 })
  }
}