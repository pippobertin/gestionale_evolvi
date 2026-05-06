import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyJWT } from '@/lib/jwtAuth'

/**
 * GET — Lista rilevazioni fabbisogno di un cliente.
 * Query string supportata:
 *   ?stato=BOZZA|INVIATA|IN_COMPILAZIONE|COMPLETATA|SCADUTA|ARCHIVIATA
 *   ?escludi_archiviate=true (default)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clienteId } = await params
    const { searchParams } = new URL(request.url)
    const filtroStato = searchParams.get('stato')
    const escludiArchiviate = searchParams.get('escludi_archiviate') !== 'false'

    let query = supabase
      .from('scadenze_bandi_fabbisogno_rilevazioni')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('created_at', { ascending: false })

    if (filtroStato) {
      query = query.eq('stato', filtroStato)
    } else if (escludiArchiviate) {
      query = query.neq('stato', 'ARCHIVIATA')
    }

    const { data, error } = await query
    if (error) throw error

    // Marca come SCADUTA le rilevazioni il cui token e' expired e che non sono completate
    const ora = Date.now()
    const enriched = (data || []).map(r => {
      if (
        r.token_scadenza &&
        new Date(r.token_scadenza).getTime() < ora &&
        ['INVIATA', 'IN_COMPILAZIONE'].includes(r.stato)
      ) {
        return { ...r, stato_effettivo: 'SCADUTA' }
      }
      return { ...r, stato_effettivo: r.stato }
    })

    return Response.json({ success: true, data: enriched })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore nel recupero rilevazioni'
    console.error('[API fabbisogno] GET Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}

/**
 * POST — Crea una nuova rilevazione fabbisogno.
 * Body atteso (tutti opzionali):
 *   { titolo, anno_riferimento, giorni_validita_token }
 * Default:
 *   titolo = "Rilevazione AAAA" dove AAAA e' l'anno corrente
 *   anno_riferimento = anno corrente
 *   giorni_validita_token = 90
 *
 * Restituisce la rilevazione creata con il token. Lo stato e' BOZZA
 * (non ancora inviata): il consulente dovra' chiamare /invia per
 * marcarla come INVIATA dopo aver spedito l'email al cliente.
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

    const annoCorrente = new Date().getFullYear()
    const titolo = (body.titolo || `Rilevazione ${annoCorrente}`).toString().slice(0, 200)
    const annoRif = parseInt(body.anno_riferimento, 10) || annoCorrente
    const giorniValidita = Math.max(7, Math.min(365, parseInt(body.giorni_validita_token, 10) || 90))

    const tokenScadenza = new Date(Date.now() + giorniValidita * 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = await supabase
      .from('scadenze_bandi_fabbisogno_rilevazioni')
      .insert({
        cliente_id: clienteId,
        titolo,
        anno_riferimento: annoRif,
        token_scadenza: tokenScadenza,
        stato: 'BOZZA',
        inviata_da_utente_id: auth.userId,
      })
      .select()
      .single()

    if (error) throw error

    return Response.json({ success: true, data })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore nella creazione rilevazione'
    console.error('[API fabbisogno] POST Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
