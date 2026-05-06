import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

// POST - Genera piano fatturazione per un contratto
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.contrattoId) {
      return Response.json({
        success: false,
        error: 'Il campo contrattoId è obbligatorio'
      }, { status: 400 })
    }

    const { contrattoId } = body

    // Recupera il contratto
    const { data: contratto, error: contrattoError } = await supabase
      .from('scadenze_bandi_contratti_evolvi')
      .select('*')
      .eq('id', contrattoId)
      .single()

    if (contrattoError) {
      if (contrattoError.code === 'PGRST116') {
        return Response.json({
          success: false,
          error: 'Contratto non trovato'
        }, { status: 404 })
      }
      throw contrattoError
    }

    if (!contratto.data_inizio || !contratto.data_fine) {
      return Response.json({
        success: false,
        error: 'Il contratto deve avere data_inizio e data_fine'
      }, { status: 400 })
    }

    if (!contratto.importo_totale || contratto.importo_totale <= 0) {
      return Response.json({
        success: false,
        error: 'Il contratto deve avere un importo_totale valido'
      }, { status: 400 })
    }

    if (!contratto.modalita_pagamento) {
      return Response.json({
        success: false,
        error: 'Il contratto deve avere una modalita_pagamento definita'
      }, { status: 400 })
    }

    // Verifica che non esistano gia fatture per questo contratto
    const { count, error: countError } = await supabase
      .from('scadenze_bandi_evolvi_fatture')
      .select('id', { count: 'exact', head: true })
      .eq('contratto_id', contrattoId)

    if (countError) throw countError

    if (count && count > 0) {
      return Response.json({
        success: false,
        error: `Esistono gia ${count} fatture per questo contratto. Eliminare le fatture esistenti prima di rigenerare il piano.`
      }, { status: 400 })
    }

    // Calcolo numero fatture e importo per rata in base a modalita_pagamento
    // Durata standard contratto: 2 anni
    const periodsMap: Record<string, { numFatture: number; monthsPerPeriod: number }> = {
      mensile: { numFatture: 24, monthsPerPeriod: 1 },
      trimestrale: { numFatture: 8, monthsPerPeriod: 3 },
      semestrale: { numFatture: 4, monthsPerPeriod: 6 },
      annuale: { numFatture: 2, monthsPerPeriod: 12 }
    }

    const config = periodsMap[contratto.modalita_pagamento]
    if (!config) {
      return Response.json({
        success: false,
        error: `Modalita di pagamento non supportata: ${contratto.modalita_pagamento}`
      }, { status: 400 })
    }

    const { numFatture, monthsPerPeriod } = config
    const importoNettoPeriodo = Math.round((contratto.importo_totale / numFatture) * 100) / 100
    const importoIvaPeriodo = Math.round((importoNettoPeriodo * 0.22) * 100) / 100
    const importoTotalePeriodo = Math.round((importoNettoPeriodo + importoIvaPeriodo) * 100) / 100

    const startDate = new Date(contratto.data_inizio)
    const fatture = []

    for (let i = 0; i < numFatture; i++) {
      // Periodo inizio: data_inizio + (i * monthsPerPeriod) mesi
      const periodoInizio = new Date(startDate)
      periodoInizio.setMonth(periodoInizio.getMonth() + (i * monthsPerPeriod))

      // Periodo fine: data_inizio + ((i + 1) * monthsPerPeriod) mesi - 1 giorno
      const periodoFine = new Date(startDate)
      periodoFine.setMonth(periodoFine.getMonth() + ((i + 1) * monthsPerPeriod))
      periodoFine.setDate(periodoFine.getDate() - 1)

      // Data scadenza pagamento: fine periodo + 30 giorni
      const dataScadenza = new Date(periodoFine)
      dataScadenza.setDate(dataScadenza.getDate() + 30)

      fatture.push({
        contratto_id: contrattoId,
        cliente_id: contratto.cliente_id,
        data_fattura: periodoInizio.toISOString().split('T')[0],
        data_scadenza_pagamento: dataScadenza.toISOString().split('T')[0],
        importo_netto: importoNettoPeriodo,
        importo_iva: importoIvaPeriodo,
        importo_totale: importoTotalePeriodo,
        periodo_inizio: periodoInizio.toISOString().split('T')[0],
        periodo_fine: periodoFine.toISOString().split('T')[0],
        stato_pagamento: 'PENDING',
        created_by: 'billing-process'
      })
    }

    // Inserimento batch
    const { data, error } = await supabase
      .from('scadenze_bandi_evolvi_fatture')
      .insert(fatture)
      .select()

    if (error) throw error

    return Response.json({
      success: true,
      data,
      message: `Piano fatturazione generato: ${fatture.length} fatture create (${contratto.modalita_pagamento})`,
      summary: {
        num_fatture: fatture.length,
        modalita_pagamento: contratto.modalita_pagamento,
        importo_netto_periodo: importoNettoPeriodo,
        importo_iva_periodo: importoIvaPeriodo,
        importo_totale_periodo: importoTotalePeriodo,
        importo_totale_contratto: contratto.importo_totale
      }
    })

  } catch (error: any) {
    console.error('Errore nella generazione piano fatturazione:', error)
    return Response.json({
      success: false,
      error: error.message || 'Errore nella generazione del piano fatturazione'
    }, { status: 500 })
  }
}
