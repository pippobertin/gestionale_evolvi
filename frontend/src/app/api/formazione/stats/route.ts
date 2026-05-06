import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyJWT } from '@/lib/jwtAuth'

// GET - Statistiche globali formazione
export async function GET(request: NextRequest) {
  try {
    await verifyJWT(request)

    const now = new Date()
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString()

    // Piani attivi (non terminali)
    const { count: pianiAttivi } = await supabase
      .from('scadenze_bandi_piani_formativi')
      .select('*', { count: 'exact', head: true })
      .not('stato', 'in', '("SALDATO","RESPINTO","ANNULLATO")')

    // Certificazioni scadute
    const { count: certScadute } = await supabase
      .from('scadenze_bandi_certificazioni_obbligatorie')
      .select('*', { count: 'exact', head: true })
      .eq('stato', 'SCADUTA')

    // Ore erogate ultimi 12 mesi
    const { data: corsiRecenti } = await supabase
      .from('scadenze_bandi_corsi_formativi')
      .select('ore_durata, numero_partecipanti')
      .gte('data_inizio', oneYearAgo)
      .eq('stato', 'CONCLUSO')

    const oreTotali = (corsiRecenti || []).reduce((sum, c) => sum + (Number(c.ore_durata) || 0), 0)
    const partecipantiTotali = (corsiRecenti || []).reduce((sum, c) => sum + (c.numero_partecipanti || 0), 0)

    // Importi FPI
    const { data: pianiImporti } = await supabase
      .from('scadenze_bandi_piani_formativi')
      .select('importo_richiesto, importo_approvato, importo_erogato')
      .not('tipologia', 'in', '("PRIVATO","OBBLIGATORIO")')

    const importiFPI = (pianiImporti || []).reduce(
      (acc, p) => ({
        richiesto: acc.richiesto + (Number(p.importo_richiesto) || 0),
        approvato: acc.approvato + (Number(p.importo_approvato) || 0),
        erogato: acc.erogato + (Number(p.importo_erogato) || 0),
      }),
      { richiesto: 0, approvato: 0, erogato: 0 }
    )

    return Response.json({
      success: true,
      data: {
        pianiAttivi: pianiAttivi || 0,
        certScadute: certScadute || 0,
        oreTotali,
        partecipantiTotali,
        importiFPI,
      }
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore nel recupero statistiche'
    console.error('[API formazione/stats] Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
