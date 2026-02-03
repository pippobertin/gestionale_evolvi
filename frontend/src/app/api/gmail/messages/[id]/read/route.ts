import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { supabase } from '@/lib/supabase'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const messageId = resolvedParams.id

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