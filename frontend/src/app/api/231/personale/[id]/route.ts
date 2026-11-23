import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { caricaDocumento231 } from '@/lib/drive231'
import { erroreDatabase } from '@/lib/praticaForm'
import { oggiItalia } from '@/lib/accessoUtente'

/**
 * Checklist del personale: salvataggio delle voci, documento firmato,
 * rimozione dagli elenchi delle persone autorizzate, completamento.
 */
export const maxDuration = 60
const STATI = ['da_fare', 'fatto', 'non_dovuta']
type Voce = { chiave: string; etichetta: string; facoltativa?: boolean; stato: string; data: string | null; nota: string }

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  if (sessione.livello_permessi !== 'admin') return NextResponse.json({ error: 'Le checklist del personale le compilano gli amministratori' }, { status: 403 })
  const { id } = await params
  const { data: c } = await supabaseAdmin.from('scadenze_bandi_checklist_personale').select('*').eq('id', id).maybeSingle()
  if (!c) return NextResponse.json({ error: 'Checklist non trovata' }, { status: 404 })
  if (c.completata_il) return NextResponse.json({ error: 'La checklist è già completata' }, { status: 400 })

  const form = await request.formData()
  const azione = String(form.get('azione') || 'salva')

  if (azione === 'rimuovi_autorizzazioni') {
    if (!c.utente_id) return NextResponse.json({ error: 'La persona non ha un utente nel gestionale' }, { status: 400 })
    const { error } = await supabaseAdmin.from('scadenze_bandi_deleghe_persone')
      .update({ rimossa_il: new Date().toISOString(), rimossa_da: sessione.userId, rimossa_motivo: 'Uscita (checklist M.06)' })
      .eq('utente_id', c.utente_id).is('rimossa_il', null)
    if (error) return erroreDatabase(error)
    return NextResponse.json({ ok: true })
  }

  // Voci: si accettano solo stato, data e nota delle voci previste
  let voci: Voce[] = c.voci
  const inviate = form.get('voci')
  if (inviate) {
    let nuove: Partial<Voce>[] = []
    try { nuove = JSON.parse(String(inviate)) } catch { return NextResponse.json({ error: 'Voci non valide' }, { status: 400 }) }
    voci = (c.voci as Voce[]).map(v => {
      const n = nuove.find(x => x.chiave === v.chiave)
      if (!n) return v
      const stato = STATI.includes(String(n.stato)) && (n.stato !== 'non_dovuta' || v.facoltativa) ? String(n.stato) : v.stato
      return { ...v, stato, data: /^\d{4}-\d{2}-\d{2}$/.test(String(n.data || '')) ? String(n.data) : (stato === 'fatto' ? (v.data || oggiItalia()) : null), nota: String(n.nota ?? v.nota ?? '').slice(0, 500) }
    })
  }

  const allegati = [...(c.allegati || [])]
  try {
    for (const file of form.getAll('file')) {
      if (file instanceof File && file.size > 0) allegati.push(await caricaDocumento231('PERSONALE', file, `${c.tipo}_${c.persona}`.slice(0, 50)))
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Caricamento non riuscito' }, { status: 500 })
  }

  const aggiornamento: Record<string, unknown> = { voci, allegati }
  if (azione === 'completa') {
    const mancanti = voci.filter(v => v.stato === 'da_fare')
    if (mancanti.length) return NextResponse.json({ error: `Restano da fare: ${mancanti.map(v => v.etichetta).join('; ')}` }, { status: 400 })
    if (!allegati.length) return NextResponse.json({ error: 'Carica la checklist firmata dal responsabile' }, { status: 400 })
    if (c.tipo === 'uscita' && c.utente_id) {
      const { data: u } = await supabaseAdmin.from('scadenze_bandi_utenti').select('attivo, accesso_fino_al').eq('id', c.utente_id).maybeSingle()
      if (u?.attivo && !(u.accesso_fino_al && String(u.accesso_fino_al).slice(0, 10) <= oggiItalia())) {
        return NextResponse.json({ error: 'L\'accesso al gestionale è ancora attivo: disattiva l\'utente o fissa la fine dell\'accesso a oggi' }, { status: 400 })
      }
      await supabaseAdmin.from('scadenze_bandi_deleghe_persone')
        .update({ rimossa_il: new Date().toISOString(), rimossa_da: sessione.userId, rimossa_motivo: 'Uscita (checklist M.06)' })
        .eq('utente_id', c.utente_id).is('rimossa_il', null)
    }
    aggiornamento.completata_il = new Date().toISOString()
    aggiornamento.completata_da = sessione.userId
  }
  const { error } = await supabaseAdmin.from('scadenze_bandi_checklist_personale').update(aggiornamento).eq('id', id)
  if (error) return erroreDatabase(error)
  return NextResponse.json({ ok: true })
}
