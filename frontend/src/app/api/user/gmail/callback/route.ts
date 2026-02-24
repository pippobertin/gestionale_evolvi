import { NextRequest, NextResponse } from 'next/server'
import { createGoogleAuthClient } from '@/lib/gmail'
import { createClient } from '@supabase/supabase-js'
import { google } from 'googleapis'

/**
 * GET /api/user/gmail/callback
 * OAuth callback - exchanges code for tokens and saves to user record
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state') // This contains userId
    const error = searchParams.get('error')

    if (error) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/?gmail_error=${encodeURIComponent(error)}`
      )
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/?gmail_error=missing_code_or_state`
      )
    }

    const userId = state

    // Exchange code for tokens
    const oauth2Client = createGoogleAuthClient(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/user/gmail/callback`
    )

    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)

    // Get user's Gmail address
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
    const { data: userInfo } = await oauth2.userinfo.get()
    const gmailEmail = userInfo.email

    // Save tokens to user record
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error: updateError } = await supabase
      .from('scadenze_bandi_utenti')
      .update({
        gmail_refresh_token: tokens.refresh_token,
        gmail_access_token: tokens.access_token,
        gmail_connected_at: new Date().toISOString(),
        gmail_email: gmailEmail
      })
      .eq('id', userId)

    if (updateError) {
      console.error('Error saving Gmail tokens:', updateError)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/?gmail_error=save_failed`
      )
    }

    console.log(`✅ Gmail connected for user ${userId}: ${gmailEmail}`)

    // Redirect back to homepage with success message
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/?gmail_success=true`
    )

  } catch (error: any) {
    console.error('Error in Gmail callback:', error)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/?gmail_error=${encodeURIComponent(error.message)}`
    )
  }
}
