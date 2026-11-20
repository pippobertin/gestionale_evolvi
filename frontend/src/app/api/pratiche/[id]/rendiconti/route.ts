import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { datiPratica } from '@/lib/allegatiPratica'
import { campo, dataValida, erroreDatabase } from '@/lib/praticaForm'

/** Nuovo rendiconto (anticipo, SAL, saldo) con la sua scadenza (PR.01 §4.3). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const { id } = await params
  const form = await request.formData()
  const descrizione = campo(form, 'descrizione'), scadenza = campo(form, 'scadenza')
  if (!descrizione || !dataValida(scadenza)) return NextResponse.json({ error: 'Descrizione e scadenza sono obbligatorie' }, { status: 400 })
  const pratica = await datiPratica(id)
  if (!pratica) return NextResponse.json({ error: 'Pratica non trovata' }, { status: 404 })
  const { data, error } = await supabaseAdmin.from('scadenze_bandi_rendiconti').insert({
    progetto_id: id, cliente_id: pratica.cliente_id, descrizione, scadenza, registrato_da: sessione.userId
  }).select('id').single()
  if (error) return erroreDatabase(error)
  return NextResponse.json({ ok: true, id: data.id })
}
