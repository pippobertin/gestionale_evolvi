import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { supabase } from '@/lib/supabase'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const messageId = params.id

    // Get Gmail tokens
    const { data: refreshTokenData } = await supabase
      .from('scadenze_bandi_system_settings')
      .select('value')
      .eq('key', 'gmail_refresh_token')
      .single()

    if (!refreshTokenData?.value) {
      return NextResponse.json({
        success: false,
        error: 'Gmail non configurato'
      }, { status: 401 })
    }

    // Set up OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/gmail/callback`
    )

    oauth2Client.setCredentials({
      refresh_token: refreshTokenData.value
    })

    // Get Gmail service
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

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