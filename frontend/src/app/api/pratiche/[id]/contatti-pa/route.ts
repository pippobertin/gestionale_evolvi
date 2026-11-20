import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { caricaAllegatoPratica, datiPratica } from '@/lib/allegatiPratica'

/**
 * Contatti rilevanti con la PA e gli enti (PR.02 §4.1): richieste formali di
 * chiarimento, modifica, proroga o variazione; comunicazioni su esiti, controlli
 * e rendicontazione; incontri. Non le telefonate solo informative sul bando.
 */
export const maxDuration = 60
const TIPI = ['richiesta_formale', 'comunicazione_esito', 'controllo', 'incontro', 'altro']

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const { id } = await params
  const form = await request.formData()
  const campo = (k: string) => String(form.get(k) || '').trim()

  const data = campo('data'), ente = campo('ente'), tipo = campo('tipo'), oggetto = campo('oggetto')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return NextResponse.json({ error: 'Data non valida' }, { status: 400 })
  if (!ente || !oggetto) return NextResponse.json({ error: 'Ente e oggetto sono obbligatori' }, { status: 400 })
  if (!TIPI.includes(tipo)) return NextResponse.json({ error: 'Tipo non valido' }, { status: 400 })

  const pratica = await datiPratica(id)
  if (!pratica) return NextResponse.json({ error: 'Pratica non trovata' }, { status: 404 })

  let allegato: { id: string | null; url: string | null } = { id: null, url: null }
  const file = form.get('file')
  if (file instanceof File && file.size > 0) {
    try {
      allegato = await caricaAllegatoPratica(id, file, 'CONTATTI CON GLI ENTI', 'Contatto')
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Caricamento non riuscito' }, { status: 500 })
    }
  }

  const { error } = await supabaseAdmin.from('scadenze_bandi_contatti_pa').insert({
    progetto_id: id, cliente_id: pratica.cliente_id, data, ente, tipo, oggetto,
    persona: campo('persona') || null, esito: campo('esito') || null,
    allegato_drive_id: allegato.id, allegato_url: allegato.url, registrato_da: sessione.userId
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
