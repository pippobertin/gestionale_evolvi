import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/jwtAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { eseguiBackup, CARTELLA_BACKUP, NOME_DRIVE } from '@/lib/backupGestionale'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

/** Registro delle esportazioni e delle prove di ripristino (solo amministratori). */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('scadenze_bandi_backup_registro')
    .select(`
      id, tipo, eseguito_il, origine, esito, file_nome, file_drive_id, dimensione_byte,
      sha256, conteggi, backup_id, cosa, note, errore,
      utente:scadenze_bandi_utenti!scadenze_bandi_backup_registro_eseguito_da_fkey(nome, cognome)
    `)
    .order('eseguito_il', { ascending: false })
    .limit(100)

  if (error) {
    console.error('[backup] lettura registro:', error.message)
    return NextResponse.json({ error: 'Registro non disponibile' }, { status: 500 })
  }
  return NextResponse.json({
    registro: data,
    destinazione: `${NOME_DRIVE} > ${CARTELLA_BACKUP}`
  })
}

/** Esportazione manuale immediata. */
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 })

  const esito = await eseguiBackup('manuale', admin.userId)
  if (!esito.ok) {
    return NextResponse.json({ error: `Esportazione non riuscita: ${esito.errore}` }, { status: 500 })
  }
  return NextResponse.json({ ok: true, riga: esito.riga })
}
