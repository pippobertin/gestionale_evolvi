import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { erroreDatabase } from '@/lib/praticaForm'
import { oggiItalia } from '@/lib/accessoUtente'

/** Delega: riesame, revoca, aggiunta e rimozione delle persone autorizzate. */
const UUID = /^[0-9a-fA-F-]{36}$/

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const { id } = await params
  const b = await request.json().catch(() => ({}))
  const { data: delega } = await supabaseAdmin.from('scadenze_bandi_deleghe').select('id, revocata_il').eq('id', id).maybeSingle()
  if (!delega) return NextResponse.json({ error: 'Delega non trovata' }, { status: 404 })
  if (delega.revocata_il && b.azione !== 'rimuovi_persona') return NextResponse.json({ error: 'La delega è revocata' }, { status: 400 })

  if (b.azione === 'riesame') {
    const { error } = await supabaseAdmin.from('scadenze_bandi_deleghe')
      .update({ riesaminata_il: oggiItalia(), riesaminata_da: sessione.userId, ...(b.nota ? { nota: String(b.nota).trim() } : {}) }).eq('id', id)
    if (error) return erroreDatabase(error)
  } else if (b.azione === 'revoca') {
    const motivo = String(b.motivo || '').trim()
    if (!motivo) return NextResponse.json({ error: 'Indica il motivo della revoca o della cessazione' }, { status: 400 })
    const { error } = await supabaseAdmin.from('scadenze_bandi_deleghe')
      .update({ revocata_il: oggiItalia(), revoca_motivo: motivo, revocata_da: sessione.userId }).eq('id', id)
    if (error) return erroreDatabase(error)
    await supabaseAdmin.from('scadenze_bandi_deleghe_persone')
      .update({ rimossa_il: new Date().toISOString(), rimossa_da: sessione.userId, rimossa_motivo: 'Delega revocata' })
      .eq('delega_id', id).is('rimossa_il', null)
  } else if (b.azione === 'aggiungi_persona') {
    if (!UUID.test(String(b.utente_id || ''))) return NextResponse.json({ error: 'Indica la persona' }, { status: 400 })
    const { data: u } = await supabaseAdmin.from('scadenze_bandi_utenti').select('attivo, livello_permessi').eq('id', b.utente_id).maybeSingle()
    if (!u?.attivo || u.livello_permessi === 'odv') return NextResponse.json({ error: 'Si autorizzano solo utenti attivi del gestionale' }, { status: 400 })
    const { error } = await supabaseAdmin.from('scadenze_bandi_deleghe_persone').insert({ delega_id: id, utente_id: b.utente_id, aggiunta_da: sessione.userId })
    if (error) return error.code === '23505' ? NextResponse.json({ error: 'La persona è già autorizzata' }, { status: 400 }) : erroreDatabase(error)
  } else if (b.azione === 'rimuovi_persona') {
    if (!UUID.test(String(b.riga_id || ''))) return NextResponse.json({ error: 'Riga non valida' }, { status: 400 })
    const { error } = await supabaseAdmin.from('scadenze_bandi_deleghe_persone')
      .update({ rimossa_il: new Date().toISOString(), rimossa_da: sessione.userId, rimossa_motivo: String(b.motivo || '').trim() || 'Non più autorizzata' })
      .eq('id', b.riga_id).eq('delega_id', id).is('rimossa_il', null)
    if (error) return erroreDatabase(error)
  } else {
    return NextResponse.json({ error: 'Azione non valida' }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
