/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyJWT } from '@/lib/jwtAuth'
import { calcolaDeMinimis } from '@/lib/rna/deMinimis'

/**
 * GET /api/clienti/[id]/rna
 *
 * Aiuti del Registro Nazionale Aiuti ricevuti dal cliente, con:
 *  - aiuti: tutti (nostri = contributo_id valorizzato, altrimenti "altri")
 *  - contributi_collegabili: contributi del cliente non ancora collegati a un aiuto RNA
 *  - de_minimis: stima della capienza (cliente + aziende collegate)
 *  - ultimo_aggiornamento: fine dell'ultima importazione riuscita
 *  - abbinabile: false se il cliente non ha né codice fiscale né P.IVA
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

    const [cliRes, aiutiRes, contrRes, collRes, logRes] = await Promise.all([
      supabase.from('scadenze_bandi_clienti').select('id, codice_fiscale, partita_iva').eq('id', clienteId).maybeSingle(),
      supabase.from('scadenze_bandi_rna_aiuti')
        .select('id, cor, car, titolo_misura, soggetto_concedente, data_concessione, anno_concessione, titolo_progetto, procedimenti, regolamenti, cod_regolamenti, strumenti, forma_proposta, importo_nominale, elemento_aiuto, de_minimis, ambito, fondo_interprofessionale, link_atto_concessione, link_trasparenza, contributo_id, collegamento_automatico, modificato_da_rna_at, cliente_id')
        .eq('cliente_id', clienteId)
        .order('data_concessione', { ascending: false, nullsFirst: false }),
      supabase.from('scadenze_bandi_contributi_ottenuti')
        .select('id, anno_competenza, importo_contributo, bando_denominazione_manuale, rna_codice_concessione, origine, bando:scadenze_bandi_bandi!bando_id(nome)')
        .eq('cliente_id', clienteId)
        .order('anno_competenza', { ascending: false }),
      supabase.from('scadenze_bandi_collegamenti_aziendali')
        .select('azienda_madre_id, azienda_collegata_id, tipo_collegamento')
        .or(`azienda_madre_id.eq.${clienteId},azienda_collegata_id.eq.${clienteId}`),
      supabase.from('scadenze_bandi_rna_import_log')
        .select('completato_at')
        .eq('esito', 'OK')
        .order('completato_at', { ascending: false, nullsFirst: false })
        .limit(1),
    ])

    if (cliRes.error) throw cliRes.error
    if (!cliRes.data) {
      return Response.json({ success: false, error: 'Cliente non trovato' }, { status: 404 })
    }
    if (aiutiRes.error) throw aiutiRes.error
    if (contrRes.error) throw contrRes.error

    const aiuti = aiutiRes.data || []
    const collegatiIds = new Set(aiuti.filter((a: any) => a.contributo_id).map((a: any) => a.contributo_id))
    const contributiCollegabili = (contrRes.data || [])
      .filter((c: any) => !collegatiIds.has(c.id))
      .map((c: any) => ({
        id: c.id,
        anno_competenza: c.anno_competenza,
        importo_contributo: c.importo_contributo,
        origine: c.origine,
        nome: c.bando?.nome || c.bando_denominazione_manuale || '—',
      }))

    // Impresa unica: aziende collegate (non le associate) presenti nel gestionale
    const collegate = new Set<string>()
    ;(collRes.data || []).forEach((r: any) => {
      if (r.tipo_collegamento !== 'COLLEGATA') return
      const altro = r.azienda_madre_id === clienteId ? r.azienda_collegata_id : r.azienda_madre_id
      if (altro && altro !== clienteId) collegate.add(altro)
    })
    let aiutiCollegate: any[] = []
    if (collegate.size > 0) {
      const { data, error } = await supabase.from('scadenze_bandi_rna_aiuti')
        .select('cliente_id, data_concessione, elemento_aiuto, de_minimis, cod_regolamenti, regolamenti')
        .in('cliente_id', Array.from(collegate))
        .eq('de_minimis', true)
      if (error) throw error
      aiutiCollegate = data || []
    }

    const deMinimis = calcolaDeMinimis([...aiuti, ...aiutiCollegate] as any[], clienteId)

    const cli = cliRes.data as any
    return Response.json({
      success: true,
      data: {
        aiuti,
        contributi_collegabili: contributiCollegabili,
        de_minimis: { ...deMinimis, aziende_collegate: collegate.size },
        ultimo_aggiornamento: (logRes.data && logRes.data[0]?.completato_at) || null,
        abbinabile: !!((cli.codice_fiscale || '').trim() || (cli.partita_iva || '').trim()),
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : (error as any)?.message || 'Errore nel recupero aiuti RNA'
    console.error('[API rna] GET Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
