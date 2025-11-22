import { NextRequest, NextResponse } from 'next/server'
import { GmailService } from '@/lib/gmail'

export async function GET(request: NextRequest) {
  try {
    const gmailService = new GmailService({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/gmail/callback`
    })

    const authUrl = gmailService.getAuthUrl()

    return NextResponse.json({
      success: true,
      authUrl
    })

  } catch (error) {
    console.error('Errore generazione Gmail auth URL:', error)
    return NextResponse.json({
      success: false,
      error: 'Errore interno del server'
    }, { status: 500 })
  }
}