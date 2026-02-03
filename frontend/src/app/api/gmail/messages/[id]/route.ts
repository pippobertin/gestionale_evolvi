import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { supabase } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    console.log('Gmail message detail params:', resolvedParams)
    const messageId = resolvedParams.id
    console.log('Gmail message ID:', messageId)

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

    // Fetch full message
    const messageResponse = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full'
    })

    const message = messageResponse.data

    // Extract body content
    let bodyText = ''
    let bodyHtml = ''

    const extractBody = (parts: any[]): void => {
      parts.forEach(part => {
        if (part.mimeType === 'text/plain' && part.body.data) {
          bodyText = Buffer.from(part.body.data, 'base64').toString('utf-8')
        } else if (part.mimeType === 'text/html' && part.body.data) {
          bodyHtml = Buffer.from(part.body.data, 'base64').toString('utf-8')
        } else if (part.parts) {
          extractBody(part.parts)
        }
      })
    }

    if (message.payload?.parts) {
      extractBody(message.payload.parts)
    } else if (message.payload?.body?.data) {
      // Single part message
      if (message.payload.mimeType === 'text/plain') {
        bodyText = Buffer.from(message.payload.body.data, 'base64').toString('utf-8')
      } else if (message.payload.mimeType === 'text/html') {
        bodyHtml = Buffer.from(message.payload.body.data, 'base64').toString('utf-8')
      }
    }

    // Extract attachments info
    const attachments: Array<{
      filename: string
      mimeType: string
      size: number
      attachmentId: string
    }> = []

    const extractAttachments = (parts: any[]): void => {
      parts.forEach(part => {
        if (part.filename && part.filename.length > 0 && part.body?.attachmentId) {
          attachments.push({
            filename: part.filename,
            mimeType: part.mimeType,
            size: part.body.size || 0,
            attachmentId: part.body.attachmentId
          })
        } else if (part.parts) {
          extractAttachments(part.parts)
        }
      })
    }

    if (message.payload?.parts) {
      extractAttachments(message.payload.parts)
    }

    // Mark as read
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        removeLabelIds: ['UNREAD']
      }
    })

    return NextResponse.json({
      success: true,
      message: {
        ...message,
        bodyText,
        bodyHtml,
        attachments
      }
    })

  } catch (error: any) {
    console.error('Error fetching Gmail message detail:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore durante il caricamento del messaggio'
    }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const messageId = resolvedParams.id

    // Check if we should permanently delete (for messages in trash)
    const { searchParams } = new URL(request.url)
    const permanent = searchParams.get('permanent') === 'true'

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

    if (permanent) {
      // Permanently delete message
      await gmail.users.messages.delete({
        userId: 'me',
        id: messageId
      })

      return NextResponse.json({
        success: true,
        message: 'Messaggio eliminato definitivamente'
      })
    } else {
      // Move to trash
      await gmail.users.messages.trash({
        userId: 'me',
        id: messageId
      })

      return NextResponse.json({
        success: true,
        message: 'Messaggio spostato nel cestino'
      })
    }

  } catch (error: any) {
    console.error('Error deleting Gmail message:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore durante l\'eliminazione del messaggio'
    }, { status: 500 })
  }
}