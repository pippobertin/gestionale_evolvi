import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { supabase } from '@/lib/supabase'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-change-in-production'
const JWT_EXPIRES_IN = '7d'

export async function POST(request: NextRequest) {
  try {
    const { email, password, nome, cognome } = await request.json()

    if (!email || !password || !nome || !cognome) {
      return NextResponse.json(
        { error: 'Tutti i campi sono richiesti' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'La password deve essere di almeno 6 caratteri' },
        { status: 400 }
      )
    }

    // Verifica se l'email esiste già
    const { data: existingUser } = await supabase
      .from('scadenze_bandi_utenti')
      .select('id')
      .eq('email', email.toLowerCase())
      .single()

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email già registrata' },
        { status: 409 }
      )
    }

    // Hash della password
    const passwordHash = await bcrypt.hash(password, 10)

    // Crea l'utente
    const { data: nuovoUtente, error: createError } = await supabase
      .from('scadenze_bandi_utenti')
      .insert({
        email: email.toLowerCase(),
        password_hash: passwordHash,
        nome: nome.trim(),
        cognome: cognome.trim(),
        livello_permessi: 'collaboratore', // Nuovi utenti sono collaboratori per default
        attivo: true
      })
      .select()
      .single()

    if (createError) {
      console.error('Errore creazione utente:', createError)
      return NextResponse.json(
        { error: 'Errore durante la registrazione' },
        { status: 500 }
      )
    }

    // Crea il token JWT
    const token = jwt.sign(
      {
        userId: nuovoUtente.id,
        email: nuovoUtente.email,
        livello_permessi: nuovoUtente.livello_permessi
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    )

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
        utente_id: nuovoUtente.id,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
        user_agent: userAgent,
        ip_address: clientIp
      })

    // Prepara dati utente (senza password_hash)
    const userData = {
      id: nuovoUtente.id,
      email: nuovoUtente.email,
      nome: nuovoUtente.nome,
      cognome: nuovoUtente.cognome,
      livello_permessi: nuovoUtente.livello_permessi,
      nome_completo: `${nuovoUtente.nome} ${nuovoUtente.cognome}`
    }

    return NextResponse.json({
      success: true,
      token,
      user: userData
    })

  } catch (error) {
    console.error('Errore signup:', error)
    return NextResponse.json(
      { error: 'Errore interno del server' },
      { status: 500 }
    )
  }
}