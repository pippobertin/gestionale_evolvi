import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import bcrypt from 'bcrypt'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { requireAdmin } from '@/lib/jwtAuth'

/**
 * POST /api/admin/users/[id]/reset-password  (solo amministratori)
 *
 * Genera una nuova password temporanea per l'utente, lo obbliga a cambiarla al
 * prossimo accesso e chiude tutte le sue sessioni aperte. La password
 * temporanea viene restituita una sola volta, per comunicarla al collega.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const admin = await requireAdmin(request)
    if (!admin) {
      return NextResponse.json({ error: 'Non autenticato o permessi insufficienti' }, { status: 401 })
    }
    if (admin.userId === id) {
      return NextResponse.json(
        { error: 'Per la tua password usa Impostazioni → La mia password' },
        { status: 400 }
      )
    }

    const temporaryPassword = crypto.randomBytes(9).toString('base64url')
    const passwordHash = await bcrypt.hash(temporaryPassword, 10)

    const { data: utente, error } = await supabase
      .from('scadenze_bandi_utenti')
      .update({
        password_hash: passwordHash,
        first_login_password_change: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('id, email, nome, cognome')
      .single()

    if (error || !utente) {
      return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 })
    }

    // Chiude le sessioni aperte: l'utente dovrà rientrare con la password temporanea
    await supabase
      .from('scadenze_bandi_sessioni')
      .update({ revoked_at: new Date().toISOString() })
      .eq('utente_id', id)
      .is('revoked_at', null)

    return NextResponse.json({
      success: true,
      user: utente,
      temporaryPassword,
      message: 'Password reimpostata'
    })
  } catch (error) {
    console.error('Errore reimpostazione password:', error)
    return NextResponse.json({ error: 'Errore del server' }, { status: 500 })
  }
}
