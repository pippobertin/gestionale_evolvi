import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { caricaAllegatoPratica } from '@/lib/allegatiPratica'

/**
 * Verifiche della pratica (PR.01 §4.2): checklist pre-invio del REV (solo il
 * REV, controllato dal database), conferma scritta del cliente sulla versione
 * finale, delega, ricevuta di invio. I documenti vanno nella cartella INVIO
 * DOMANDA del progetto su Drive.
 */
export const maxDuration = 60
const TIPI = ['checklist_preinvio', 'conferma_cliente', 'delega', 'ricevuta_invio']
const PREFISSI: Record<string, string> = {
  conferma_cliente: 'Conferma_cliente', delega: 'Delega', ricevuta_invio: 'Ricevuta_invio', checklist_preinvio: 'Checklist'
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const { id } = await params
  const form = await request.formData()
  const tipo = String(form.get('tipo') || '')
  if (!TIPI.includes(tipo)) return NextResponse.json({ error: 'Tipo non valido' }, { status: 400 })

  const data = String(form.get('data') || new Date().toISOString().slice(0, 10))
  let voci: unknown = null
  if (tipo === 'checklist_preinvio') {
    try { voci = JSON.parse(String(form.get('voci') || '[]')) } catch { voci = null }
    if (!Array.isArray(voci) || voci.length === 0) return NextResponse.json({ error: 'Checklist vuota' }, { status: 400 })
  }

  const file = form.get('file')
  if (tipo !== 'checklist_preinvio' && !(file instanceof File && file.size > 0)) {
    return NextResponse.json({ error: 'Allega il documento (email, delega o ricevuta)' }, { status: 400 })
  }

  let allegato: { id: string | null; url: string | null } = { id: null, url: null }
  if (file instanceof File && file.size > 0) {
    try {
      allegato = await caricaAllegatoPratica(id, file, 'INVIO DOMANDA', PREFISSI[tipo])
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Caricamento non riuscito' }, { status: 500 })
    }
  }

  const { error } = await supabaseAdmin.from('scadenze_bandi_pratica_verifiche').insert({
    progetto_id: id, tipo, voci, data,
    vale_anche_come_delega: tipo === 'conferma_cliente' && form.get('vale_anche_come_delega') === 'true',
    note: String(form.get('note') || '').slice(0, 2000) || null,
    file_drive_id: allegato.id, file_url: allegato.url, eseguito_da: sessione.userId
  })
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === '42501' ? 403 : 400 })
  return NextResponse.json({ ok: true })
}
