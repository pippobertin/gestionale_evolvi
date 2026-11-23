import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { erroreDatabase } from '@/lib/praticaForm'

/** Segnalazione con compenso: si registra quando il segnalatore presenta il cliente. */
const UUID = /^[0-9a-fA-F-]{36}$/

export async function POST(request: NextRequest) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const b = await request.json().catch(() => ({}))
  if (!UUID.test(String(b.segnalatore_id || ''))) return NextResponse.json({ error: 'Indica il segnalatore' }, { status: 400 })
  const descrizione = String(b.descrizione || '').trim()
  if (!descrizione) return NextResponse.json({ error: 'Descrivi la segnalazione' }, { status: 400 })
  let clienteId = UUID.test(String(b.cliente_id || '')) ? String(b.cliente_id) : null
  const progettoId = UUID.test(String(b.progetto_id || '')) ? String(b.progetto_id) : null
  if (progettoId && !clienteId) {
    const { data } = await supabaseAdmin.from('scadenze_bandi_progetti').select('cliente_id').eq('id', progettoId).maybeSingle()
    clienteId = data?.cliente_id || null
  }
  const importo = b.importo === '' || b.importo === null || b.importo === undefined ? null : Number(b.importo)
  if (importo !== null && (!Number.isFinite(importo) || importo < 0)) return NextResponse.json({ error: 'Importo non valido' }, { status: 400 })
  const { error } = await supabaseAdmin.from('scadenze_bandi_compensi_segnalatori').insert({
    segnalatore_id: b.segnalatore_id, cliente_id: clienteId, progetto_id: progettoId,
    data_segnalazione: /^\d{4}-\d{2}-\d{2}$/.test(String(b.data_segnalazione || '')) ? b.data_segnalazione : null,
    descrizione, importo, base_calcolo: String(b.base_calcolo || '').trim() || null, registrato_da: sessione.userId
  })
  if (error) return erroreDatabase(error)
  return NextResponse.json({ ok: true })
}
