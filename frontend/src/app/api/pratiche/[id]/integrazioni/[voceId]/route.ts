import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { allegatoDalModulo, campo, dataValida, erroreDatabase } from '@/lib/praticaForm'

/**
 * Avanzamento della risposta a un'integrazione: preparata, verificata da una
 * seconda persona, inviata con ricevuta. Le regole le applica il database.
 */
export const maxDuration = 60

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; voceId: string }> }) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const { id, voceId } = await params
  const form = await request.formData()
  const azione = campo(form, 'azione')
  const ora = new Date().toISOString()
  let aggiornamento: Record<string, unknown>

  if (azione === 'preparata') {
    aggiornamento = { preparata_da: sessione.userId, preparata_il: ora }
  } else if (azione === 'verificata') {
    aggiornamento = { verificata_da: sessione.userId, verificata_il: ora }
  } else if (azione === 'inviata') {
    const data = campo(form, 'data')
    if (!dataValida(data)) return NextResponse.json({ error: 'Data non valida' }, { status: 400 })
    let ricevuta
    try { ricevuta = await allegatoDalModulo(form, 'file', id, 'INTEGRAZIONI', 'Ricevuta_integrazione') }
    catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Caricamento non riuscito' }, { status: 500 }) }
    aggiornamento = {
      data_invio: data, ricevuta_file_id: ricevuta.id, ricevuta_file_url: ricevuta.url,
      deroga: campo(form, 'deroga') || null
    }
  } else {
    return NextResponse.json({ error: 'Azione non valida' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('scadenze_bandi_integrazioni').update(aggiornamento).eq('id', voceId).eq('progetto_id', id)
  if (error) return erroreDatabase(error)
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string; voceId: string }> }) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const { id, voceId } = await params
  const { error } = await supabaseAdmin.from('scadenze_bandi_integrazioni').delete().eq('id', voceId).eq('progetto_id', id)
  if (error) return erroreDatabase(error)
  return NextResponse.json({ ok: true })
}
