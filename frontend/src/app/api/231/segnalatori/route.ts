import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { contesto231 } from '@/lib/registri231'
import { caricaDocumento231 } from '@/lib/drive231'
import { erroreDatabase } from '@/lib/praticaForm'
import { haPermesso } from '@/lib/permessi'

/**
 * Segnalatori e compensi (PR.02 §4.3, gap G12). Li vedono amministratori, OdV e
 * chi ha il permesso "Gestire segnalatori e compensi".
 */
export const maxDuration = 60
const UUID = /^[0-9a-fA-F-]{36}$/
const DATA = /^\d{4}-\d{2}-\d{2}$/

export async function GET(request: NextRequest) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const ruolo = sessione.livello_permessi
  const puoGestire = await haPermesso(ruolo, 'segnalatori.gestisci')
  if (!puoGestire && ruolo !== 'odv') return NextResponse.json({ error: 'Segnalatori e compensi sono visibili agli amministratori e a chi ha il permesso dedicato' }, { status: 403 })
  const [ctx, { data: segnalatori, error }, { data: compensi, error: e2 }] = await Promise.all([
    contesto231(sessione.userId, ruolo),
    supabaseAdmin.from('scadenze_bandi_segnalatori')
      .select('*, scadenze_bandi_qualifiche(id, denominazione, esito, decisione, scade_il, compilata_il)').order('nome'),
    supabaseAdmin.from('scadenze_bandi_compensi_segnalatori')
      .select('*, scadenze_bandi_clienti(denominazione), scadenze_bandi_progetti(titolo_progetto)').order('created_at', { ascending: false })
  ])
  if (error || e2) return NextResponse.json({ error: (error || e2)!.message }, { status: 500 })
  let qualifiche: unknown[] = [], clienti: unknown[] = [], progetti: unknown[] = []
  if (!ctx.solaLettura) {
    const [q, c, p] = await Promise.all([
      supabaseAdmin.from('scadenze_bandi_qualifiche').select('id, denominazione, esito, decisione, compilata_il').in('soggetto_tipo', ['segnalatore', 'consulente', 'partner']).order('compilata_il', { ascending: false }),
      supabaseAdmin.from('scadenze_bandi_clienti').select('id, denominazione').order('denominazione'),
      supabaseAdmin.from('scadenze_bandi_progetti').select('id, titolo_progetto, cliente_id').order('created_at', { ascending: false })
    ])
    qualifiche = q.data || []; clienti = c.data || []; progetti = p.data || []
  }
  return NextResponse.json({ ...ctx, puoGestire: puoGestire && !ctx.solaLettura, segnalatori: segnalatori || [], compensi: compensi || [], qualifiche, clienti, progetti })
}

export async function POST(request: NextRequest) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const form = await request.formData()
  const t = (k: string) => String(form.get(k) || '').trim()
  if (!t('nome')) return NextResponse.json({ error: 'Indica il segnalatore' }, { status: 400 })
  const allegati: { nome: string; id: string | null; url: string | null }[] = []
  try {
    for (const file of form.getAll('file')) {
      if (file instanceof File && file.size > 0) allegati.push(await caricaDocumento231('SEGNALATORI', file, `Accordo_${t('nome')}`.slice(0, 40)))
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Caricamento non riuscito' }, { status: 500 })
  }
  const { data, error } = await supabaseAdmin.from('scadenze_bandi_segnalatori').insert({
    nome: t('nome'), forma: t('forma') === 'societa' ? 'societa' : 'persona',
    cliente_id: UUID.test(t('cliente_id')) ? t('cliente_id') : null,
    codice_fiscale: t('codice_fiscale') || null, partita_iva: t('partita_iva') || null, email: t('email') || null,
    qualifica_id: UUID.test(t('qualifica_id')) ? t('qualifica_id') : null,
    accordo_data: DATA.test(t('accordo_data')) ? t('accordo_data') : null,
    accordo_scade_il: DATA.test(t('accordo_scade_il')) ? t('accordo_scade_il') : null,
    clausola_231: t('clausola_231') === 'true', compenso_previsto: t('compenso_previsto') || null,
    accordo_allegati: allegati, nota: t('nota') || null, registrato_da: sessione.userId
  }).select('id').single()
  if (error) return erroreDatabase(error)
  return NextResponse.json({ ok: true, id: data.id })
}
