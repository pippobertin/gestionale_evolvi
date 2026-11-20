import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/jwtAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

/**
 * Registrazione di una prova di ripristino: una riga con data, chi, cosa, esito,
 * come indicato dal consulente 231. Chi la registra è l'amministratore collegato.
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const { data_prova, backup_id, cosa, esito, note } = body || {}

  if (typeof data_prova !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data_prova)) {
    return NextResponse.json({ error: 'Data della prova non valida' }, { status: 400 })
  }
  if (typeof cosa !== 'string' || cosa.trim().length < 3) {
    return NextResponse.json({ error: 'Indica cosa è stato ripristinato o verificato' }, { status: 400 })
  }
  if (!['ok', 'parziale', 'errore'].includes(esito)) {
    return NextResponse.json({ error: 'Esito non valido' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('scadenze_bandi_backup_registro')
    .insert({
      tipo: 'prova_ripristino',
      eseguito_il: `${data_prova}T12:00:00+00:00`,
      eseguito_da: admin.userId,
      esito,
      backup_id: typeof backup_id === 'string' && backup_id ? backup_id : null,
      cosa: cosa.trim().slice(0, 2000),
      note: typeof note === 'string' && note.trim() ? note.trim().slice(0, 4000) : null
    })
    .select('id')
    .single()

  if (error) {
    console.error('[backup] registrazione prova:', error.message)
    return NextResponse.json({ error: 'Registrazione non riuscita' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, id: data.id })
}
