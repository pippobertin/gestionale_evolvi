import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { caricaAllegatoPratica } from '@/lib/allegatiPratica'

/** Conferma dell'ordine di lavoro da parte del cliente: firma o email/PEC, con il documento ricevuto. */
export const maxDuration = 60

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; ordineId: string }> }) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const { id, ordineId } = await params
  const form = await request.formData()
  const file = form.get('file')
  const data = String(form.get('data') || '')
  const canale = String(form.get('canale') || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return NextResponse.json({ error: 'Data non valida' }, { status: 400 })
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'Allega l\'ordine firmato o l\'email di conferma del cliente' }, { status: 400 })
  }

  let allegato
  try {
    allegato = await caricaAllegatoPratica(id, file, 'CONTRATTI', 'Ordine_confermato')
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Caricamento non riuscito' }, { status: 500 })
  }

  const { error } = await supabaseAdmin.from('scadenze_bandi_ordini_lavoro').update({
    confermato: true,
    conferma_data: data,
    conferma_canale: canale || null,
    conferma_file_drive_id: allegato.id,
    conferma_file_url: allegato.url,
    confermato_registrato_da: sessione.userId,
    updated_at: new Date().toISOString()
  }).eq('id', ordineId).eq('progetto_id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
