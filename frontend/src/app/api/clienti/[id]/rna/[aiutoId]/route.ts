/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyJWT } from '@/lib/jwtAuth'
import { isContributoForma, isContributoStato } from '@/lib/contributi/types'
import { regimeDaRegolamenti } from '@/lib/rna/importer'

type Params = { params: Promise<{ id: string; aiutoId: string }> }

const errMsg = (e: unknown, def: string) =>
  e instanceof Error ? e.message : (e as any)?.message || def

async function caricaAiuto(clienteId: string, aiutoId: string) {
  return supabase.from('scadenze_bandi_rna_aiuti')
    .select('*')
    .eq('id', aiutoId)
    .eq('cliente_id', clienteId)
    .maybeSingle()
}

/** Campi che l'aiuto RNA può compilare in un contributo esistente (solo se vuoti). */
function campiDaCompletare(a: any, c: any): Record<string, unknown> {
  const agg: Record<string, unknown> = {}
  if (!c.rna_codice_concessione) agg.rna_codice_concessione = a.cor
  if (c.esl == null && a.elemento_aiuto != null) agg.esl = a.elemento_aiuto
  if (!c.regime_aiuto) agg.regime_aiuto = regimeDaRegolamenti(a.regolamenti || [])
  if (!c.ente_erogatore && a.soggetto_concedente) agg.ente_erogatore = a.soggetto_concedente
  if (!c.rna_url) agg.rna_url = a.link_atto_concessione || a.link_trasparenza || null
  if (!c.data_concessione && !c.progetto_id && a.data_concessione) agg.data_concessione = a.data_concessione
  return agg
}

/**
 * POST — Porta l'aiuto RNA "tra i nostri".
 * Body:
 *   { azione: 'crea', forma_contributo?, stato?, bando_id?, note? }
 *       crea un contributo (origine DA_RNA) con i dati RNA e lo collega
 *   { azione: 'collega', contributo_id }
 *       collega un contributo esistente del cliente, compilando solo i campi vuoti
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const auth = await verifyJWT(request)
    if (!auth) return Response.json({ success: false, error: 'Non autorizzato' }, { status: 401 })

    const { id: clienteId, aiutoId } = await params
    const body = await request.json().catch(() => ({}))

    const { data: aiuto, error: eA } = await caricaAiuto(clienteId, aiutoId)
    if (eA) throw eA
    if (!aiuto) return Response.json({ success: false, error: 'Aiuto RNA non trovato' }, { status: 404 })
    if (aiuto.contributo_id) {
      return Response.json({ success: false, error: 'Aiuto già collegato a un contributo' }, { status: 409 })
    }

    let contributoId: string
    let creato = false

    if (body.azione === 'collega') {
      const cid = typeof body.contributo_id === 'string' ? body.contributo_id : ''
      const { data: c, error: eC } = await supabase.from('scadenze_bandi_contributi_ottenuti')
        .select('*').eq('id', cid).eq('cliente_id', clienteId).maybeSingle()
      if (eC) throw eC
      if (!c) return Response.json({ success: false, error: 'Contributo non trovato' }, { status: 404 })
      const { data: giaUsato } = await supabase.from('scadenze_bandi_rna_aiuti')
        .select('id').eq('contributo_id', cid).maybeSingle()
      if (giaUsato) {
        return Response.json({ success: false, error: 'Il contributo è già collegato a un altro aiuto RNA' }, { status: 409 })
      }
      const agg = campiDaCompletare(aiuto, c)
      if (Object.keys(agg).length) {
        const { error } = await supabase.from('scadenze_bandi_contributi_ottenuti').update(agg).eq('id', cid)
        if (error) throw error
      }
      contributoId = cid
    } else if (body.azione === 'crea') {
      const forma = body.forma_contributo ?? aiuto.forma_proposta ?? 'FONDO_PERDUTO'
      if (!isContributoForma(forma)) {
        return Response.json({ success: false, error: 'forma_contributo non valida' }, { status: 400 })
      }
      const stato = body.stato ?? 'CONCESSO'
      if (!isContributoStato(stato)) {
        return Response.json({ success: false, error: 'stato non valido' }, { status: 400 })
      }
      const bandoId = typeof body.bando_id === 'string' && body.bando_id.trim() ? body.bando_id.trim() : null
      const anno = aiuto.anno_concessione || new Date().getFullYear()
      const note = typeof body.note === 'string' && body.note.trim()
        ? body.note.trim()
        : (aiuto.titolo_progetto ? `Progetto RNA: ${aiuto.titolo_progetto}` : null)

      const { data: nuovo, error: eI } = await supabase.from('scadenze_bandi_contributi_ottenuti')
        .insert({
          cliente_id: clienteId,
          progetto_id: null,
          anno_competenza: anno,
          bando_id: bandoId,
          bando_denominazione_manuale: bandoId ? null : (aiuto.titolo_misura || `Aiuto RNA COR ${aiuto.cor}`),
          ente_erogatore: aiuto.soggetto_concedente,
          forma_contributo: forma,
          importo_progetto: null,
          importo_contributo: aiuto.importo_nominale,
          esl: aiuto.elemento_aiuto,
          regime_aiuto: regimeDaRegolamenti(aiuto.regolamenti || []),
          rna_codice_concessione: aiuto.cor,
          rna_url: aiuto.link_atto_concessione || aiuto.link_trasparenza || null,
          data_concessione: aiuto.data_concessione,
          stato,
          note,
          origine: 'DA_RNA',
          created_by_user_id: auth.userId,
        })
        .select('id')
        .single()
      if (eI) {
        const code = (eI as any).code
        const status = ['23503', '23514', '22P02'].indexOf(code) >= 0 ? 400 : 500
        return Response.json({ success: false, error: eI.message }, { status })
      }
      contributoId = (nuovo as any).id
      creato = true
    } else {
      return Response.json({ success: false, error: "azione deve essere 'crea' o 'collega'" }, { status: 400 })
    }

    const { error: eL } = await supabase.from('scadenze_bandi_rna_aiuti')
      .update({ contributo_id: contributoId, collegamento_automatico: false, escludi_collegamento_auto: false })
      .eq('id', aiutoId)
      .is('contributo_id', null)
    if (eL) {
      // Rollback: il contributo appena creato non resta orfano
      if (creato) await supabase.from('scadenze_bandi_contributi_ottenuti').delete().eq('id', contributoId)
      throw eL
    }

    return Response.json({ success: true, data: { contributo_id: contributoId, creato } })
  } catch (error: unknown) {
    const message = errMsg(error, 'Errore nel collegamento aiuto RNA')
    console.error('[API rna] POST Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}

/**
 * DELETE — Riporta l'aiuto tra gli "altri aiuti".
 *  - se il contributo collegato era stato creato da RNA (origine DA_RNA) viene eliminato;
 *  - altrimenti il contributo resta e perde solo il COR (se era quello dell'aiuto).
 * L'aiuto non verrà più collegato in automatico dalle importazioni successive.
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const auth = await verifyJWT(request)
    if (!auth) return Response.json({ success: false, error: 'Non autorizzato' }, { status: 401 })

    const { id: clienteId, aiutoId } = await params
    const { data: aiuto, error: eA } = await caricaAiuto(clienteId, aiutoId)
    if (eA) throw eA
    if (!aiuto) return Response.json({ success: false, error: 'Aiuto RNA non trovato' }, { status: 404 })
    if (!aiuto.contributo_id) {
      return Response.json({ success: false, error: "L'aiuto è già tra gli altri aiuti" }, { status: 400 })
    }

    const { data: c } = await supabase.from('scadenze_bandi_contributi_ottenuti')
      .select('id, origine, rna_codice_concessione').eq('id', aiuto.contributo_id).maybeSingle()

    const { error: eU } = await supabase.from('scadenze_bandi_rna_aiuti')
      .update({ contributo_id: null, collegamento_automatico: false, escludi_collegamento_auto: true })
      .eq('id', aiutoId)
    if (eU) throw eU

    let contributoEliminato = false
    if (c) {
      if ((c as any).origine === 'DA_RNA') {
        const { error } = await supabase.from('scadenze_bandi_contributi_ottenuti').delete().eq('id', (c as any).id)
        if (error) throw error
        contributoEliminato = true
      } else if ((c as any).rna_codice_concessione === aiuto.cor) {
        await supabase.from('scadenze_bandi_contributi_ottenuti')
          .update({ rna_codice_concessione: null }).eq('id', (c as any).id)
      }
    }

    return Response.json({ success: true, data: { contributo_eliminato: contributoEliminato } })
  } catch (error: unknown) {
    const message = errMsg(error, 'Errore nello scollegamento aiuto RNA')
    console.error('[API rna] DELETE Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}

/**
 * PATCH — { azione: 'verificato' }: toglie l'avviso "modificato da RNA"
 * dopo che l'utente ha controllato il contributo collegato.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const auth = await verifyJWT(request)
    if (!auth) return Response.json({ success: false, error: 'Non autorizzato' }, { status: 401 })
    const { id: clienteId, aiutoId } = await params
    const body = await request.json().catch(() => ({}))
    if (body.azione !== 'verificato') {
      return Response.json({ success: false, error: "azione deve essere 'verificato'" }, { status: 400 })
    }
    const { error } = await supabase.from('scadenze_bandi_rna_aiuti')
      .update({ modificato_da_rna_at: null })
      .eq('id', aiutoId).eq('cliente_id', clienteId)
    if (error) throw error
    return Response.json({ success: true })
  } catch (error: unknown) {
    const message = errMsg(error, 'Errore aggiornamento aiuto RNA')
    console.error('[API rna] PATCH Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
