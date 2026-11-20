import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { datiPratica } from '@/lib/allegatiPratica'
import { allegatoDalModulo, campo, dataValida, erroreDatabase } from '@/lib/praticaForm'

/**
 * Rettifica dopo l'invio (PR.01 §4.3.7): comunicazione formale all'ente
 * (portale o PEC). Il database la segnala all'OdV e all'AU nel registro.
 */
export const maxDuration = 60

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const { id } = await params
  const form = await request.formData()
  const data_rilevazione = campo(form, 'data_rilevazione'), errore = campo(form, 'errore'), modalita = campo(form, 'modalita')
  const data_rettifica = campo(form, 'data_rettifica')
  if (!dataValida(data_rilevazione)) return NextResponse.json({ error: 'Data non valida' }, { status: 400 })
  if (!errore) return NextResponse.json({ error: 'Descrivi l\'errore' }, { status: 400 })
  if (!['portale', 'pec'].includes(modalita)) return NextResponse.json({ error: 'Modalità non valida' }, { status: 400 })

  const pratica = await datiPratica(id)
  if (!pratica) return NextResponse.json({ error: 'Pratica non trovata' }, { status: 404 })
  let allegato
  try { allegato = await allegatoDalModulo(form, 'file', id, 'RETTIFICHE', 'Rettifica') }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Caricamento non riuscito' }, { status: 500 }) }

  const { error } = await supabaseAdmin.from('scadenze_bandi_rettifiche').insert({
    progetto_id: id, cliente_id: pratica.cliente_id, data_rilevazione, errore, modalita,
    data_rettifica: dataValida(data_rettifica) ? data_rettifica : null,
    allegato_file_id: allegato.id, allegato_file_url: allegato.url, registrata_da: sessione.userId
  })
  if (error) return erroreDatabase(error)
  return NextResponse.json({ ok: true })
}
