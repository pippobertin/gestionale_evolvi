import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { creaSessione, impostaCookieSessione } from '@/lib/sessioni'

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
      return NextResponse.json(
        { error: 'Credenziali non valide' },
        { status: 401 }
      )
    }

    // Verifica la password
    const passwordMatch = await bcrypt.compare(password, utente.password_hash)
    if (!passwordMatch) {
      return NextResponse.json(
        { error: 'Credenziali non valide' },
        { status: 401 }
      )
    }

    // Aggiorna ultimo accesso
    await supabase
      .from('scadenze_bandi_utenti')
      .update({ ultimo_accesso: new Date().toISOString() })
      .eq('id', utente.id)

    // Sessione revocabile nel database e token nel solo cookie httpOnly
    const token = await creaSessione(utente, request, 'password')

    // Prepara dati utente (senza password_hash)
    const userData = {
      id: utente.id,
      email: utente.email,
      nome: utente.nome,
      cognome: utente.cognome,
      livello_permessi: utente.livello_permessi,
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