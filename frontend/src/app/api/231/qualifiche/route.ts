import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { contesto231 } from '@/lib/registri231'
import { caricaDocumento231 } from '@/lib/drive231'
import { erroreDatabase } from '@/lib/praticaForm'

/** Qualifica delle controparti (modulo M.01). */
export const maxDuration = 60
const TIPI = ['cliente', 'partner', 'fornitore', 'consulente', 'segnalatore']

export async function GET(request: NextRequest) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const [ctx, { data: schede, error }, { data: voci }, { data: clienti }] = await Promise.all([
    contesto231(sessione.userId, sessione.livello_permessi),
    supabaseAdmin.from('scadenze_bandi_qualifiche').select('*').order('compilata_il', { ascending: false }),
    supabaseAdmin.from('scadenze_bandi_checklist_voci').select('tipo, chiave, etichetta, ordine').in('tipo', ['qualifica_societa', 'qualifica_persona']).eq('attiva', true).order('ordine'),
    supabaseAdmin.from('scadenze_bandi_clienti').select('id, denominazione, partita_iva, codice_fiscale').order('denominazione')
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ...ctx, schede: schede || [], voci: voci || [], clienti: ctx.solaLettura ? [] : (clienti || []) })
}

export async function POST(request: NextRequest) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const form = await request.formData()
  const t = (k: string) => String(form.get(k) || '').trim()

  const soggetto_tipo = t('soggetto_tipo'), forma = t('forma'), denominazione = t('denominazione'), esito = t('esito')
  if (!TIPI.includes(soggetto_tipo) || !['societa', 'persona'].includes(forma)) return NextResponse.json({ error: 'Tipo non valido' }, { status: 400 })
  if (!denominazione) return NextResponse.json({ error: 'Indica la controparte' }, { status: 400 })
  if (!['nessuna_anomalia', 'anomalia'].includes(esito)) return NextResponse.json({ error: 'Indica l\'esito' }, { status: 400 })
  if (esito === 'anomalia' && !t('anomalia')) return NextResponse.json({ error: 'Descrivi l\'anomalia' }, { status: 400 })
  let verifiche: unknown
  try { verifiche = JSON.parse(t('verifiche') || '[]') } catch { verifiche = null }
  if (!Array.isArray(verifiche)) return NextResponse.json({ error: 'Verifiche non valide' }, { status: 400 })

  const allegati: { nome: string; id: string | null; url: string | null }[] = []
  try {
    for (const file of form.getAll('file')) {
      if (file instanceof File && file.size > 0) allegati.push(await caricaDocumento231('QUALIFICHE', file, denominazione.slice(0, 40)))
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Caricamento non riuscito' }, { status: 500 })
  }

  const continuativo = t('continuativo') === 'true'
  const compilata = new Date()
  const scadenza = new Date(compilata); scadenza.setFullYear(scadenza.getFullYear() + 1)
  const { data, error } = await supabaseAdmin.from('scadenze_bandi_qualifiche').insert({
    soggetto_tipo, forma, denominazione,
    cliente_id: /^[0-9a-fA-F-]{36}$/.test(t('cliente_id')) ? t('cliente_id') : null,
    codice_fiscale: t('codice_fiscale') || null, partita_iva: t('partita_iva') || null,
    continuativo, verifiche, allegati, esito, anomalia: t('anomalia') || null,
    compilata_da: sessione.userId, scade_il: continuativo ? scadenza.toISOString().slice(0, 10) : null
  }).select('id').single()
  if (error) return erroreDatabase(error)
  if (soggetto_tipo === 'segnalatore') await collegaSegnalatore(data.id, sessione.userId, { denominazione, forma, cf: t('codice_fiscale'), piva: t('partita_iva') })
  return NextResponse.json({ ok: true, id: data.id })
}

/**
 * La scheda di un segnalatore compare da sola in "Segnalatori e compensi": se il
 * segnalatore c'è già (stessa partita IVA, codice fiscale o nome) la nuova scheda
 * ne aggiorna la qualifica, altrimenti lo crea. L'accordo si aggiunge da lì.
 */
async function collegaSegnalatore(qualificaId: string, utenteId: string, d: { denominazione: string; forma: string; cf: string; piva: string }) {
  const { data: esistenti } = await supabaseAdmin.from('scadenze_bandi_segnalatori').select('id, nome, partita_iva, codice_fiscale')
  const norm = (x?: string | null) => (x || '').replace(/\s+/g, '').toLowerCase()
  const trovato = (esistenti || []).find(s =>
    (d.piva && norm(s.partita_iva) === norm(d.piva)) || (d.cf && norm(s.codice_fiscale) === norm(d.cf)) ||
    s.nome.trim().toLowerCase() === d.denominazione.trim().toLowerCase())
  if (trovato) {
    await supabaseAdmin.from('scadenze_bandi_segnalatori').update({ qualifica_id: qualificaId }).eq('id', trovato.id)
  } else {
    await supabaseAdmin.from('scadenze_bandi_segnalatori').insert({
      nome: d.denominazione, forma: d.forma === 'societa' ? 'societa' : 'persona',
      codice_fiscale: d.cf || null, partita_iva: d.piva || null, qualifica_id: qualificaId, registrato_da: utenteId
    })
  }
}
