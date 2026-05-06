import { supabase } from '@/lib/supabase'

/**
 * Genera il piano di fatturazione per un contratto Evolvi.
 * Calcola le fatture in base alla modalita_pagamento del contratto.
 */
export async function generateInvoicePlan(contrattoId: string) {
  // Recupera il contratto
  const { data: contratto, error: contrattoError } = await supabase
    .from('scadenze_bandi_contratti_evolvi')
    .select('*')
    .eq('id', contrattoId)
    .single()

  if (contrattoError) throw contrattoError

  if (!contratto.data_inizio || !contratto.data_fine || !contratto.importo_totale || !contratto.modalita_pagamento) {
    throw new Error('Contratto incompleto: servono data_inizio, data_fine, importo_totale e modalita_pagamento')
  }

  const periodsMap: Record<string, { numFatture: number; monthsPerPeriod: number }> = {
    mensile: { numFatture: 24, monthsPerPeriod: 1 },
    trimestrale: { numFatture: 8, monthsPerPeriod: 3 },
    semestrale: { numFatture: 4, monthsPerPeriod: 6 },
    annuale: { numFatture: 2, monthsPerPeriod: 12 }
  }

  const config = periodsMap[contratto.modalita_pagamento]
  if (!config) {
    throw new Error(`Modalita di pagamento non supportata: ${contratto.modalita_pagamento}`)
  }

  const { numFatture, monthsPerPeriod } = config
  const importoNetto = Math.round((contratto.importo_totale / numFatture) * 100) / 100
  const importoIva = Math.round((importoNetto * 0.22) * 100) / 100
  const importoTotale = Math.round((importoNetto + importoIva) * 100) / 100

  const startDate = new Date(contratto.data_inizio)
  const fatture = []

  for (let i = 0; i < numFatture; i++) {
    const periodoInizio = new Date(startDate)
    periodoInizio.setMonth(periodoInizio.getMonth() + (i * monthsPerPeriod))

    const periodoFine = new Date(startDate)
    periodoFine.setMonth(periodoFine.getMonth() + ((i + 1) * monthsPerPeriod))
    periodoFine.setDate(periodoFine.getDate() - 1)

    const dataScadenza = new Date(periodoFine)
    dataScadenza.setDate(dataScadenza.getDate() + 30)

    fatture.push({
      contratto_id: contrattoId,
      cliente_id: contratto.cliente_id,
      data_fattura: periodoInizio.toISOString().split('T')[0],
      data_scadenza_pagamento: dataScadenza.toISOString().split('T')[0],
      importo_netto: importoNetto,
      importo_iva: importoIva,
      importo_totale: importoTotale,
      periodo_inizio: periodoInizio.toISOString().split('T')[0],
      periodo_fine: periodoFine.toISOString().split('T')[0],
      stato_pagamento: 'PENDING',
      created_by: 'billing-scheduler'
    })
  }

  // Inserimento batch
  const { data, error } = await supabase
    .from('scadenze_bandi_evolvi_fatture')
    .insert(fatture)
    .select()

  if (error) throw error

  return data
}

/**
 * Controlla le fatture scadute e aggiorna lo stato da PENDING a OVERDUE.
 * Una fattura e scaduta se data_scadenza_pagamento < oggi e stato_pagamento = PENDING.
 */
export async function checkOverdueInvoices() {
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('scadenze_bandi_evolvi_fatture')
    .update({
      stato_pagamento: 'OVERDUE',
      updated_at: new Date().toISOString()
    })
    .eq('stato_pagamento', 'PENDING')
    .lt('data_scadenza_pagamento', today)
    .select('id')

  if (error) throw error

  return {
    updated: data?.length || 0,
    ids: (data || []).map((f: any) => f.id)
  }
}

/**
 * Recupera le fatture in scadenza nei prossimi N giorni.
 * Di default restituisce le fatture con scadenza entro 30 giorni.
 */
export async function getUpcomingInvoices(days: number = 30) {
  const today = new Date()
  const futureDate = new Date(today)
  futureDate.setDate(futureDate.getDate() + days)

  const todayStr = today.toISOString().split('T')[0]
  const futureDateStr = futureDate.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('scadenze_bandi_evolvi_fatture')
    .select('*, scadenze_bandi_clienti(denominazione), scadenze_bandi_contratti_evolvi(numero_contratto)')
    .eq('stato_pagamento', 'PENDING')
    .gte('data_scadenza_pagamento', todayStr)
    .lte('data_scadenza_pagamento', futureDateStr)
    .order('data_scadenza_pagamento', { ascending: true })

  if (error) throw error

  const fatture = (data || []).map((fattura: any) => ({
    ...fattura,
    cliente_denominazione: fattura.scadenze_bandi_clienti?.denominazione || null,
    numero_contratto: fattura.scadenze_bandi_contratti_evolvi?.numero_contratto || null,
    scadenze_bandi_clienti: undefined,
    scadenze_bandi_contratti_evolvi: undefined
  }))

  return fatture
}
