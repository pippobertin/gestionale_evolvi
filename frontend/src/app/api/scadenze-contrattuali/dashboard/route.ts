import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET - Dashboard stats per scadenze contrattuali
export async function GET(request: NextRequest) {
  try {
    // Recupera tutte le scadenze
    const { data: scadenze, error } = await supabase
      .from('scadenze_bandi_scadenze_contrattuali')
      .select('*')
      .order('data_scadenza', { ascending: true })

    if (error) throw error

    const all = scadenze || []
    const today = new Date().toISOString().split('T')[0]

    // Conteggi per stato
    const totale = all.length
    const aperte = all.filter(s => s.stato === 'APERTA').length
    const in_corso = all.filter(s => s.stato === 'IN_CORSO').length
    const completate = all.filter(s => s.stato === 'COMPLETATA').length
    const annullate = all.filter(s => s.stato === 'ANNULLATA').length

    // Conteggi per tipo_scadenza
    const perTipoMap: Record<string, number> = {}
    all.forEach(s => {
      perTipoMap[s.tipo_scadenza] = (perTipoMap[s.tipo_scadenza] || 0) + 1
    })
    const per_tipo = Object.entries(perTipoMap).map(([tipo, count]) => ({
      tipo_scadenza: tipo,
      count
    }))

    // Conteggi per priorita
    const perPrioritaMap: Record<string, number> = {}
    all.forEach(s => {
      perPrioritaMap[s.priorita] = (perPrioritaMap[s.priorita] || 0) + 1
    })
    const per_priorita = Object.entries(perPrioritaMap).map(([priorita, count]) => ({
      priorita,
      count
    }))

    // Prossime 10 scadenze (future, non completate/annullate)
    const prossime_scadenze = all
      .filter(s =>
        s.data_scadenza >= today &&
        s.stato !== 'COMPLETATA' &&
        s.stato !== 'ANNULLATA'
      )
      .slice(0, 10)

    // Scadenze scadute (data passata e non completate/annullate)
    const scadute = all.filter(s =>
      s.data_scadenza < today &&
      s.stato !== 'COMPLETATA' &&
      s.stato !== 'ANNULLATA'
    )

    return Response.json({
      success: true,
      data: {
        totale,
        aperte,
        in_corso,
        completate,
        annullate,
        per_tipo,
        per_priorita,
        prossime_scadenze,
        scadute
      }
    })

  } catch (error: any) {
    console.error('Errore nel recupero dashboard scadenze contrattuali:', error)
    return Response.json({
      success: false,
      error: error.message || 'Errore nel recupero dei dati dashboard'
    }, { status: 500 })
  }
}
