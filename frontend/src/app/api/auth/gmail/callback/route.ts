import { NextRequest, NextResponse } from 'next/server'
import { GmailService } from '@/lib/gmail'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    if (error) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/?gmail_error=${encodeURIComponent(error)}`
      )
    }

    if (!code) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/?gmail_error=no_code`
      )
    }

    // Scambia codice con tokens
    const gmailService = new GmailService({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/gmail/callback`
    })

    const { accessToken, refreshToken } = await gmailService.getTokensFromCode(code)

    // Salva tokens nel database (o variabili ambiente per semplicità)
    await supabase
      .from('scadenze_bandi_system_settings')
      .upsert({
        key: 'gmail_refresh_token',
        value: refreshToken,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' })

    await supabase
      .from('scadenze_bandi_system_settings')
      .upsert({
        key: 'gmail_access_token',
        value: accessToken,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' })

    // Salva la scadenza del token (Google tokens durano 1 ora)
    const expiryTime = Date.now() + (55 * 60 * 1000) // 55 minuti per sicurezza
    await supabase
      .from('scadenze_bandi_system_settings')
      .upsert({
        key: 'gmail_token_expires_at',
        value: expiryTime.toString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' })

    console.log('✅ Gmail tokens salvati nel database, validi fino a', new Date(expiryTime).toLocaleString())

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/?gmail_success=true`
    )

  } catch (error) {
    console.error('Errore callback Gmail:', error)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/?gmail_error=${encodeURIComponent('callback_error')}`
    )
  }
}