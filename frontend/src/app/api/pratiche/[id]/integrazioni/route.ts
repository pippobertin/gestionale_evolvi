import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { datiPratica } from '@/lib/allegatiPratica'
import { allegatoDalModulo, campo, dataValida, erroreDatabase } from '@/lib/praticaForm'

/** Richiesta di integrazione dell'ente, con scadenza (PR.01 §4.2.5). */
export const maxDuration = 60

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const { id } = await params
  const form = await request.formData()
  const data_richiesta = campo(form, 'data_richiesta'), scadenza = campo(form, 'scadenza')
  const ente = campo(form, 'ente'), oggetto = campo(form, 'oggetto')
  if (!dataValida(data_richiesta) || !dataValida(scadenza)) return NextResponse.json({ error: 'Date non valide' }, { status: 400 })
  if (!ente || !oggetto) return NextResponse.json({ error: 'Ente e oggetto sono obbligatori' }, { status: 400 })

  const pratica = await datiPratica(id)
  if (!pratica) return NextResponse.json({ error: 'Pratica non trovata' }, { status: 404 })
  let allegato
  try { allegato = await allegatoDalModulo(form, 'file', id, 'INTEGRAZIONI', 'Richiesta_integrazione') }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Caricamento non riuscito' }, { status: 500 }) }

  const { data, error } = await supabaseAdmin.from('scadenze_bandi_integrazioni').insert({
    progetto_id: id, cliente_id: pratica.cliente_id, data_richiesta, scadenza, ente, oggetto,
    richiesta_file_id: allegato.id, richiesta_file_url: allegato.url, registrata_da: sessione.userId
  }).select('id').single()
  if (error) return erroreDatabase(error)
  return NextResponse.json({ ok: true, id: data.id })
}
