import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { allegatoDalModulo, campo, dataValida, erroreDatabase } from '@/lib/praticaForm'

/**
 * Avanzamento di un rendiconto: dichiarazione del cliente sul cumulo,
 * checklist del responsabile e del revisore, firma, invio con ricevuta.
 * Le regole (chi compila cosa, requisiti dell'invio) le applica il database.
 */
export const maxDuration = 60

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; voceId: string }> }) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const { id, voceId } = await params
  const form = await request.formData()
  const azione = campo(form, 'azione')
  let aggiornamento: Record<string, unknown>

  try {
    if (azione === 'cumulo') {
      const data = campo(form, 'data')
      if (!dataValida(data)) return NextResponse.json({ error: 'Data non valida' }, { status: 400 })
      const file = await allegatoDalModulo(form, 'file', id, 'RENDICONTAZIONE', 'Dichiarazione_cumulo')
      if (!file.id && !file.url) return NextResponse.json({ error: 'Allega la dichiarazione del cliente' }, { status: 400 })
      aggiornamento = { cumulo_data: data, cumulo_file_id: file.id, cumulo_file_url: file.url }
    } else if (azione === 'checklist_rp' || azione === 'checklist_rev') {
      let voci: unknown
      try { voci = JSON.parse(campo(form, 'voci') || '[]') } catch { voci = null }
      if (!Array.isArray(voci) || voci.length === 0) return NextResponse.json({ error: 'Checklist vuota' }, { status: 400 })
      aggiornamento = { [azione]: voci }
    } else if (azione === 'firma') {
      const firmatario = campo(form, 'firmatario')
      if (!['cliente', 'delegato_blm'].includes(firmatario)) return NextResponse.json({ error: 'Firmatario non valido' }, { status: 400 })
      aggiornamento = { firmatario, au_informata: campo(form, 'au_informata') === 'true' }
      if (firmatario === 'delegato_blm') {
        const delega = await allegatoDalModulo(form, 'file', id, 'RENDICONTAZIONE', 'Delega_rendiconto')
        if (delega.id || delega.url) Object.assign(aggiornamento, { delega_file_id: delega.id, delega_file_url: delega.url })
      }
    } else if (azione === 'inviato') {
      const data = campo(form, 'data')
      if (!dataValida(data)) return NextResponse.json({ error: 'Data non valida' }, { status: 400 })
      const ricevuta = await allegatoDalModulo(form, 'file', id, 'RENDICONTAZIONE', 'Ricevuta_rendiconto')
      aggiornamento = { data_invio: data, ricevuta_file_id: ricevuta.id, ricevuta_file_url: ricevuta.url, deroga: campo(form, 'deroga') || null }
    } else {
      return NextResponse.json({ error: 'Azione non valida' }, { status: 400 })
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Caricamento non riuscito' }, { status: 500 })
  }

  const { error } = await supabaseAdmin.from('scadenze_bandi_rendiconti').update(aggiornamento).eq('id', voceId).eq('progetto_id', id)
  if (error) return erroreDatabase(error)
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; voceId: string }> }) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const { id, voceId } = await params
  const { error } = await supabaseAdmin.from('scadenze_bandi_rendiconti').delete().eq('id', voceId).eq('progetto_id', id)
  if (error) return erroreDatabase(error)
  return NextResponse.json({ ok: true })
}
