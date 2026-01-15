import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { supabase } from '@/lib/supabase'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-change-in-production'

export async function POST(request: NextRequest) {
  try {
    const { currentPassword, newPassword } = await request.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Password attuale e nuova password sono richieste' },
        { status: 400 }
      )
    }

    // Verifica il token JWT
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Token di autorizzazione richiesto' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    let decoded: any
    try {
      decoded = jwt.verify(token, JWT_SECRET)
    } catch (error) {
      return NextResponse.json(
        { error: 'Token non valido' },
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