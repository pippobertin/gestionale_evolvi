import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/jwtAuth'
import { createClient } from '@supabase/supabase-js'

/**
 * POST /api/user/gmail/disconnect
 * Disconnects user's Gmail account
 */
export async function POST(request: NextRequest) {
  try {
    // Verify user is logged in
    const token = request.cookies.get('auth_token')?.value
    if (!token) {
      return NextResponse.json(
        { error: 'Non autenticato' },
        { status: 401 }
      )
    }

    const decoded = verifyToken(token)
    if (!decoded || !decoded.userId) {
      return NextResponse.json(
        { error: 'Token non valido' },
        { status: 401 }
      )
    }

    // Remove Gmail tokens from user record
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error: updateError } = await supabase
      .from('scadenze_bandi_utenti')
      .update({
        gmail_refresh_token: null,
        gmail_access_token: null,
        gmail_connected_at: null,
        gmail_email: null
      })
      .eq('id', decoded.userId)

    if (updateError) {
      console.error('Error disconnecting Gmail:', updateError)
      return NextResponse.json(
        { error: 'Errore durante la disconnessione' },
        { status: 500 }
      )
    }

    console.log(`✅ Gmail disconnected for user ${decoded.userId}`)

    return NextResponse.json({
      success: true,
      message: 'Gmail disconnesso con successo'
    })

  } catch (error: any) {
    console.error('Error disconnecting Gmail:', error)
    return NextResponse.json(
      { error: error.message || 'Errore interno del server' },
      { status: 500 }
    )
  }
}
