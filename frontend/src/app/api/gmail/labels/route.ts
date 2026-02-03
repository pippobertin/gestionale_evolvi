import { NextResponse } from 'next/server'
import { google } from 'googleapis'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Get Gmail tokens from system settings
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

    // Fetch labels
    const response = await gmail.users.labels.list({
      userId: 'me'
    })

    const labels = response.data.labels || []

    // Transform labels to include unread counts
    const labelsWithCounts = await Promise.all(labels.map(async (label) => {
      try {
        if (label.id && ['INBOX', 'SENT', 'DRAFTS', 'SPAM', 'TRASH', 'STARRED'].includes(label.id)) {
          console.log(`Processing label: ${label.id}`)

          // Get counts for inbox
          if (label.id === 'INBOX') {
            // Get total count for inbox using actual count instead of estimate
            const totalResponse = await gmail.users.messages.list({
              userId: 'me',
              labelIds: ['INBOX'],
              maxResults: 500
            })

            // Get unread count for inbox
            const unreadResponse = await gmail.users.messages.list({
              userId: 'me',
              labelIds: ['INBOX', 'UNREAD'],
              maxResults: 500
            })

            const totalCount = totalResponse.data.messages?.length || 0
            const unreadCount = unreadResponse.data.messages?.length || 0
            console.log(`INBOX total count: ${totalCount}, unread count: ${unreadCount}`)

            return {
              ...label,
              messagesTotal: totalCount,
              messagesUnread: unreadCount
            }
          }

          // For other labels, get actual count
          // Use smaller maxResults for TRASH to avoid counting deleted messages
          const maxResultsForLabel = label.id === 'TRASH' ? 100 : 500

          const totalResponse = await gmail.users.messages.list({
            userId: 'me',
            labelIds: [label.id],
            maxResults: maxResultsForLabel
          })

          // For TRASH, also check if there are more messages and use resultSizeEstimate if needed
          let totalCount = totalResponse.data.messages?.length || 0

          if (label.id === 'TRASH' && totalResponse.data.resultSizeEstimate) {
            // If we got exactly maxResults, there might be more - use estimate
            if (totalCount === maxResultsForLabel && totalResponse.data.resultSizeEstimate < 500) {
              totalCount = totalResponse.data.resultSizeEstimate
            }
          }

          console.log(`${label.id} total count: ${totalCount} (estimate: ${totalResponse.data.resultSizeEstimate})`)

          return {
            ...label,
            messagesTotal: totalCount,
            messagesUnread: 0
          }
        }
        console.log(`Skipping label: ${label.id}`)
        return {
          ...label,
          messagesTotal: 0,
          messagesUnread: 0
        }
      } catch (error) {
        console.warn(`Error getting counts for label ${label.id}:`, error)
        return {
          ...label,
          messagesTotal: 0,
          messagesUnread: 0
        }
      }
    }))

    console.log('Final labels with counts:', JSON.stringify(labelsWithCounts.filter(l => (l.messagesUnread && l.messagesUnread > 0) || (l.messagesTotal && l.messagesTotal > 0)), null, 2))

    return NextResponse.json({
      success: true,
      labels: labelsWithCounts
    })

  } catch (error: any) {
    console.error('Error fetching Gmail labels:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore durante il caricamento delle etichette'
    }, { status: 500 })
  }
}