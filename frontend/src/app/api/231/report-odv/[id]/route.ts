import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { erroreDatabase } from '@/lib/praticaForm'
import { caricaDocumento231 } from '@/lib/drive231'
import { applicaDati, datiAutomatici, type Sezioni } from '@/lib/reportOdv'
import { pdfReportOdv } from '@/lib/reportOdvPdf'
import { contesto231 } from '@/lib/registri231'

/**
 * Report all'OdV: salvataggio e conferma delle sezioni, aggiornamento dei dati
 * dai registri, invio dell'AU (PDF su Drive). Inviato, non cambia più.
 */
export const maxDuration = 60

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  if (sessione.livello_permessi === 'odv') return NextResponse.json({ error: 'Operazione non consentita' }, { status: 403 })
  const { id } = await params
  const { data: r } = await supabaseAdmin.from('scadenze_bandi_report_odv').select('*').eq('id', id).maybeSingle()
  if (!r) return NextResponse.json({ error: 'Report non trovato' }, { status: 404 })
  if (r.inviato_il) return NextResponse.json({ error: 'Il report è già stato inviato' }, { status: 400 })
  const b = await request.json().catch(() => ({}))
  const sezioni: Sezioni = r.sezioni
  const s = sezioni[String(b.chiave)]
  let aggiornamento: Record<string, unknown> = {}

  if (b.azione === 'salva_sezione' || b.azione === 'conferma') {
    if (!s) return NextResponse.json({ error: 'Sezione non valida' }, { status: 400 })
    if (s.confermata_il) return NextResponse.json({ error: 'La sezione è confermata: riaprila per modificarla' }, { status: 400 })
    const inviata = b.sezione || {}
    const voci = s.voci.map(v => {
      const n = (inviata.voci || []).find((x: any) => x.chiave === v.chiave) // eslint-disable-line @typescript-eslint/no-explicit-any
      if (!n) return v
      return { ...v, numero: v.auto ? v.numero : String(n.numero ?? '').slice(0, 50), nota: String(n.nota ?? '').slice(0, 3000) }
    })
    const nuova = { ...s, voci, nessuna_novita: inviata.nessuna_novita === undefined ? s.nessuna_novita : !!inviata.nessuna_novita, testo: inviata.testo === undefined ? s.testo : String(inviata.testo).slice(0, 5000) }
    if (b.azione === 'conferma') { nuova.confermata_da = sessione.userId; nuova.confermata_il = new Date().toISOString() }
    aggiornamento = { sezioni: { ...sezioni, [b.chiave]: nuova } }
  } else if (b.azione === 'riapri') {
    if (!s) return NextResponse.json({ error: 'Sezione non valida' }, { status: 400 })
    aggiornamento = { sezioni: { ...sezioni, [b.chiave]: { ...s, confermata_da: null, confermata_il: null } } }
  } else if (b.azione === 'aggiorna_dati') {
    aggiornamento = { sezioni: applicaDati(sezioni, await datiAutomatici(r.periodo_dal, r.periodo_al)), dati_aggiornati_il: new Date().toISOString() }
  } else if (b.azione === 'invia') {
    const ctx = await contesto231(sessione.userId, sessione.livello_permessi)
    if (!ctx.puoDecidere) return NextResponse.json({ error: 'Il report lo invia l\'AU' }, { status: 403 })
    const nonConfermate = Object.entries(sezioni).filter(([, x]) => !x.confermata_il).map(([k]) => k)
    if (nonConfermate.length) return NextResponse.json({ error: `Prima dell'invio vanno confermate le sezioni ${nonConfermate.join(', ')}` }, { status: 400 })
    const ora = new Date().toISOString()
    let pdf
    try {
      const buffer = await pdfReportOdv({ ...r, inviato_il: ora, inviatoDa: ctx.nomi[sessione.userId], nomi: ctx.nomi })
      const nome = `Report_OdV_${r.anno}_semestre_${r.semestre}.pdf`
      pdf = await caricaDocumento231('REPORT ODV', new File([new Uint8Array(buffer)], nome, { type: 'application/pdf' }), 'Inviato')
    } catch (e) {
      return NextResponse.json({ error: `PDF non salvato su Drive: ${e instanceof Error ? e.message : 'errore'}` }, { status: 500 })
    }
    aggiornamento = { inviato_il: ora, inviato_da: sessione.userId, pdf }
  } else {
    return NextResponse.json({ error: 'Azione non valida' }, { status: 400 })
  }
  const { error } = await supabaseAdmin.from('scadenze_bandi_report_odv').update(aggiornamento).eq('id', id)
  if (error) return erroreDatabase(error)
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  if (sessione.livello_permessi !== 'admin') return NextResponse.json({ error: 'Solo gli amministratori' }, { status: 403 })
  const { id } = await params
  const { error } = await supabaseAdmin.from('scadenze_bandi_report_odv').delete().eq('id', id).is('inviato_il', null)
  if (error) return erroreDatabase(error)
  return NextResponse.json({ ok: true })
}
