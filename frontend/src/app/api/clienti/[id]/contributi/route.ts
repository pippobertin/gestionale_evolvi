import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyJWT } from '@/lib/jwtAuth'
import { isContributoForma, isContributoStato } from '@/lib/contributi/types'
import {
  CONTRIBUTO_SELECT,
  PG_CODICI_ERRORE_CLIENT,
  ValidationError,
  parseAnno,
  parseData,
  parseNumero,
  parseTesto,
} from '@/lib/contributi/validation'

/**
 * GET — Lista contributi ottenuti da un cliente, con join su bando e progetto.
 * Ordinamento: anno_competenza DESC, data_concessione DESC NULLS LAST, created_at DESC.
 * Query string supportata:
 *   ?anno=2024
 *   ?forma=FONDO_PERDUTO|CREDITO_IMPOSTA|...
 *   ?stato=AMMESSO|CONCESSO|...
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyJWT(request)
    if (!auth) {
      return Response.json({ success: false, error: 'Non autorizzato' }, { status: 401 })
    }

    const { id: clienteId } = await params
    const { searchParams } = new URL(request.url)
    const anno = searchParams.get('anno')
    const forma = searchParams.get('forma')
    const stato = searchParams.get('stato')

    let query = supabase
      .from('scadenze_bandi_contributi_ottenuti')
      .select(CONTRIBUTO_SELECT)
      .eq('cliente_id', clienteId)
      .order('anno_competenza', { ascending: false })
      .order('data_concessione', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (anno) {
      const annoNum = Number(anno)
      if (!Number.isInteger(annoNum)) {
        return Response.json({ success: false, error: 'Parametro anno non valido' }, { status: 400 })
      }
      query = query.eq('anno_competenza', annoNum)
    }
    if (forma) {
      if (!isContributoForma(forma)) {
        return Response.json({ success: false, error: 'Parametro forma non valido' }, { status: 400 })
      }
      query = query.eq('forma_contributo', forma)
    }
    if (stato) {
      if (!isContributoStato(stato)) {
        return Response.json({ success: false, error: 'Parametro stato non valido' }, { status: 400 })
      }
      query = query.eq('stato', stato)
    }

    const { data, error } = await query
    if (error) throw error

    return Response.json({ success: true, data: data || [] })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore nel recupero contributi'
    console.error('[API contributi] GET Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}

/**
 * POST — Crea un contributo manuale (origine MANUALE, nessun progetto collegato).
 * Body:
 *   anno_competenza (obbligatorio, 1990-2100)
 *   bando_id | bando_denominazione_manuale (almeno uno)
 *   forma_contributo (default FONDO_PERDUTO), stato (default AMMESSO)
 *   ente_erogatore, importo_progetto, importo_contributo, esl,
 *   intensita_aiuto_pct, regime_aiuto, rna_codice_concessione, rna_url,
 *   data_concessione, data_erogazione, note
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyJWT(request)
    if (!auth) {
      return Response.json({ success: false, error: 'Non autorizzato' }, { status: 401 })
    }

    const { id: clienteId } = await params
    const body = await request.json().catch(() => ({}))

    let record: Record<string, unknown>
    try {
      const forma = body.forma_contributo ?? 'FONDO_PERDUTO'
      if (!isContributoForma(forma)) throw new ValidationError('forma_contributo non valida')

      const stato = body.stato ?? 'AMMESSO'
      if (!isContributoStato(stato)) throw new ValidationError('stato non valido')

      const bandoId = parseTesto(body.bando_id)
      const bandoDenom = parseTesto(body.bando_denominazione_manuale)
      if (!bandoId && !bandoDenom) {
        throw new ValidationError('Indicare un bando del catalogo o la denominazione del bando')
      }

      record = {
        cliente_id: clienteId,
        progetto_id: null,
        anno_competenza: parseAnno(body.anno_competenza),
        bando_id: bandoId,
        bando_denominazione_manuale: bandoDenom,
        ente_erogatore: parseTesto(body.ente_erogatore),
        forma_contributo: forma,
        importo_progetto: parseNumero(body.importo_progetto, 'importo_progetto', { min: 0 }),
        importo_contributo: parseNumero(body.importo_contributo, 'importo_contributo', { min: 0 }),
        esl: parseNumero(body.esl, 'esl', { min: 0 }),
        intensita_aiuto_pct: parseNumero(body.intensita_aiuto_pct, 'intensita_aiuto_pct', { min: 0, max: 100 }),
        regime_aiuto: parseTesto(body.regime_aiuto),
        rna_codice_concessione: parseTesto(body.rna_codice_concessione),
        rna_url: parseTesto(body.rna_url),
        data_concessione: parseData(body.data_concessione, 'data_concessione'),
        data_erogazione: parseData(body.data_erogazione, 'data_erogazione'),
        stato,
        note: parseTesto(body.note),
        origine: 'MANUALE',
        created_by_user_id: auth.userId,
      }
    } catch (e) {
      if (e instanceof ValidationError) {
        return Response.json({ success: false, error: e.message }, { status: 400 })
      }
      throw e
    }

    const { data, error } = await supabase
      .from('scadenze_bandi_contributi_ottenuti')
      .insert(record)
      .select(CONTRIBUTO_SELECT)
      .single()

    if (error) {
      if (PG_CODICI_ERRORE_CLIENT.includes(error.code)) {
        return Response.json({ success: false, error: error.message }, { status: 400 })
      }
      throw error
    }

    return Response.json({ success: true, data })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore nella creazione contributo'
    console.error('[API contributi] POST Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
