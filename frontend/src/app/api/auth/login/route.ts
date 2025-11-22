import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { supabase } from '@/lib/supabase'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-change-in-production'
const JWT_EXPIRES_IN = '7d'

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

    // Crea il token JWT
    const token = jwt.sign(
      {
        userId: utente.id,
        email: utente.email,
        livello_permessi: utente.livello_permessi
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    )

    // Aggiorna ultimo accesso
    await supabase
      .from('scadenze_bandi_utenti')
      .update({ ultimo_accesso: new Date().toISOString() })
      .eq('id', utente.id)

    // Crea sessione nel database
    const userAgent = request.headers.get('user-agent') || ''
    const forwardedFor = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const clientIp = forwardedFor?.split(',')[0] || realIp || '127.0.0.1'

    const tokenHash = await bcrypt.hash(token, 10)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 giorni

    await supabase
      .from('scadenze_bandi_sessioni')
      .insert({
        utente_id: utente.id,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
        user_agent: userAgent,
        ip_address: clientIp
      })

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
      token,
      user: userData
    })

  } catch (error) {
    console.error('Errore login:', error)
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    )
  }
}