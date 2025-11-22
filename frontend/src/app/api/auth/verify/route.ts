import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { supabase } from '@/lib/supabase'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-change-in-production'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Token mancante' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7) // Rimuove 'Bearer '

    // Verifica il token JWT
    let decoded: any
    try {
      decoded = jwt.verify(token, JWT_SECRET)
    } catch (error) {
      return NextResponse.json(
        { error: 'Token non valido' },
        { status: 401 }
      )
    }

    // Verifica che l'utente esista ancora e sia attivo
    const { data: utente, error: userError } = await supabase
      .from('scadenze_bandi_utenti')
      .select('*')
      .eq('id', decoded.userId)
      .eq('attivo', true)
      .single()

    if (userError || !utente) {
      return NextResponse.json(
        { error: 'Utente non trovato' },
        { status: 401 }
      )
    }

    // Prepara dati utente (senza password_hash)
    const userData = {
      id: utente.id,
      email: utente.email,
      nome: utente.nome,
      cognome: utente.cognome,
      livello_permessi: utente.livello_permessi,
      nome_completo: `${utente.nome} ${utente.cognome}`
    }

    return NextResponse.json({
      success: true,
      user: userData
    })

  } catch (error) {
    console.error('Errore verifica token:', error)
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    )
  }
}