import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import {
  CATEGORIE_QUESTIONARIO_C,
  calcolaStatoPrecompilato,
} from '@/lib/formazione/fabbisognoMapping'

/**
 * API PUBBLICA — accesso tramite token, NIENTE verifyJWT.
 * La protezione e' affidata al token (256 bit) presente nell'URL.
 */

const STATI_MODIFICABILI = ['BOZZA', 'INVIATA', 'IN_COMPILAZIONE'] as const

const CAMPI_SCALARI = [
  'referente_nome',
  'referente_ruolo',
  'ateco_dichiarato',
  'ateco_descrizione_dichiarata',
  'ccnl_dichiarato',
  'numero_dipendenti_dichiarato',
  'popolazione_target',
  'popolazione_target_specifica',
  'piano_formazione_esistente',
  'obiettivi_strategici',
  'cambiamenti_previsti',
  'scadenze_imminenti',
  'altri_obblighi_settore',
  'aree_gap_competenze',
  'altri_fabbisogni',
  'livello_competenze_attuali',
  'figure_prioritarie',
  'modalita_erogazione',
  'budget_annuo',
  'vincoli_organizzativi',
  'picchi_operativita',
  'orizzonte_temporale',
  'strategicita_formazione',
  'misurazione_efficacia',
  'note_libere',
  'ultimo_step_visitato',
] as const

/**
 * GET — Recupera la rilevazione + dati di pre-compilazione + bozza in corso.
 * Alla prima apertura segna lo stato come IN_COMPILAZIONE e data_prima_apertura.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    const { data: ril, error: errRiv } = await supabase
      .from('scadenze_bandi_fabbisogno_rilevazioni')
      .select('*')
      .eq('token', token)
      .maybeSingle()

    if (errRiv || !ril) {
      return Response.json({ success: false, error: 'Link non valido' }, { status: 404 })
    }

    // Stati che bloccano accesso pubblico
    if (ril.stato === 'ARCHIVIATA') {
      return Response.json({ success: false, error: 'Link non valido' }, { status: 404 })
    }

    // Token scaduto
    if (ril.token_scadenza && new Date(ril.token_scadenza).getTime() < Date.now()) {
      return Response.json(
        {
          success: false,
          error: 'Il link e\' scaduto. Contatta il consulente per riceverne uno nuovo.',
        },
        { status: 410 }
      )
    }

    // Prima apertura: segna IN_COMPILAZIONE + data_prima_apertura
    let rilevazione = ril
    if (ril.stato === 'INVIATA' && !ril.data_prima_apertura) {
      const { data: updated } = await supabase
        .from('scadenze_bandi_fabbisogno_rilevazioni')
        .update({
          stato: 'IN_COMPILAZIONE',
          data_prima_apertura: new Date().toISOString(),
        })
        .eq('id', ril.id)
        .select()
        .single()

      if (updated) rilevazione = updated
    }

    // Carica figlie + cliente + adesione + certificazioni in parallelo
    const [popRes, insRes, obbRes, clienteRes, ccnlRes, certsRes] = await Promise.all([
      supabase
        .from('scadenze_bandi_fabbisogno_popolazione')
        .select('*')
        .eq('rilevazione_id', ril.id)
        .order('ordine'),
      supabase
        .from('scadenze_bandi_fabbisogno_inserimenti_previsti')
        .select('*')
        .eq('rilevazione_id', ril.id)
        .order('ordine'),
      supabase
        .from('scadenze_bandi_fabbisogno_obblighi_dichiarati')
        .select('*')
        .eq('rilevazione_id', ril.id),
      supabase
        .from('scadenze_bandi_clienti')
        .select('id, denominazione, partita_iva, ateco_2025, ateco_descrizione, numero_dipendenti, ula')
        .eq('id', ril.cliente_id)
        .maybeSingle(),
      supabase
        .from('scadenze_bandi_clienti_adesioni_fpi')
        .select('ccnl_applicato')
        .eq('cliente_id', ril.cliente_id)
        .eq('stato', 'ATTIVA')
        .limit(1)
        .maybeSingle(),
      supabase
        .from('scadenze_bandi_certificazioni_obbligatorie')
        .select('tipo_obbligo, data_scadenza')
        .eq('cliente_id', ril.cliente_id),
    ])

    const cliente = clienteRes.data
    const ccnlPrecompilato = ccnlRes.data?.ccnl_applicato ?? null

    // Pre-compilazione sezione C: per ogni categoria del questionario
    // calcola lo stato peggiore tra le certificazioni mappate
    const certs = certsRes.data || []
    const categorieObblighi = CATEGORIE_QUESTIONARIO_C.map(cat => ({
      id: cat.id,
      label: cat.label,
      tipo_obbligo: cat.rappresentante,
      stato_precompilato: calcolaStatoPrecompilato(cat, certs),
    }))

    return Response.json({
      success: true,
      data: {
        rilevazione: {
          ...rilevazione,
          popolazione: popRes.data || [],
          inserimenti_previsti: insRes.data || [],
          obblighi_dichiarati: obbRes.data || [],
        },
        cliente_precompilato: cliente
          ? {
              denominazione: cliente.denominazione,
              partita_iva: cliente.partita_iva,
              ateco: cliente.ateco_2025,
              ateco_descrizione: cliente.ateco_descrizione,
              ccnl: ccnlPrecompilato,
              numero_dipendenti: cliente.numero_dipendenti ?? cliente.ula ?? null,
            }
          : null,
        categorie_obblighi_c: categorieObblighi,
        readonly: rilevazione.stato === 'COMPLETATA',
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore'
    console.error('[API fabbisogno public] GET Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}

/**
 * PATCH — Autosave parziale durante la compilazione.
 * Body atteso (tutti i campi sono opzionali):
 *   { ...campi scalari della rilevazione,
 *     popolazione: [{area, numero_dipendenti, note, ordine}],
 *     inserimenti_previsti: [{area, numero_inserimenti, periodo, ordine}],
 *     obblighi_dichiarati: [{tipo_obbligo, stato_dichiarato, stato_precompilato, note}] }
 *
 * Per le tabelle figlie usa strategia "replace all": se nel body c'e' l'array,
 * cancella le righe esistenti e inserisce quelle nuove.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json().catch(() => ({}))

    const { data: ril, error: errRiv } = await supabase
      .from('scadenze_bandi_fabbisogno_rilevazioni')
      .select('id, stato, token_scadenza')
      .eq('token', token)
      .maybeSingle()

    if (errRiv || !ril) {
      return Response.json({ success: false, error: 'Link non valido' }, { status: 404 })
    }

    if (!STATI_MODIFICABILI.includes(ril.stato as typeof STATI_MODIFICABILI[number])) {
      return Response.json(
        { success: false, error: 'Questa rilevazione non e\' piu\' modificabile' },
        { status: 403 }
      )
    }

    if (ril.token_scadenza && new Date(ril.token_scadenza).getTime() < Date.now()) {
      return Response.json({ success: false, error: 'Il link e\' scaduto' }, { status: 410 })
    }

    // Aggiornamento dei campi scalari
    const updates: Record<string, unknown> = {
      data_ultima_modifica: new Date().toISOString(),
    }
    // Se il cliente sta modificando per la prima volta da stato INVIATA, passa a IN_COMPILAZIONE
    if (ril.stato === 'INVIATA') {
      updates.stato = 'IN_COMPILAZIONE'
    }
    for (const campo of CAMPI_SCALARI) {
      if (campo in body) {
        // Normalizza '' -> null: le colonne enum hanno CHECK (col IS NULL OR col IN (...))
        // e rifiuterebbero la stringa vuota, facendo fallire l'intera UPDATE.
        const val = body[campo]
        updates[campo] = val === '' ? null : val
      }
    }

    const { error: errUp } = await supabase
      .from('scadenze_bandi_fabbisogno_rilevazioni')
      .update(updates)
      .eq('id', ril.id)
    if (errUp) throw errUp

    // Tabelle figlie: replace all se presenti nel body
    if (Array.isArray(body.popolazione)) {
      await supabase
        .from('scadenze_bandi_fabbisogno_popolazione')
        .delete()
        .eq('rilevazione_id', ril.id)

      const righe = body.popolazione
        .map((r: Record<string, unknown>, idx: number) => ({
          rilevazione_id: ril.id,
          area: String(r.area ?? '').slice(0, 200),
          numero_dipendenti: typeof r.numero_dipendenti === 'number' ? r.numero_dipendenti : null,
          note: r.note ? String(r.note).slice(0, 500) : null,
          ordine: typeof r.ordine === 'number' ? r.ordine : idx,
        }))
        .filter((r: { area: string }) => r.area.length > 0)

      if (righe.length > 0) {
        await supabase.from('scadenze_bandi_fabbisogno_popolazione').insert(righe)
      }
    }

    if (Array.isArray(body.inserimenti_previsti)) {
      await supabase
        .from('scadenze_bandi_fabbisogno_inserimenti_previsti')
        .delete()
        .eq('rilevazione_id', ril.id)

      const righe = body.inserimenti_previsti
        .map((r: Record<string, unknown>, idx: number) => ({
          rilevazione_id: ril.id,
          area: String(r.area ?? '').slice(0, 200),
          numero_inserimenti: typeof r.numero_inserimenti === 'number' ? r.numero_inserimenti : null,
          periodo: r.periodo ? String(r.periodo).slice(0, 100) : null,
          ordine: typeof r.ordine === 'number' ? r.ordine : idx,
        }))
        .filter((r: { area: string }) => r.area.length > 0)

      if (righe.length > 0) {
        await supabase.from('scadenze_bandi_fabbisogno_inserimenti_previsti').insert(righe)
      }
    }

    if (Array.isArray(body.obblighi_dichiarati)) {
      await supabase
        .from('scadenze_bandi_fabbisogno_obblighi_dichiarati')
        .delete()
        .eq('rilevazione_id', ril.id)

      const righe = body.obblighi_dichiarati
        .map((r: Record<string, unknown>) => ({
          rilevazione_id: ril.id,
          tipo_obbligo: String(r.tipo_obbligo ?? ''),
          stato_dichiarato: String(r.stato_dichiarato ?? ''),
          stato_precompilato: r.stato_precompilato ? String(r.stato_precompilato) : null,
          note: r.note ? String(r.note).slice(0, 1000) : null,
        }))
        .filter((r: { tipo_obbligo: string; stato_dichiarato: string }) =>
          r.tipo_obbligo.length > 0 && r.stato_dichiarato.length > 0
        )

      if (righe.length > 0) {
        await supabase.from('scadenze_bandi_fabbisogno_obblighi_dichiarati').insert(righe)
      }
    }

    // Restituisce la rilevazione aggiornata con le figlie
    const [rilRes, popRes, insRes, obbRes] = await Promise.all([
      supabase
        .from('scadenze_bandi_fabbisogno_rilevazioni')
        .select('*')
        .eq('id', ril.id)
        .single(),
      supabase
        .from('scadenze_bandi_fabbisogno_popolazione')
        .select('*')
        .eq('rilevazione_id', ril.id)
        .order('ordine'),
      supabase
        .from('scadenze_bandi_fabbisogno_inserimenti_previsti')
        .select('*')
        .eq('rilevazione_id', ril.id)
        .order('ordine'),
      supabase
        .from('scadenze_bandi_fabbisogno_obblighi_dichiarati')
        .select('*')
        .eq('rilevazione_id', ril.id),
    ])

    return Response.json({
      success: true,
      data: {
        ...rilRes.data,
        popolazione: popRes.data || [],
        inserimenti_previsti: insRes.data || [],
        obblighi_dichiarati: obbRes.data || [],
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore nel salvataggio'
    console.error('[API fabbisogno public] PATCH Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
