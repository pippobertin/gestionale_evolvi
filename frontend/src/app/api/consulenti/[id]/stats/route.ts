import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

function sum(arr: any[] | null, field: string): number {
  return (arr || []).reduce((s: number, item: any) => s + (Number(item[field]) || 0), 0)
}

function groupCount(arr: any[] | null, field: string): Record<string, number> {
  return (arr || []).reduce((acc: Record<string, number>, item: any) => {
    const key = item[field] || 'altro'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
}

function emptyStats() {
  return {
    clienti_segnalati: 0,
    segnalazioni_totali: 0,
    per_tipo_segnalazione: {},
    progetti: { totale: 0, importo_totale_progetto: 0, contributo_ammesso: 0, contributo_ottenuto: 0, per_stato: {} },
    contratti_evolvi: { totale: 0, attivi: 0, importo_annuale_totale: 0, importo_totale: 0, per_stato: {} },
    fatture: { totale: 0, importo_totale: 0, pagate: 0, importo_pagato: 0, da_pagare: 0, scadute: 0 },
    formazione: { piani_totale: 0, importo_approvato: 0, importo_erogato: 0, ore_erogate: 0, partecipanti_previsti: 0 },
    corsi: { totale: 0, ore_durata_totale: 0, partecipanti_totale: 0 },
    adesioni_fpi: { totale: 0, attive: 0, dipendenti_aderenti: 0 }
  }
}

// GET: KPI aggregate dai clienti segnalati dal consulente
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: consulenteId } = await params

    // 1. Fetch tutti i clienti collegati
    const { data: rels, error: relsError } = await supabase
      .from('scadenze_bandi_consulenti_clienti')
      .select('cliente_id, tipo_segnalazione')
      .eq('consulente_id', consulenteId)

    if (relsError) throw relsError
    if (!rels || rels.length === 0) {
      return Response.json({ success: true, data: emptyStats() })
    }

    const clienteIds = [...new Set(rels.map((r: any) => r.cliente_id))]

    // 2. Query parallele su tutte le tabelle
    const [
      progettiRes,
      contrattiRes,
      fattureRes,
      pianiRes,
      corsiRes,
      adesioniRes
    ] = await Promise.all([
      supabase
        .from('scadenze_bandi_progetti')
        .select('id, importo_totale_progetto, contributo_ammesso, contributo_ottenuto, stato')
        .in('cliente_id', clienteIds),
      supabase
        .from('scadenze_bandi_contratti_evolvi')
        .select('id, importo_annuale, importo_totale, stato')
        .in('cliente_id', clienteIds),
      supabase
        .from('scadenze_bandi_evolvi_fatture')
        .select('id, importo_totale, stato_pagamento')
        .in('cliente_id', clienteIds),
      supabase
        .from('scadenze_bandi_piani_formativi')
        .select('id, importo_approvato, importo_erogato, ore_erogate, num_partecipanti_previsti, stato')
        .in('cliente_id', clienteIds),
      supabase
        .from('scadenze_bandi_corsi_formativi')
        .select('id, ore_durata, numero_partecipanti, stato')
        .in('cliente_id', clienteIds),
      supabase
        .from('scadenze_bandi_clienti_adesioni_fpi')
        .select('id, dipendenti_aderenti, stato')
        .in('cliente_id', clienteIds),
    ])

    const progetti = progettiRes.data
    const contratti = contrattiRes.data
    const fatture = fattureRes.data
    const piani = pianiRes.data
    const corsi = corsiRes.data
    const adesioni = adesioniRes.data

    const fatturePagate = (fatture || []).filter((f: any) => f.stato_pagamento === 'PAID')

    return Response.json({
      success: true,
      data: {
        clienti_segnalati: clienteIds.length,
        segnalazioni_totali: rels.length,
        per_tipo_segnalazione: groupCount(rels, 'tipo_segnalazione'),
        progetti: {
          totale: (progetti || []).length,
          importo_totale_progetto: sum(progetti, 'importo_totale_progetto'),
          contributo_ammesso: sum(progetti, 'contributo_ammesso'),
          contributo_ottenuto: sum(progetti, 'contributo_ottenuto'),
          per_stato: groupCount(progetti, 'stato')
        },
        contratti_evolvi: {
          totale: (contratti || []).length,
          attivi: (contratti || []).filter((c: any) => c.stato === 'attivo').length,
          importo_annuale_totale: sum(contratti, 'importo_annuale'),
          importo_totale: sum(contratti, 'importo_totale'),
          per_stato: groupCount(contratti, 'stato')
        },
        fatture: {
          totale: (fatture || []).length,
          importo_totale: sum(fatture, 'importo_totale'),
          pagate: fatturePagate.length,
          importo_pagato: sum(fatturePagate, 'importo_totale'),
          da_pagare: (fatture || []).filter((f: any) => f.stato_pagamento === 'PENDING').length,
          scadute: (fatture || []).filter((f: any) => f.stato_pagamento === 'OVERDUE').length,
        },
        formazione: {
          piani_totale: (piani || []).length,
          importo_approvato: sum(piani, 'importo_approvato'),
          importo_erogato: sum(piani, 'importo_erogato'),
          ore_erogate: sum(piani, 'ore_erogate'),
          partecipanti_previsti: sum(piani, 'num_partecipanti_previsti'),
        },
        corsi: {
          totale: (corsi || []).length,
          ore_durata_totale: sum(corsi, 'ore_durata'),
          partecipanti_totale: sum(corsi, 'numero_partecipanti'),
        },
        adesioni_fpi: {
          totale: (adesioni || []).length,
          attive: (adesioni || []).filter((a: any) => a.stato === 'ATTIVA').length,
          dipendenti_aderenti: sum(adesioni, 'dipendenti_aderenti'),
        }
      }
    })
  } catch (error: any) {
    console.error('Errore fetch stats consulente:', error)
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }
}
