import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { caricaDocumento231 } from '@/lib/drive231'
import { erroreDatabase } from '@/lib/praticaForm'

/**
 * Compenso del segnalatore: attestazione della prestazione, fattura,
 * autorizzazione dell'AU, pagamento. Le regole stanno nel database.
 */
export const maxDuration = 60
const DATA = /^\d{4}-\d{2}-\d{2}$/

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const { id } = await params
  const { data: c } = await supabaseAdmin.from('scadenze_bandi_compensi_segnalatori').select('*, scadenze_bandi_segnalatori(nome)').eq('id', id).maybeSingle()
  if (!c) return NextResponse.json({ error: 'Compenso non trovato' }, { status: 404 })
  const form = await request.formData()
  const t = (k: string) => String(form.get(k) ?? '').trim()
  const azione = t('azione')

  let aggiornamento: Record<string, unknown>
  if (azione === 'attesta') {
    const allegati = [...(c.attestazione_allegati || [])]
    try {
      for (const file of form.getAll('file')) {
        if (file instanceof File && file.size > 0) allegati.push(await caricaDocumento231('SEGNALATORI', file, `Prestazione_${c.scadenze_bandi_segnalatori?.nome || ''}`.slice(0, 40)))
      }
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Caricamento non riuscito' }, { status: 500 })
    }
    aggiornamento = { attestazione: t('attestazione'), attestazione_allegati: allegati, attestata_da: sessione.userId }
  } else if (azione === 'fattura') {
    const importo = Number(t('importo').replace(',', '.'))
    if (!Number.isFinite(importo) || importo < 0) return NextResponse.json({ error: 'Importo non valido' }, { status: 400 })
    if (!t('fattura_numero')) return NextResponse.json({ error: 'Indica il numero della fattura' }, { status: 400 })
    aggiornamento = { importo, fattura_numero: t('fattura_numero'), fattura_data: DATA.test(t('fattura_data')) ? t('fattura_data') : null }
  } else if (azione === 'autorizza') {
    aggiornamento = { autorizzato_da: sessione.userId }
  } else if (azione === 'pagato') {
    if (!DATA.test(t('pagato_il'))) return NextResponse.json({ error: 'Indica la data del pagamento' }, { status: 400 })
    aggiornamento = { pagato_il: t('pagato_il'), pagamento_riferimento: t('pagamento_riferimento') || null }
  } else {
    return NextResponse.json({ error: 'Azione non valida' }, { status: 400 })
  }
  const { error } = await supabaseAdmin.from('scadenze_bandi_compensi_segnalatori').update(aggiornamento).eq('id', id)
  if (error) return erroreDatabase(error)
  return NextResponse.json({ ok: true })
}
