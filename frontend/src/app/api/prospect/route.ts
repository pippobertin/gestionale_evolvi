import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET - Lista prospect con filtri opzionali
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const stato = searchParams.get('stato')
    const search = searchParams.get('search')
    const fonte_acquisizione = searchParams.get('fonte_acquisizione')
    const assegnato_a = searchParams.get('assegnato_a')

    let query = supabase
      .from('scadenze_bandi_prospect')
      .select('*')

    if (stato) {
      query = query.eq('stato', stato)
    }

    if (search) {
      query = query.ilike('denominazione', `%${search}%`)
    }

    if (fonte_acquisizione) {
      query = query.eq('fonte_acquisizione', fonte_acquisizione)
    }

    if (assegnato_a) {
      query = query.eq('assegnato_a', assegnato_a)
    }

    query = query.order('created_at', { ascending: false })

    const { data, error } = await query

    if (error) throw error

    return Response.json({
      success: true,
      data
    })

  } catch (error: any) {
    console.error('Errore nel recupero prospect:', error)
    return Response.json({
      success: false,
      error: error.message || 'Errore nel recupero dei prospect'
    }, { status: 500 })
  }
}

// POST - Crea nuovo prospect
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.denominazione) {
      return Response.json({
        success: false,
        error: 'Il campo denominazione è obbligatorio'
      }, { status: 400 })
    }

    const prospectData = {
      denominazione: body.denominazione,
      partita_iva: body.partita_iva || null,
      codice_fiscale: body.codice_fiscale || null,
      email: body.email || null,
      pec: body.pec || null,
      telefono: body.telefono || null,
      sito_web: body.sito_web || null,
      indirizzo: body.indirizzo || null,
      cap: body.cap || null,
      citta: body.citta || null,
      provincia: body.provincia || null,
      settore: body.settore || null,
      ateco_2025: body.ateco_2025 || null,
      dimensione: body.dimensione || null,
      numero_dipendenti: body.numero_dipendenti || null,
      ultimo_fatturato: body.ultimo_fatturato || null,
      legale_rappresentante_nome: body.legale_rappresentante_nome || null,
      legale_rappresentante_cognome: body.legale_rappresentante_cognome || null,
      legale_rappresentante_email: body.legale_rappresentante_email || null,
      legale_rappresentante_telefono: body.legale_rappresentante_telefono || null,
      profiling_data: body.profiling_data || {},
      profiling_score: body.profiling_score || 0,
      fonte_acquisizione: body.fonte_acquisizione || null,
      assegnato_a: body.assegnato_a || null,
      note: body.note || null,
      creato_da: body.creato_da || 'system'
    }

    const { data, error } = await supabase
      .from('scadenze_bandi_prospect')
      .insert([prospectData])
      .select()
      .single()

    if (error) throw error

    // Inserisci record nella history per la creazione
    await supabase
      .from('scadenze_bandi_prospect_history')
      .insert([{
        prospect_id: data.id,
        stato_precedente: null,
        stato_nuovo: 'bozza',
        note: 'Prospect creato',
        utente: body.creato_da || 'system'
      }])

    return Response.json({
      success: true,
      data,
      message: 'Prospect creato con successo'
    })

  } catch (error: any) {
    console.error('Errore nella creazione prospect:', error)
    return Response.json({
      success: false,
      error: error.message || 'Errore nella creazione del prospect'
    }, { status: 500 })
  }
}
