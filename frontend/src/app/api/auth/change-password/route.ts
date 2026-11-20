import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { verifyJWT } from '@/lib/jwtAuth'
import { dimenticaToken, revocaAltreSessioni, tokenDallaRichiesta } from '@/lib/sessioni'
import { registraEvento } from '@/lib/registro'


export async function POST(request: NextRequest) {
  try {
    const { currentPassword, newPassword } = await request.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Password attuale e nuova password sono richieste' },
        { status: 400 }
      )
    }

    // Utente della sessione aperta (cookie httpOnly)
    const decoded = await verifyJWT(request)
    if (!decoded) {
      return NextResponse.json(
        { error: 'Sessione non valida: accedi di nuovo' },
        { status: 401 }
      )
    }

    // Trova l'utente
    const { data: utente, error: userError } = await supabase
      .from('scadenze_bandi_utenti')
      .select('*')
      .eq('id', decoded.userId)
      .eq('attivo', true)
      .single()

    if (userError || !utente) {
      return NextResponse.json(
        { error: 'Utente non trovato' },
        { status: 404 }
      )
    }

    // Verifica password attuale
    const passwordMatch = await bcrypt.compare(currentPassword, utente.password_hash)
    if (!passwordMatch) {
      return NextResponse.json(
        { error: 'Password attuale non corretta' },
        { status: 401 }
      )
    }

    // Validazione nuova password
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'La nuova password deve essere di almeno 8 caratteri' },
        { status: 400 }
      )
    }

    // Hash nuova password
    const newPasswordHash = await bcrypt.hash(newPassword, 10)

    // Aggiorna password e rimuovi il flag per cambio password obbligatorio
    const { error: updateError } = await supabase
      .from('scadenze_bandi_utenti')
      .update({
        password_hash: newPasswordHash,
        first_login_password_change: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', utente.id)

    if (updateError) {
      throw updateError
    }

    // La sessione corrente passa subito ad accesso completo; le altre sessioni
    // aperte dello stesso utente (altri browser, altri dispositivi) vengono chiuse.
    dimenticaToken(tokenDallaRichiesta(request))
    if (decoded.sid) {
      await revocaAltreSessioni(utente.id, decoded.sid)
    }

    await registraEvento({
      evento: 'cambio_password', utenteId: utente.id, request,
      descrizione: utente.first_login_password_change
        ? 'Cambio della password temporanea al primo accesso'
        : 'Cambio della propria password; chiuse le altre sessioni aperte'
    })

    return NextResponse.json({
      success: true,
      message: 'Password aggiornata con successo'
    })

  } catch (error) {
    console.error('Errore cambio password:', error)
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    )
  }
}