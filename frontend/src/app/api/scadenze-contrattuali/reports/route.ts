import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET - Report data con raggruppamento per scadenze contrattuali
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const group_by = searchParams.get('group_by') || 'tipo'
    const data_from = searchParams.get('data_from')
    const data_to = searchParams.get('data_to')
    const tipo_scadenza = searchParams.get('tipo_scadenza')
    const stato = searchParams.get('stato')

    // Query base
    let query = supabase
      .from('scadenze_bandi_scadenze_contrattuali')
      .select('*')
      .order('data_scadenza', { ascending: true })

    if (data_from) {
      query = query.gte('data_scadenza', data_from)
    }

    if (data_to) {
      query = query.lte('data_scadenza', data_to)
    }

    if (tipo_scadenza) {
      query = query.eq('tipo_scadenza', tipo_scadenza)
    }

    if (stato) {
      query = query.eq('stato', stato)
    }

    const { data: scadenze, error } = await query

    if (error) throw error

    const all = scadenze || []

    // Calcola dati aggregati in base al group_by
    let grouped: Record<string, any[]> = {}

    switch (group_by) {
      case 'tipo':
        all.forEach(s => {
          const key = s.tipo_scadenza || 'ALTRO'
          if (!grouped[key]) grouped[key] = []
          grouped[key].push(s)
        })
        break

      case 'cliente':
        all.forEach(s => {
          const key = s.entity_type === 'CLIENTE' ? (s.entity_id || 'GENERALE') : 'GENERALE'
          if (!grouped[key]) grouped[key] = []
          grouped[key].push(s)
        })
        break

      case 'responsabile':
        all.forEach(s => {
          const key = s.responsabile_email || 'Non assegnato'
          if (!grouped[key]) grouped[key] = []
          grouped[key].push(s)
        })
        break

      case 'mese':
        all.forEach(s => {
          const date = new Date(s.data_scadenza)
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          if (!grouped[key]) grouped[key] = []
          grouped[key].push(s)
        })
        break

      default:
        all.forEach(s => {
          const key = s.tipo_scadenza || 'ALTRO'
          if (!grouped[key]) grouped[key] = []
          grouped[key].push(s)
        })
    }

    // Genera dati aggregati
    const aggregated = Object.entries(grouped).map(([key, items]) => {
      const completate = items.filter(s => s.stato === 'COMPLETATA').length
      const totale = items.length

      // Calcola media giorni a completamento per le completate
      const completateConData = items.filter(s =>
        s.stato === 'COMPLETATA' && s.data_completamento
      )
      let mediaGiorniCompletamento = 0
      if (completateConData.length > 0) {
        const totaleGiorni = completateConData.reduce((sum, s) => {
          const dataCreazione = new Date(s.created_at)
          const dataCompletamento = new Date(s.data_completamento)
          const diffDays = Math.ceil(
            (dataCompletamento.getTime() - dataCreazione.getTime()) / (1000 * 60 * 60 * 24)
          )
          return sum + diffDays
        }, 0)
        mediaGiorniCompletamento = Math.round(totaleGiorni / completateConData.length)
      }

      // Calcola scadute
      const today = new Date().toISOString().split('T')[0]
      const scadute = items.filter(s =>
        s.data_scadenza < today &&
        s.stato !== 'COMPLETATA' &&
        s.stato !== 'ANNULLATA'
      ).length

      return {
        gruppo: key,
        totale,
        aperte: items.filter(s => s.stato === 'APERTA').length,
        in_corso: items.filter(s => s.stato === 'IN_CORSO').length,
        completate,
        annullate: items.filter(s => s.stato === 'ANNULLATA').length,
        scadute,
        tasso_completamento: totale > 0 ? Math.round((completate / totale) * 100) : 0,
        media_giorni_completamento: mediaGiorniCompletamento,
        per_priorita: {
          BASSA: items.filter(s => s.priorita === 'BASSA').length,
          MEDIA: items.filter(s => s.priorita === 'MEDIA').length,
          ALTA: items.filter(s => s.priorita === 'ALTA').length,
          CRITICA: items.filter(s => s.priorita === 'CRITICA').length
        }
      }
    })

    // Ordina per totale decrescente
    aggregated.sort((a, b) => b.totale - a.totale)

    // Calcola totali globali
    const today = new Date().toISOString().split('T')[0]
    const totaliGlobali = {
      totale: all.length,
      completate: all.filter(s => s.stato === 'COMPLETATA').length,
      scadute: all.filter(s =>
        s.data_scadenza < today &&
        s.stato !== 'COMPLETATA' &&
        s.stato !== 'ANNULLATA'
      ).length,
      tasso_completamento: all.length > 0
        ? Math.round((all.filter(s => s.stato === 'COMPLETATA').length / all.length) * 100)
        : 0
    }

    return Response.json({
      success: true,
      data: {
        group_by,
        aggregated,
        totali: totaliGlobali,
        dettaglio: all
      }
    })

  } catch (error: any) {
    console.error('Errore nel recupero report scadenze contrattuali:', error)
    return Response.json({
      success: false,
      error: error.message || 'Errore nel recupero dei dati report'
    }, { status: 500 })
  }
}
