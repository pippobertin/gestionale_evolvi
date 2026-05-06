import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET - Panoramica formazione per singolo cliente
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clienteId } = await params
    const now = new Date()
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString()
    const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString()

    // Ore e partecipanti ultimi 12 mesi
    const { data: corsiRecenti } = await supabase
      .from('scadenze_bandi_corsi_formativi')
      .select('ore_durata, numero_partecipanti, area_tematica')
      .eq('cliente_id', clienteId)
      .gte('data_inizio', oneYearAgo)
      .eq('stato', 'CONCLUSO')

    const oreFormazione12m = (corsiRecenti || []).reduce((s, c) => s + (Number(c.ore_durata) || 0), 0)
    const partecipantiFormati12m = (corsiRecenti || []).reduce((s, c) => s + (c.numero_partecipanti || 0), 0)

    // Ore per area tematica (for chart)
    const orePerArea: Record<string, number> = {}
    for (const c of (corsiRecenti || [])) {
      const area = c.area_tematica || 'Altro'
      orePerArea[area] = (orePerArea[area] || 0) + (Number(c.ore_durata) || 0)
    }

    // Piani attivi
    const { data: pianiAttivi } = await supabase
      .from('scadenze_bandi_piani_formativi')
      .select('id, titolo, stato, importo_approvato, importo_erogato')
      .eq('cliente_id', clienteId)
      .not('stato', 'in', '("SALDATO","RESPINTO","ANNULLATO")')

    // Importi FPI
    const importoErogato = (pianiAttivi || []).reduce((s, p) => s + (Number(p.importo_erogato) || 0), 0)

    // Prossime scadenze formazione (max 5)
    const { data: prossimeScadenze } = await supabase
      .from('scadenze_bandi_scadenze_contrattuali')
      .select('*')
      .eq('cliente_id', clienteId)
      .eq('entity_type', 'FORMAZIONE')
      .gte('data_scadenza', now.toISOString())
      .order('data_scadenza', { ascending: true })
      .limit(5)

    // Certificazioni in scadenza entro 90 giorni
    const { data: certInScadenza } = await supabase
      .from('scadenze_bandi_certificazioni_obbligatorie')
      .select('*')
      .eq('cliente_id', clienteId)
      .lte('data_scadenza', in90Days)
      .gte('data_scadenza', now.toISOString().split('T')[0])
      .order('data_scadenza', { ascending: true })

    // Certificazioni scadute
    const { data: certScadute } = await supabase
      .from('scadenze_bandi_certificazioni_obbligatorie')
      .select('*')
      .eq('cliente_id', clienteId)
      .lt('data_scadenza', now.toISOString().split('T')[0])
      .not('stato', 'eq', 'DA_RINNOVARE')

    return Response.json({
      success: true,
      data: {
        oreFormazione12m,
        partecipantiFormati12m,
        pianiAttivi: pianiAttivi?.length || 0,
        importoErogato,
        orePerArea,
        prossimeScadenze: prossimeScadenze || [],
        certInScadenza: certInScadenza || [],
        certScadute: certScadute || [],
      }
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore nel recupero panoramica'
    console.error('[API panoramica] GET Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
