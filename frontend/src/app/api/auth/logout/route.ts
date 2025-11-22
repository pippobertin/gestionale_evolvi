import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import { supabase } from '@/lib/supabase'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-change-in-production'

export async function POST(request: NextRequest) {
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
      // Anche se il token non è valido, possiamo procedere con il logout
    }

    // Rimuovi la sessione dal database se possibile
    if (decoded?.userId) {
      const tokenHash = await bcrypt.hash(token, 10)
      await supabase
        .from('scadenze_bandi_sessioni')
        .delete()
        .eq('utente_id', decoded.userId)
        .eq('token_hash', tokenHash)
    }

    // Pulisci sessioni scadute (cleanup opportunistico)
    await supabase
      .from('scadenze_bandi_sessioni')
      .delete()
      .lt('expires_at', new Date().toISOString())

    return NextResponse.json({
      success: true,
      message: 'Logout effettuato con successo'
    })

  } catch (error) {
    console.error('Errore logout:', error)
    // Ritorna successo anche in caso di errore per non bloccare il logout lato client
    return NextResponse.json({
      success: true,
      message: 'Logout effettuato'
    })
  }
}