/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyJWT } from '@/lib/jwtAuth'
import { getAmbito } from '@/lib/interrogazioni/registry'
import { eseguiInterrogazione, leggiCampo } from '@/lib/interrogazioni/queryBuilder'

const LIMITE_SCADENZE = 200

/**
 * POST /api/interrogazioni/crea-scadenza
 *
 * Body:
 *   {
 *     ambito: string,
 *     filtri: Record<string, ValoreFiltro>,
 *     titolo_template: string,        // {nome} viene sostituito
 *     descrizione_template?: string,  // {nome} viene sostituito
 *     data_scadenza: string,          // ISO date
 *     tipo_scadenza?: string,         // default 'AMMINISTRATIVA'
 *     categoria?: string,             // libera
 *     priorita?: 'ALTA' | 'MEDIA' | 'BASSA',  // default 'MEDIA'
 *     responsabile_email?: string,
 *     notifica_giorni_prima?: number[],       // default [7, 3, 1]
 *   }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyJWT(request)
    if (!auth) {
      return Response.json({ success: false, error: 'Non autorizzato' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const ambito = getAmbito(body.ambito as string)
    if (!ambito) {
      return Response.json({ success: false, error: 'Ambito sconosciuto' }, { status: 400 })
    }
    if (!ambito.azione_scadenza) {
      return Response.json({ success: false, error: 'Questo ambito non supporta la creazione di scadenze' }, { status: 400 })
    }

    const titoloTpl = (body.titolo_template || '').toString().trim()
    const descrizioneTpl = (body.descrizione_template || '').toString()
    const dataScadenza = (body.data_scadenza || '').toString().trim()
    if (!titoloTpl) {
      return Response.json({ success: false, error: 'Titolo obbligatorio' }, { status: 400 })
    }
    if (!dataScadenza) {
      return Response.json({ success: false, error: 'Data scadenza obbligatoria' }, { status: 400 })
    }

    const tipoScadenza = body.tipo_scadenza || 'AMMINISTRATIVA'
    const categoria = body.categoria || 'interrogazione_bulk'
    const priorita = body.priorita || 'MEDIA'
    const responsabileEmail = body.responsabile_email || null
    const notificaGg = Array.isArray(body.notifica_giorni_prima)
      ? body.notifica_giorni_prima
      : [7, 3, 1]

    // Esegui ricerca
    const { righe } = await eseguiInterrogazione({
      ambito,
      filtri: body.filtri || {},
      senza_paginazione: true,
    })

    // Estrai cliente_id + nome per ogni riga; deduplica su cliente_id
    const visti = new Set<string>()
    const target: Array<{ cliente_id: string; nome: string }> = []
    for (const riga of righe) {
      const cid = leggiCampo(riga, ambito.azione_scadenza.campo_cliente_id) as string
      if (!cid || visti.has(cid)) continue
      visti.add(cid)
      const nome = (leggiCampo(riga, ambito.azione_scadenza.campo_nome) as string) || cid
      target.push({ cliente_id: cid, nome })
    }

    if (target.length === 0) {
      return Response.json({
        success: false,
        error: 'Nessun cliente collegato ai risultati. Non sono state create scadenze.',
      }, { status: 400 })
    }

    if (target.length > LIMITE_SCADENZE) {
      return Response.json({
        success: false,
        error: `Troppe scadenze da creare (${target.length}). Massimo: ${LIMITE_SCADENZE}. Raffina i filtri.`,
      }, { status: 400 })
    }

    // Recupera nome utente per created_by leggibile
    const { data: utente } = await supabase
      .from('scadenze_bandi_utenti')
      .select('nome, cognome, email')
      .eq('id', auth.userId)
      .single()

    const createdBy = utente
      ? `${utente.nome} ${utente.cognome}`.trim() || utente.email
      : auth.email || auth.userId

    // Costruisci array di insert
    const rows = target.map(t => ({
      cliente_id: t.cliente_id,
      entity_type: 'GENERALE',
      entity_id: t.cliente_id,
      titolo: titoloTpl.replace(/\{nome\}/g, t.nome),
      descrizione: descrizioneTpl.replace(/\{nome\}/g, t.nome) || null,
      tipo_scadenza: tipoScadenza,
      categoria,
      data_scadenza: dataScadenza,
      priorita,
      responsabile_email: responsabileEmail,
      notifiche_attive: true,
      notifica_giorni_prima: notificaGg,
      tags: ['interrogazione', ambito.id],
      stato: 'APERTA',
      created_by: createdBy,
    }))

    const { data: inserite, error: errIns } = await supabase
      .from('scadenze_bandi_scadenze_contrattuali')
      .insert(rows)
      .select('id')

    if (errIns) throw errIns

    return Response.json({
      success: true,
      data: {
        create: inserite?.length ?? 0,
        clienti_coinvolti: target.length,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore creazione scadenze'
    console.error('[API interrogazioni/crea-scadenza] Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
