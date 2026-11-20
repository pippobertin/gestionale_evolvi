import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { verifyJWT } from '@/lib/jwtAuth'

/**
 * GET /api/auth/verify
 * Restituisce l'utente della sessione aperta (cookie httpOnly `auth_token`).
 * 401 se la sessione manca, è scaduta o è stata revocata.
 */
export async function GET(request: NextRequest) {
  try {
    const sessione = await verifyJWT(request)
    if (!sessione) {
      return NextResponse.json({ error: 'Sessione non valida' }, { status: 401 })
    }

    const { data: utente, error: userError } = await supabase
      .from('scadenze_bandi_utenti')
      .select('id, email, nome, cognome, livello_permessi')
      .eq('id', sessione.userId)
      .single()

    if (userError || !utente) {
      return NextResponse.json({ error: 'Utente non trovato' }, { status: 401 })
    }

    return NextResponse.json({
      success: true,
      user: {
        id: utente.id,
        email: utente.email,
        nome: utente.nome,
        cognome: utente.cognome,
        livello_permessi: utente.livello_permessi,
        nome_completo: `${utente.nome} ${utente.cognome}`,
        first_login_password_change: !!sessione.deve_cambiare_password
      },
      requiresPasswordChange: !!sessione.deve_cambiare_password
    })
  } catch (error) {
    console.error('Errore verifica sessione:', error)
    return NextResponse.json({ error: 'Errore interno del server' }, { status: 500 })
  }
}
