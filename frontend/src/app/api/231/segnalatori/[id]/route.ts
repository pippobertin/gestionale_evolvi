import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { caricaDocumento231 } from '@/lib/drive231'
import { erroreDatabase } from '@/lib/praticaForm'
import { oggiItalia } from '@/lib/accessoUtente'

/** Segnalatore: aggiornamento dei dati e dell'accordo, approvazione dell'AU, cessazione. */
export const maxDuration = 60
const UUID = /^[0-9a-fA-F-]{36}$/
const DATA = /^\d{4}-\d{2}-\d{2}$/

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const { id } = await params
  const { data: s } = await supabaseAdmin.from('scadenze_bandi_segnalatori').select('*').eq('id', id).maybeSingle()
  if (!s) return NextResponse.json({ error: 'Segnalatore non trovato' }, { status: 404 })
  const form = await request.formData()
  const t = (k: string) => String(form.get(k) ?? '').trim()
  const azione = t('azione')

  let aggiornamento: Record<string, unknown>
  if (azione === 'approva') {
    aggiornamento = { accordo_approvato_da: sessione.userId }
  } else if (azione === 'cessa') {
    aggiornamento = { cessato_il: DATA.test(t('data')) ? t('data') : oggiItalia() }
  } else if (azione === 'aggiorna') {
    const allegati = [...(s.accordo_allegati || [])]
    try {
      for (const file of form.getAll('file')) {
        if (file instanceof File && file.size > 0) allegati.push(await caricaDocumento231('SEGNALATORI', file, `Accordo_${s.nome}`.slice(0, 40)))
      }
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : 'Caricamento non riuscito' }, { status: 500 })
    }
    aggiornamento = {
      qualifica_id: UUID.test(t('qualifica_id')) ? t('qualifica_id') : null,
      accordo_data: DATA.test(t('accordo_data')) ? t('accordo_data') : null,
      accordo_scade_il: DATA.test(t('accordo_scade_il')) ? t('accordo_scade_il') : null,
      clausola_231: t('clausola_231') === 'true', compenso_previsto: t('compenso_previsto') || null,
      accordo_allegati: allegati, nota: t('nota') || null
    }
  } else {
    return NextResponse.json({ error: 'Azione non valida' }, { status: 400 })
  }
  const { error } = await supabaseAdmin.from('scadenze_bandi_segnalatori').update(aggiornamento).eq('id', id)
  if (error) return erroreDatabase(error)
  return NextResponse.json({ ok: true })
}
