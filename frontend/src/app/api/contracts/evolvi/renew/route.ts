import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { contrattoId } = await req.json()

    if (!contrattoId) {
      return Response.json({ message: 'ID contratto richiesto' }, { status: 400 })
    }

    // 1. Recupera contratto originale
    const { data: originale, error: fetchError } = await supabase
      .from('scadenze_bandi_contratti_evolvi')
      .select('*')
      .eq('id', contrattoId)
      .single()

    if (fetchError || !originale) {
      return Response.json({ message: 'Contratto non trovato' }, { status: 404 })
    }

    // 2. Calcola nuove date
    const dataFineOriginale = originale.data_fine ? new Date(originale.data_fine) : new Date()
    const nuovaDataInizio = new Date(dataFineOriginale)
    nuovaDataInizio.setDate(nuovaDataInizio.getDate() + 1) // giorno dopo la scadenza

    const nuovaDataFine = new Date(nuovaDataInizio)
    nuovaDataFine.setFullYear(nuovaDataFine.getFullYear() + 2) // +2 anni

    // 3. Crea nuovo contratto
    const { data: nuovoContratto, error: insertError } = await supabase
      .from('scadenze_bandi_contratti_evolvi')
      .insert({
        cliente_id: originale.cliente_id,
        tipo_contratto: originale.tipo_contratto,
        data_contratto: new Date().toISOString().split('T')[0],
        data_inizio: nuovaDataInizio.toISOString().split('T')[0],
        data_fine: nuovaDataFine.toISOString().split('T')[0],
        importo_annuale: originale.importo_annuale,
        importo_totale: originale.importo_totale,
        modalita_pagamento: originale.modalita_pagamento,
        template_name: originale.template_name,
        rinnovo_automatico: originale.rinnovo_automatico,
        stato: 'bozza',
        note: `Rinnovo del contratto ${originale.numero_contratto}`,
        creato_da: 'system'
      })
      .select()
      .single()

    if (insertError || !nuovoContratto) {
      return Response.json({
        message: 'Errore creazione rinnovo',
        error: insertError?.message
      }, { status: 500 })
    }

    // 4. Aggiorna contratto originale con riferimento al rinnovo
    await supabase
      .from('scadenze_bandi_contratti_evolvi')
      .update({
        contratto_rinnovato_id: nuovoContratto.id,
        stato: 'scaduto'
      })
      .eq('id', contrattoId)

    return Response.json({
      success: true,
      message: 'Contratto rinnovato con successo',
      data: nuovoContratto
    })

  } catch (error: any) {
    console.error('Errore rinnovo contratto:', error)
    return Response.json({
      success: false,
      message: 'Errore durante il rinnovo',
      error: error.message
    }, { status: 500 })
  }
}
