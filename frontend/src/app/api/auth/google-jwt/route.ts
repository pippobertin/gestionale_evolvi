import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { verifyJWT } from '@/lib/jwtAuth'
import { creaSessione, impostaCookieSessione } from '@/lib/sessioni'
import { accessoScaduto } from '@/lib/accessoUtente'

/**
 * GET /api/auth/google-jwt
 * Per chi è entrato con Google: apre (o riusa) la sessione del gestionale e
 * imposta il cookie httpOnly `auth_token`. Il token non viene restituito al
 * codice del browser. Il browser la chiama a ogni caricamento di pagina:
 * se il cookie porta già una sessione valida della stessa persona, non ne
 * viene creata un'altra.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const emailGoogle = session?.user?.email?.toLowerCase()

    if (!emailGoogle) {
      return NextResponse.json({ error: 'No active Google session' }, { status: 401 })
    }

    const { data: utente, error } = await supabase
      .from('scadenze_bandi_utenti')
      .select('id, email, nome, cognome, livello_permessi, attivo, accesso_fino_al')
      .eq('email', emailGoogle)
      .eq('attivo', true)
      .single()

    if (error || !utente) {
      return NextResponse.json({ error: 'User not found or inactive' }, { status: 404 })
    }

    if (accessoScaduto(utente.accesso_fino_al)) {
      return NextResponse.json({ error: 'Accesso scaduto' }, { status: 403 })
    }

    const userData = {
      id: utente.id,
      email: utente.email,
      nome: utente.nome,
      cognome: utente.cognome,
      livello_permessi: utente.livello_permessi,
      nome_completo: `${utente.nome} ${utente.cognome}`
    }

    // Sessione già aperta e valida per la stessa persona: si riusa
    const esistente = await verifyJWT(request)
    if (esistente && esistente.userId === utente.id) {
      return NextResponse.json({ success: true, user: userData })
    }

    await supabase
      .from('scadenze_bandi_utenti')
      .update({ ultimo_accesso: new Date().toISOString() })
      .eq('id', utente.id)

    const token = await creaSessione(utente, request, 'google')
    const response = NextResponse.json({ success: true, user: userData })
    impostaCookieSessione(response, token)

    console.log(`✅ Sessione Google aperta per: ${utente.email}`)
    return response

  } catch (error: any) {
    console.error('Error creating Google session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
