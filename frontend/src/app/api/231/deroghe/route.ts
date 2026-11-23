import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { contesto231 } from '@/lib/registri231'
import { caricaDocumento231 } from '@/lib/drive231'
import { erroreDatabase } from '@/lib/praticaForm'

/**
 * Registro delle deroghe (PR.01 §4.1, PR.02 §4.3). Unisce le deroghe chieste
 * qui e decise dall'AU con quelle già registrate dal gestionale durante il
 * lavoro: approvazione dei contratti, passaggi di fase, integrazioni, rendiconti.
 */
export const maxDuration = 60
const UUID = /^[0-9a-fA-F-]{36}$/
const AMBITI = ['contratto', 'pagamento', 'procedura', 'altro']

export async function GET(request: NextRequest) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const [ctx, deroghe, contratti, passaggi, integrazioni, rendiconti] = await Promise.all([
    contesto231(sessione.userId, sessione.livello_permessi),
    supabaseAdmin.from('scadenze_bandi_deroghe').select('*, scadenze_bandi_clienti(denominazione), scadenze_bandi_progetti(titolo_progetto)').order('data', { ascending: false }),
    supabaseAdmin.from('scadenze_bandi_contract_tracking').select('id, entity_type, approvato_da, approvato_il, deroga_approvazione, scadenze_bandi_clienti(denominazione)').not('deroga_approvazione', 'is', null),
    supabaseAdmin.from('scadenze_bandi_pratica_passaggi').select('id, da_fase, a_fase, utente_id, deroga, mancanti, quando, scadenze_bandi_progetti(titolo_progetto)').not('deroga', 'is', null),
    supabaseAdmin.from('scadenze_bandi_integrazioni').select('id, oggetto, data_invio, deroga, scadenze_bandi_progetti(titolo_progetto)').not('deroga', 'is', null),
    supabaseAdmin.from('scadenze_bandi_rendiconti').select('id, descrizione, data_invio, deroga, scadenze_bandi_progetti(titolo_progetto)').not('deroga', 'is', null)
  ])
  if (deroghe.error) return NextResponse.json({ error: deroghe.error.message }, { status: 500 })

  const nome = (x: any) => (Array.isArray(x) ? x[0] : x) || {}
  const automatiche = [
    ...(contratti.data || []).map((r: any) => ({
      id: `c-${r.id}`, data: r.approvato_il, fonte: 'Approvazione di un contratto',
      oggetto: `Contratto ${r.entity_type === 'PROGETTO' ? 'di progetto' : 'Evolvi'} approvato da chi aveva generato la bozza`,
      riferimento: nome(r.scadenze_bandi_clienti).denominazione || '', motivazione: r.deroga_approvazione, chi: r.approvato_da || ''
    })),
    ...(passaggi.data || []).map((r: any) => ({
      id: `f-${r.id}`, data: r.quando, fonte: 'Passaggio di fase della pratica',
      oggetto: `Da ${r.da_fase || '?'} a ${r.a_fase}${r.mancanti?.length ? ` senza: ${r.mancanti.join(', ')}` : ''}`,
      riferimento: nome(r.scadenze_bandi_progetti).titolo_progetto || '', motivazione: r.deroga, chi: ctx.nomi[r.utente_id] || ''
    })),
    ...(integrazioni.data || []).map((r: any) => ({
      id: `i-${r.id}`, data: r.data_invio, fonte: 'Integrazione inviata',
      oggetto: r.oggetto || 'Integrazione', riferimento: nome(r.scadenze_bandi_progetti).titolo_progetto || '', motivazione: r.deroga, chi: ''
    })),
    ...(rendiconti.data || []).map((r: any) => ({
      id: `r-${r.id}`, data: r.data_invio, fonte: 'Rendiconto inviato',
      oggetto: r.descrizione || 'Rendiconto', riferimento: nome(r.scadenze_bandi_progetti).titolo_progetto || '', motivazione: r.deroga, chi: ''
    }))
  ].sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')))

  let clienti: unknown[] = [], progetti: unknown[] = []
  if (!ctx.solaLettura) {
    const [c, p] = await Promise.all([
      supabaseAdmin.from('scadenze_bandi_clienti').select('id, denominazione').order('denominazione'),
      supabaseAdmin.from('scadenze_bandi_progetti').select('id, titolo_progetto, cliente_id').order('created_at', { ascending: false })
    ])
    clienti = c.data || []; progetti = p.data || []
  }
  return NextResponse.json({ ...ctx, deroghe: deroghe.data || [], automatiche, clienti, progetti })
}

export async function POST(request: NextRequest) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  if (sessione.livello_permessi === 'odv') return NextResponse.json({ error: 'Operazione non consentita' }, { status: 403 })
  const form = await request.formData()
  const t = (k: string) => String(form.get(k) || '').trim()
  if (!AMBITI.includes(t('ambito'))) return NextResponse.json({ error: 'Ambito non valido' }, { status: 400 })
  if (!t('oggetto') || !t('motivazione')) return NextResponse.json({ error: 'Indica oggetto e motivazione della deroga' }, { status: 400 })
  let clienteId = UUID.test(t('cliente_id')) ? t('cliente_id') : null
  const progettoId = UUID.test(t('progetto_id')) ? t('progetto_id') : null
  if (progettoId && !clienteId) {
    const { data } = await supabaseAdmin.from('scadenze_bandi_progetti').select('cliente_id').eq('id', progettoId).maybeSingle()
    clienteId = data?.cliente_id || null
  }
  const allegati: { nome: string; id: string | null; url: string | null }[] = []
  try {
    for (const file of form.getAll('file')) {
      if (file instanceof File && file.size > 0) allegati.push(await caricaDocumento231('DEROGHE', file, t('oggetto').slice(0, 40)))
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Caricamento non riuscito' }, { status: 500 })
  }
  const { error } = await supabaseAdmin.from('scadenze_bandi_deroghe').insert({
    data: /^\d{4}-\d{2}-\d{2}$/.test(t('data')) ? t('data') : undefined,
    ambito: t('ambito'), oggetto: t('oggetto'), regola: t('regola') || null, motivazione: t('motivazione'),
    cliente_id: clienteId, progetto_id: progettoId, allegati, richiesta_da: sessione.userId
  })
  if (error) return erroreDatabase(error)
  return NextResponse.json({ ok: true })
}
