import { NextResponse } from 'next/server'
import { GmailService } from '@/lib/gmail'
import { supabase } from '@/lib/supabase'

export async function POST() {
  try {
    // Recupera tokens dal database
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
        error: 'Gmail non configurato - autorizzazione richiesta'
      }, { status: 400 })
    }

    // Test connessione Gmail
    const gmailService = new GmailService({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/gmail/callback`,
      refreshToken: refreshTokenData.value,
      accessToken: accessTokenData?.value
    })

    const connectionTest = await gmailService.testConnection()

    if (!connectionTest) {
      return NextResponse.json({
        success: false,
        error: 'Test connessione Gmail fallito'
      }, { status: 400 })
    }

    // Invia email di test
    const testEmailSuccess = await gmailService.sendEmail(
      'info@blmproject.com',
      '🧪 Test Gmail API - Gestionale Evolvi',
      `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Test Gmail API</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #06b6d4, #059669); padding: 30px; border-radius: 12px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px;">
                  🚀 Gmail API Configurato!
                </h1>
                <p style="color: #e0f7fa; margin: 8px 0 0 0;">
                  Test di invio email dal Gestionale Evolvi
                </p>
              </div>

              <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
                <h2 style="color: #111827; margin: 0 0 16px 0;">✅ Configurazione Completata</h2>

                <p>Il sistema di notifiche email è ora attivo e funzionante!</p>

                <ul style="color: #4b5563;">
                  <li>✅ Gmail API connessa</li>
                  <li>✅ Autenticazione OAuth 2.0 configurata</li>
                  <li>✅ Account: info@blmproject.com</li>
                  <li>✅ Invio email abilitato</li>
                </ul>

                <div style="background: #f0f9ff; padding: 16px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 0; color: #0369a1;">
                    <strong>📧 Prossimi passaggi:</strong><br>
                    Le notifiche di scadenze verranno ora inviate automaticamente agli utenti configurati.
                  </p>
                </div>

                <div style="text-align: center; margin: 30px 0;">
                  <a href="${process.env.NEXT_PUBLIC_APP_URL}/settings"
                     style="background: linear-gradient(135deg, #06b6d4, #059669); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                    🔧 Vai alle Impostazioni
                  </a>
                </div>

                <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; text-align: center; color: #6b7280; font-size: 14px;">
                  <p>Test email generata automaticamente dal Gestionale Evolvi</p>
                  <p style="margin: 0;">${new Date().toLocaleString('it-IT')}</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `
    )

    if (!testEmailSuccess) {
      return NextResponse.json({
        success: false,
        error: 'Invio email di test fallito'
      }, { status: 400 })
    }

    // Salva timestamp ultimo test
    await supabase
      .from('scadenze_bandi_system_settings')
      .upsert({
        key: 'gmail_last_test',
        value: new Date().toISOString(),
        description: 'Ultimo test Gmail API',
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' })

    return NextResponse.json({
      success: true,
      message: 'Gmail API test completato con successo',
      testEmail: 'info@blmproject.com'
    })

  } catch (error) {
    console.error('Errore test Gmail:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Errore test Gmail API'
    }, { status: 500 })
  }
}