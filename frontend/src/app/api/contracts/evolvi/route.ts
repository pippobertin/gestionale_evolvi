import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET - Lista contratti Evolvi con filtri opzionali
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const cliente_id = searchParams.get('cliente_id')
    const stato = searchParams.get('stato')

    // Query base con join per denominazione cliente
    let query = supabase
      .from('scadenze_bandi_contratti_evolvi')
      .select('*, scadenze_bandi_clienti(denominazione)')

    if (cliente_id) {
      query = query.eq('cliente_id', cliente_id)
    }

    if (stato) {
      query = query.eq('stato', stato)
    }

    query = query.order('created_at', { ascending: false })

    const { data, error } = await query

    if (error) throw error

    // Flatten denominazione dal join
    const contracts = (data || []).map((contract: any) => ({
      ...contract,
      cliente_denominazione: contract.scadenze_bandi_clienti?.denominazione || null,
      scadenze_bandi_clienti: undefined
    }))

    return Response.json({
      success: true,
      data: contracts
    })

  } catch (error: any) {
    console.error('Errore nel recupero contratti Evolvi:', error)
    return Response.json({
      success: false,
      error: error.message || 'Errore nel recupero dei contratti Evolvi'
    }, { status: 500 })
  }
}

// POST - Crea nuovo contratto Evolvi
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.cliente_id) {
      return Response.json({
        success: false,
        error: 'Il campo cliente_id è obbligatorio'
      }, { status: 400 })
    }

    const contractData = {
      cliente_id: body.cliente_id,
      data_contratto: body.data_contratto || null,
      data_inizio: body.data_inizio || null,
      data_fine: body.data_fine || null,
      importo_annuale: body.importo_annuale || null,
      importo_totale: body.importo_totale || null,
      modalita_pagamento: body.modalita_pagamento || null,
      rinnovo_automatico: body.rinnovo_automatico ?? false,
      note: body.note || null,
      stato: 'bozza',
      creato_da: body.creato_da || 'system'
    }

    const { data, error } = await supabase
      .from('scadenze_bandi_contratti_evolvi')
      .insert([contractData])
      .select()
      .single()

    if (error) throw error

    // Auto-creazione scadenze contrattuali se data_fine è presente
    if (data && body.data_fine) {
      try {
        // Recupera denominazione cliente
        const { data: cliente } = await supabase
          .from('scadenze_bandi_clienti')
          .select('denominazione')
          .eq('id', body.cliente_id)
          .single()

        const denominazione = cliente?.denominazione || 'Cliente'
        const dataFine = new Date(body.data_fine)

        // 1. Scadenza contratto (data_fine, priorità ALTA)
        const scadenzaContratto = {
          entity_type: 'CONTRATTO_EVOLVI',
          entity_id: data.id,
          titolo: `Scadenza contratto Evolvi - ${denominazione}`,
          descrizione: `Il contratto Evolvi ${data.numero_contratto || ''} con ${denominazione} scade in questa data.`,
          tipo_scadenza: 'CONTRATTUALE',
          categoria: 'CONTRATTI',
          data_scadenza: body.data_fine,
          data_promemoria: new Date(dataFine.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          stato: 'APERTA',
          priorita: 'ALTA',
          notifiche_attive: true,
          notifica_giorni_prima: [30, 7, 1],
          created_by: body.creato_da || 'system'
        }

        // 2. Reminder rinnovo (data_fine - 30 giorni, priorità MEDIA)
        const dataRinnovo = new Date(dataFine.getTime() - 30 * 24 * 60 * 60 * 1000)
        const scadenzaRinnovo = {
          entity_type: 'CONTRATTO_EVOLVI',
          entity_id: data.id,
          titolo: `Rinnovo contratto Evolvi - ${denominazione}`,
          descrizione: `Promemoria per il rinnovo del contratto Evolvi ${data.numero_contratto || ''} con ${denominazione}. Il contratto scade il ${dataFine.toLocaleDateString('it-IT')}.`,
          tipo_scadenza: 'REVISIONE',
          categoria: 'CONTRATTI',
          data_scadenza: dataRinnovo.toISOString().split('T')[0],
          data_promemoria: new Date(dataRinnovo.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          stato: 'APERTA',
          priorita: 'MEDIA',
          notifiche_attive: true,
          notifica_giorni_prima: [7, 3, 1],
          created_by: body.creato_da || 'system'
        }

        const { data: scadenzeCreate, error: scadenzeError } = await supabase
          .from('scadenze_bandi_scadenze_contrattuali')
          .insert([scadenzaContratto, scadenzaRinnovo])
          .select()

        if (scadenzeError) {
          console.warn('Warning: scadenze contrattuali non create:', scadenzeError)
        } else if (scadenzeCreate) {
          // Log di creazione per ogni scadenza
          const logs = scadenzeCreate.map((s: any) => ({
            scadenza_id: s.id,
            azione: 'creazione',
            dettagli: { descrizione: `Scadenza "${s.titolo}" creata automaticamente da contratto Evolvi` },
            utente: body.creato_da || 'system'
          }))
          await supabase
            .from('scadenze_bandi_scadenze_contrattuali_log')
            .insert(logs)
        }
      } catch (scadenzeError) {
        console.warn('Warning: errore nella creazione scadenze contrattuali:', scadenzeError)
      }
    }

    return Response.json({
      success: true,
      data,
      message: 'Contratto Evolvi creato con successo'
    })

  } catch (error: any) {
    console.error('Errore nella creazione contratto Evolvi:', error)
    return Response.json({
      success: false,
      error: error.message || 'Errore nella creazione del contratto Evolvi'
    }, { status: 500 })
  }
}
