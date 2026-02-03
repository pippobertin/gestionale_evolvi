import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const labelIds = searchParams.get('labelIds')?.split(',') || ['INBOX']
    const maxResults = parseInt(searchParams.get('maxResults') || '50')
    const pageToken = searchParams.get('pageToken')
    const query = searchParams.get('q')

    // Get Gmail tokens
    const { data: refreshTokenData } = await supabase
      .from('scadenze_bandi_system_settings')
      .select('value')
      .eq('key', 'gmail_refresh_token')
      .single()

    const { data: accessTokenData } = await supabase
      .from('scadenze_bandi_system_settings')
      .select('value')
      .eq('key', 'gmail_access_token')
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
      refresh_token: refreshTokenData.value,
      access_token: accessTokenData?.value
    })

    // Get Gmail service
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

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