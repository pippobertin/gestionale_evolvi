import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

// POST - Process notifications per scadenze contrattuali in scadenza
export async function POST(request: NextRequest) {
  try {
    // Recupera tutte le scadenze con notifiche attive e stato APERTA o IN_CORSO
    const { data: scadenze, error } = await supabase
      .from('scadenze_bandi_scadenze_contrattuali')
      .select('*')
      .eq('notifiche_attive', true)
      .in('stato', ['APERTA', 'IN_CORSO'])

    if (error) throw error

    const all = scadenze || []
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let notificheProcessate = 0
    const notificheDettaglio: Array<{
      scadenza_id: string
      titolo: string
      data_scadenza: string
      giorni_mancanti: number
    }> = []

    for (const scadenza of all) {
      const dataScadenza = new Date(scadenza.data_scadenza)
      dataScadenza.setHours(0, 0, 0, 0)

      const diffTime = dataScadenza.getTime() - today.getTime()
      const giorniMancanti = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      // Verifica se oggi è tra i giorni di preavviso configurati
      const giorniPrima = scadenza.notifica_giorni_prima || []

      if (giorniPrima.includes(giorniMancanti)) {
        // Log della notifica inviata
        await supabase
          .from('scadenze_bandi_scadenze_contrattuali_log')
          .insert([{
            scadenza_id: scadenza.id,
            azione: 'notifica_inviata',
            descrizione: `Notifica automatica: la scadenza "${scadenza.titolo}" scade tra ${giorniMancanti} giorn${giorniMancanti === 1 ? 'o' : 'i'} (${scadenza.data_scadenza}). Responsabile: ${scadenza.responsabile_email || 'non assegnato'}`,
            eseguito_da: 'system'
          }])

        notificheProcessate++
        notificheDettaglio.push({
          scadenza_id: scadenza.id,
          titolo: scadenza.titolo,
          data_scadenza: scadenza.data_scadenza,
          giorni_mancanti: giorniMancanti
        })
      }
    }

    return Response.json({
      success: true,
      data: {
        scadenze_controllate: all.length,
        notifiche_processate: notificheProcessate,
        dettaglio: notificheDettaglio
      },
      message: `Processate ${notificheProcessate} notifiche su ${all.length} scadenze controllate`
    })

  } catch (error: any) {
    console.error('Errore nel processamento notifiche scadenze contrattuali:', error)
    return Response.json({
      success: false,
      error: error.message || 'Errore nel processamento delle notifiche'
    }, { status: 500 })
  }
}
