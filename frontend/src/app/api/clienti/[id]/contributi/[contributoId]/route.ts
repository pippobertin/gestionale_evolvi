import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyJWT } from '@/lib/jwtAuth'
import {
  CAMPI_EREDITATI_DA_PROGETTO,
  isContributoForma,
  isContributoStato,
  type ContributoWithJoins,
} from '@/lib/contributi/types'
import {
  CONTRIBUTO_SELECT,
  PG_CODICI_ERRORE_CLIENT,
  ValidationError,
  parseAnno,
  parseData,
  parseNumero,
  parseTesto,
} from '@/lib/contributi/validation'

type Params = { params: Promise<{ id: string; contributoId: string }> }

const LIMITI_NUMERICI: Record<string, { min?: number; max?: number }> = {
  importo_progetto: { min: 0 },
  importo_contributo: { min: 0 },
  esl: { min: 0 },
  intensita_aiuto_pct: { min: 0, max: 100 },
}

async function caricaContributo(clienteId: string, contributoId: string) {
  return supabase
    .from('scadenze_bandi_contributi_ottenuti')
    .select(CONTRIBUTO_SELECT)
    .eq('id', contributoId)
    .eq('cliente_id', clienteId)
    .single<ContributoWithJoins>()
}

/**
 * GET — Dettaglio di un contributo, con join su bando e progetto.
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const auth = await verifyJWT(request)
    if (!auth) {
      return Response.json({ success: false, error: 'Non autorizzato' }, { status: 401 })
    }

    const { id: clienteId, contributoId } = await params
    const { data, error } = await caricaContributo(clienteId, contributoId)

    if (error) {
      if (error.code === 'PGRST116') {
        return Response.json({ success: false, error: 'Contributo non trovato' }, { status: 404 })
      }
      throw error
    }

    return Response.json({ success: true, data })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore nel recupero contributo'
    console.error('[API contributi] GET dettaglio Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}

/**
 * PATCH — Aggiornamento parziale. Vengono considerati solo i campi presenti nel body.
 * Su righe origine=DA_PROGETTO con progetto ancora esistente i campi ereditati
 * dal progetto (CAMPI_EREDITATI_DA_PROGETTO) vengono ignorati e restituiti in
 * `campi_ignorati`: si modificano dal progetto, la sync li sovrascriverebbe comunque.
 * Le righe orfane (progetto cancellato, progetto_id NULL) sono modificabili come
 * quelle MANUALI. cliente_id, progetto_id e origine non sono mai modificabili da qui.
 * Limiti numerici: importi ed ESL >= 0, intensità 0-100.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const auth = await verifyJWT(request)
    if (!auth) {
      return Response.json({ success: false, error: 'Non autorizzato' }, { status: 401 })
    }

    const { id: clienteId, contributoId } = await params
    const body = await request.json().catch(() => ({}))

    const { data: esistente, error: errE } = await caricaContributo(clienteId, contributoId)
    if (errE) {
      if (errE.code === 'PGRST116') {
        return Response.json({ success: false, error: 'Contributo non trovato' }, { status: 404 })
      }
      throw errE
    }

    // Bloccati solo se il progetto esiste ancora: le righe orfane (progetto
    // cancellato, progetto_id NULL) tornano completamente modificabili.
    const daProgetto = esistente.origine === 'DA_PROGETTO' && esistente.progetto_id !== null
    const bloccati: readonly string[] = daProgetto ? CAMPI_EREDITATI_DA_PROGETTO : []
    const campiIgnorati = Object.keys(body).filter(k => bloccati.includes(k))
    const presente = (campo: string) => campo in body && !bloccati.includes(campo)

    const updates: Record<string, unknown> = {}
    try {
      if (presente('anno_competenza')) updates.anno_competenza = parseAnno(body.anno_competenza)
      if (presente('bando_id')) updates.bando_id = parseTesto(body.bando_id)
      if (presente('bando_denominazione_manuale')) {
        updates.bando_denominazione_manuale = parseTesto(body.bando_denominazione_manuale)
      }
      if (presente('ente_erogatore')) updates.ente_erogatore = parseTesto(body.ente_erogatore)
      if (presente('forma_contributo')) {
        if (!isContributoForma(body.forma_contributo)) throw new ValidationError('forma_contributo non valida')
        updates.forma_contributo = body.forma_contributo
      }
      if (presente('stato')) {
        if (!isContributoStato(body.stato)) throw new ValidationError('stato non valido')
        updates.stato = body.stato
      }
      for (const [campo, limiti] of Object.entries(LIMITI_NUMERICI)) {
        if (presente(campo)) updates[campo] = parseNumero(body[campo], campo, limiti)
      }
      for (const campo of ['regime_aiuto', 'rna_codice_concessione', 'rna_url', 'note']) {
        if (presente(campo)) updates[campo] = parseTesto(body[campo])
      }
      for (const campo of ['data_concessione', 'data_erogazione']) {
        if (presente(campo)) updates[campo] = parseData(body[campo], campo)
      }

      // Stesso vincolo del CHECK chk_contributi_bando_presente, sul record risultante
      const bandoFinale = 'bando_id' in updates ? updates.bando_id : esistente.bando_id
      const denomFinale = 'bando_denominazione_manuale' in updates
        ? updates.bando_denominazione_manuale
        : esistente.bando_denominazione_manuale
      if (!bandoFinale && !denomFinale) {
        throw new ValidationError('Indicare un bando del catalogo o la denominazione del bando')
      }
    } catch (e) {
      if (e instanceof ValidationError) {
        return Response.json({ success: false, error: e.message }, { status: 400 })
      }
      throw e
    }

    if (Object.keys(updates).length === 0) {
      const error = campiIgnorati.length > 0
        ? `Contributo derivato dal progetto: i campi ${campiIgnorati.join(', ')} si modificano dal progetto`
        : 'Nessun campo da aggiornare'
      return Response.json({ success: false, error }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('scadenze_bandi_contributi_ottenuti')
      .update(updates)
      .eq('id', contributoId)
      .eq('cliente_id', clienteId)
      .select(CONTRIBUTO_SELECT)
      .single()

    if (error) {
      if (PG_CODICI_ERRORE_CLIENT.includes(error.code)) {
        return Response.json({ success: false, error: error.message }, { status: 400 })
      }
      throw error
    }

    return Response.json({ success: true, data, campi_ignorati: campiIgnorati })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore nell\'aggiornamento contributo'
    console.error('[API contributi] PATCH Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}

/**
 * DELETE — Elimina un contributo MANUALE.
 * I contributi DA_PROGETTO non si cancellano da qui: vanno eliminati dal progetto
 * (o azzerando il contributo nel progetto, la sync rimuove la riga).
 * Eccezione: riga DA_PROGETTO orfana (progetto già cancellato, progetto_id NULL).
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = await verifyJWT(request)
    if (!auth) {
      return Response.json({ success: false, error: 'Non autorizzato' }, { status: 401 })
    }

    const { id: clienteId, contributoId } = await params

    const { data: esistente, error: errE } = await caricaContributo(clienteId, contributoId)
    if (errE) {
      if (errE.code === 'PGRST116') {
        return Response.json({ success: false, error: 'Contributo non trovato' }, { status: 404 })
      }
      throw errE
    }

    if (esistente.origine === 'DA_PROGETTO' && esistente.progetto_id) {
      const rifProgetto = esistente.progetto?.codice_progetto
        || esistente.progetto?.titolo_progetto
        || esistente.progetto_id
      return Response.json(
        {
          success: false,
          error: `Impossibile cancellare: contributo derivato dal progetto ${rifProgetto}. Elimina il progetto o azzera il contributo nel progetto.`,
        },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('scadenze_bandi_contributi_ottenuti')
      .delete()
      .eq('id', contributoId)
      .eq('cliente_id', clienteId)

    if (error) throw error
    return Response.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore nella cancellazione contributo'
    console.error('[API contributi] DELETE Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
