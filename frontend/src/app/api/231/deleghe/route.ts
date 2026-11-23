import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { contesto231 } from '@/lib/registri231'
import { caricaDocumento231 } from '@/lib/drive231'
import { erroreDatabase } from '@/lib/praticaForm'
import { haPermesso } from '@/lib/permessi'

/**
 * Registro delle deleghe dei clienti (PR.03 §4.2): per cliente e piattaforma,
 * mandato, titolare dell'accesso, persone autorizzate, durata, revoca, riesame.
 * Nessuna password: le credenziali stanno nel password manager.
 */
export const maxDuration = 60
const UUID = /^[0-9a-fA-F-]{36}$/
const DATA = /^\d{4}-\d{2}-\d{2}$/
const TIPI = ['delega_piattaforma', 'mandato', 'procura']

export async function GET(request: NextRequest) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const clienteId = request.nextUrl.searchParams.get('cliente_id')
  let q = supabaseAdmin.from('scadenze_bandi_deleghe')
    .select('*, scadenze_bandi_clienti(denominazione), scadenze_bandi_deleghe_persone(*)')
    .order('created_at', { ascending: false })
  if (clienteId && UUID.test(clienteId)) q = q.eq('cliente_id', clienteId)
  const [ctx, { data, error }, puoGestire] = await Promise.all([
    contesto231(sessione.userId, sessione.livello_permessi),
    q,
    haPermesso(sessione.livello_permessi, 'deleghe.gestisci')
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  let clienti: unknown[] = []
  if (!ctx.solaLettura && !clienteId) {
    const { data: c } = await supabaseAdmin.from('scadenze_bandi_clienti').select('id, denominazione').order('denominazione')
    clienti = c || []
  }
  return NextResponse.json({ ...ctx, puoGestire: puoGestire && !ctx.solaLettura, deleghe: data || [], clienti })
}

export async function POST(request: NextRequest) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const form = await request.formData()
  const t = (k: string) => String(form.get(k) || '').trim()
  const d = (k: string) => (DATA.test(t(k)) ? t(k) : null)

  if (!UUID.test(t('cliente_id'))) return NextResponse.json({ error: 'Indica il cliente' }, { status: 400 })
  if (!t('piattaforma')) return NextResponse.json({ error: 'Indica la piattaforma' }, { status: 400 })
  if (!TIPI.includes(t('tipo'))) return NextResponse.json({ error: 'Tipo non valido' }, { status: 400 })
  let persone: string[] = []
  try { persone = (JSON.parse(t('persone') || '[]') as unknown[]).map(String).filter(x => UUID.test(x)) } catch { persone = [] }
  if (d('valida_dal') && d('valida_al') && d('valida_al')! < d('valida_dal')!) {
    return NextResponse.json({ error: 'La fine della validità precede l\'inizio' }, { status: 400 })
  }

  const allegati: { nome: string; id: string | null; url: string | null }[] = []
  try {
    for (const file of form.getAll('file')) {
      if (file instanceof File && file.size > 0) allegati.push(await caricaDocumento231('DELEGHE', file, t('piattaforma').slice(0, 40)))
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Caricamento non riuscito' }, { status: 500 })
  }

  const { data, error } = await supabaseAdmin.from('scadenze_bandi_deleghe').insert({
    cliente_id: t('cliente_id'), piattaforma: t('piattaforma'), ambito: t('ambito') || null, tipo: t('tipo'),
    titolare_id: UUID.test(t('titolare_id')) ? t('titolare_id') : null,
    titolare_esterno: UUID.test(t('titolare_id')) ? null : (t('titolare_esterno') || null),
    mandato_data: d('mandato_data'), valida_dal: d('valida_dal'), valida_al: d('valida_al'),
    allegati, nota: t('nota') || null, registrata_da: sessione.userId
  }).select('id').single()
  if (error) return erroreDatabase(error)
  if (persone.length) {
    const { error: e2 } = await supabaseAdmin.from('scadenze_bandi_deleghe_persone')
      .insert(Array.from(new Set(persone)).map(u => ({ delega_id: data.id, utente_id: u, aggiunta_da: sessione.userId })))
    if (e2) return erroreDatabase(e2)
  }
  return NextResponse.json({ ok: true, id: data.id })
}
