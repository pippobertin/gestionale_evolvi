import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import { createGoogleAuthClient } from '@/lib/gmail'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export async function GET(request: NextRequest) {
  try {
    // 1. Verifica JWT per identificare l'utente
    const decoded = await verifyJWT(request)
    const userId = decoded?.userId

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'Non autenticato'
      }, { status: 401 })
    }

    // 2. Recupera token OAuth utente dal database
    const { data: userData, error: userError } = await supabaseAdmin
      .from('scadenze_bandi_utenti')
      .select('gmail_refresh_token, gmail_email')
      .eq('id', userId)
      .single()

    if (userError || !userData?.gmail_refresh_token) {
      return NextResponse.json({
        success: false,
        error: 'Gmail/Calendar non connesso. Vai in Impostazioni → Il Mio Gmail per collegare il tuo account.'
      }, { status: 401 })
    }

    // 3. Crea OAuth2 client con i token dell'utente
    const oauth2Client = createGoogleAuthClient(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/user/gmail/callback`
    )
    // Solo il refresh token: l'access token salvato nel database è quello del
    // momento del collegamento (scade dopo un'ora) e, senza data di scadenza,
    // la libreria lo restituirebbe così com'è invece di rinnovarlo. Google lo
    // rifiutava con 401 e nessun evento veniva creato nel calendario.
    oauth2Client.setCredentials({
      refresh_token: userData.gmail_refresh_token
    })

    // 4. Ottieni un access token nuovo dal refresh token
    const tokenResponse = await oauth2Client.getAccessToken()

    if (!tokenResponse.token) {
      return NextResponse.json({
        success: false,
        error: 'Impossibile ottenere access token. Prova a ricollegare Gmail nelle Impostazioni.'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      accessToken: tokenResponse.token
    })

  } catch (error) {
    console.error('❌ Errore recupero token Calendar:', error)
    return NextResponse.json({
      success: false,
      error: 'Errore interno del server'
    }, { status: 500 })
  }
}
