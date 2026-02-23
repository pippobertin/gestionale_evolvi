import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/jwtAuth'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/user/gmail/status
 * Returns user's Gmail connection status
 */
export async function GET(request: NextRequest) {
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

    // Check if user has Gmail connected
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: userData, error } = await supabase
      .from('scadenze_bandi_utenti')
      .select('gmail_email, gmail_connected_at')
      .eq('id', decoded.userId)
      .single()

    if (error) {
      console.error('Error fetching Gmail status:', error)
      return NextResponse.json(
        { error: 'Errore nel recupero dello stato' },
        { status: 500 }
      )
    }

    const isConnected = !!userData.gmail_email

    return NextResponse.json({
      success: true,
      connected: isConnected,
      email: userData.gmail_email || null,
      connectedAt: userData.gmail_connected_at || null
    })

  } catch (error: any) {
    console.error('Error checking Gmail status:', error)
    return NextResponse.json(
      { error: error.message || 'Errore interno del server' },
      { status: 500 }
    )
  }
}
