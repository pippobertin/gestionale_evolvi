import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { creaSessione, impostaCookieSessione } from '@/lib/sessioni'
import { accessoScaduto } from '@/lib/accessoUtente'
import { registraEvento } from '@/lib/registro'
import { permessiDelRuolo } from '@/lib/permessi'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email e password sono richiesti' },
        { status: 400 }
      )
    }

    // Trova l'utente nel database
    const { data: utente, error: userError } = await supabase
      .from('scadenze_bandi_utenti')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('attivo', true)
      .single()

    if (userError || !utente) {
      await registraEvento({
        evento: 'accesso_negato', esito: 'negato', request,
        descrizione: 'Accesso con password: email non censita o utente disattivato',
        dettagli: { email_inserita: String(email).toLowerCase().slice(0, 120) }
      })
      return NextResponse.json(
        { error: 'Credenziali non valide' },
        { status: 401 }
      )
    }

    // Verifica la password
    const passwordMatch = await bcrypt.compare(password, utente.password_hash)
    if (!passwordMatch) {
      await registraEvento({
        evento: 'accesso_negato', esito: 'negato', utenteId: utente.id, request,
        descrizione: 'Accesso con password: password errata'
      })
      return NextResponse.json(
        { error: 'Credenziali non valide' },
        { status: 401 }
      )
    }

    // Accesso a termine scaduto: la password è giusta, ma l'accesso non è più consentito
    if (accessoScaduto(utente.accesso_fino_al)) {
      await registraEvento({
        evento: 'accesso_negato', esito: 'negato', utenteId: utente.id, request,
        descrizione: `Accesso con password: accesso scaduto il ${utente.accesso_fino_al}`
      })
      return NextResponse.json(
        { error: "Il tuo accesso al gestionale è scaduto. Rivolgiti a un amministratore." },
        { status: 403 }
      )
    }

    // Aggiorna ultimo accesso
    await supabase
      .from('scadenze_bandi_utenti')
      .update({ ultimo_accesso: new Date().toISOString() })
      .eq('id', utente.id)

    // Sessione revocabile nel database e token nel solo cookie httpOnly
    const token = await creaSessione(utente, request, 'password')
    await registraEvento({
      evento: 'accesso', utenteId: utente.id, request,
      descrizione: 'Accesso con password'
    })

    // Prepara dati utente (senza password_hash)
    const userData = {
      id: utente.id,
      email: utente.email,
      nome: utente.nome,
      cognome: utente.cognome,
      livello_permessi: utente.livello_permessi,
      permessi: await permessiDelRuolo(utente.livello_permessi),
      nome_completo: `${utente.nome} ${utente.cognome}`,
      first_login_password_change: utente.first_login_password_change || false
    }

    const requiresPasswordChange = utente.first_login_password_change || false

    // Create response with cookie
    // Il token non viene restituito al codice del browser: vive solo nel cookie
    const response = NextResponse.json({
      success: true,
      user: userData,
      requiresPasswordChange
    })

    impostaCookieSessione(response, token)

    return response

  } catch (error) {
    console.error('Errore login:', error)
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    )
  }
}