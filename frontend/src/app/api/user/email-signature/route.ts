import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * GET /api/user/email-signature
 * Returns the user's saved email signature HTML
 */
export async function GET(request: NextRequest) {
  try {
    const decoded = await verifyJWT(request)
    if (!decoded || !decoded.userId) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
    }

    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('scadenze_bandi_utenti')
      .select('firma_email_html, nome, cognome, email')
      .eq('id', decoded.userId)
      .single()

    if (error) {
      console.error('Error fetching email signature:', error)
      return NextResponse.json({ error: 'Errore nel recupero della firma' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      firma_email_html: data.firma_email_html || null,
      nome: data.nome,
      cognome: data.cognome,
      email: data.email
    })
  } catch (error: any) {
    console.error('Error in GET email-signature:', error)
    return NextResponse.json({ error: error.message || 'Errore interno' }, { status: 500 })
  }
}

/**
 * PUT /api/user/email-signature
 * Saves the user's email signature HTML
 */
export async function PUT(request: NextRequest) {
  try {
    const decoded = await verifyJWT(request)
    if (!decoded || !decoded.userId) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
    }

    const { firma_email_html } = await request.json()

    if (typeof firma_email_html !== 'string') {
      return NextResponse.json({ error: 'firma_email_html deve essere una stringa' }, { status: 400 })
    }

    const supabase = getSupabase()
    const { error } = await supabase
      .from('scadenze_bandi_utenti')
      .update({ firma_email_html })
      .eq('id', decoded.userId)

    if (error) {
      console.error('Error saving email signature:', error)
      return NextResponse.json({ error: 'Errore nel salvataggio della firma' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Firma salvata con successo' })
  } catch (error: any) {
    console.error('Error in PUT email-signature:', error)
    return NextResponse.json({ error: error.message || 'Errore interno' }, { status: 500 })
  }
}
