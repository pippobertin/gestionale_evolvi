import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET - Lista scadenze contrattuali con filtri
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const entity_type = searchParams.get('entity_type')
    const tipo_scadenza = searchParams.get('tipo_scadenza')
    const stato = searchParams.get('stato')
    const priorita = searchParams.get('priorita')
    const responsabile_email = searchParams.get('responsabile_email')
    const data_from = searchParams.get('data_from')
    const data_to = searchParams.get('data_to')
    const categoria = searchParams.get('categoria')

    let query = supabase
      .from('scadenze_bandi_scadenze_contrattuali')
      .select('*')

    if (entity_type) {
      query = query.eq('entity_type', entity_type)
    }

    if (tipo_scadenza) {
      query = query.eq('tipo_scadenza', tipo_scadenza)
    }

    if (stato) {
      query = query.eq('stato', stato)
    }

    if (priorita) {
      query = query.eq('priorita', priorita)
    }

    if (responsabile_email) {
      query = query.eq('responsabile_email', responsabile_email)
    }

    if (data_from) {
      query = query.gte('data_scadenza', data_from)
    }

    if (data_to) {
      query = query.lte('data_scadenza', data_to)
    }

    if (categoria) {
      query = query.eq('categoria', categoria)
    }

    query = query.order('data_scadenza', { ascending: true })

    const { data, error } = await query

    if (error) throw error

    return Response.json({
      success: true,
      data: data || []
    })

  } catch (error: any) {
    console.error('Errore nel recupero scadenze contrattuali:', error)
    return Response.json({
      success: false,
      error: error.message || 'Errore nel recupero delle scadenze contrattuali'
    }, { status: 500 })
  }
}

// POST - Crea nuova scadenza contrattuale
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validazione campi obbligatori
    if (!body.titolo) {
      return Response.json({
        success: false,
        error: 'Il campo titolo è obbligatorio'
      }, { status: 400 })
    }

    if (!body.tipo_scadenza) {
      return Response.json({
        success: false,
        error: 'Il campo tipo_scadenza è obbligatorio'
      }, { status: 400 })
    }

    if (!body.data_scadenza) {
      return Response.json({
        success: false,
        error: 'Il campo data_scadenza è obbligatorio'
      }, { status: 400 })
    }

    const scadenzaData = {
      entity_type: body.entity_type || 'GENERALE',
      entity_id: body.entity_id || null,
      titolo: body.titolo,
      descrizione: body.descrizione || null,
      tipo_scadenza: body.tipo_scadenza,
      categoria: body.categoria || null,
      data_scadenza: body.data_scadenza,
      data_promemoria: body.data_promemoria || null,
      is_recurring: body.is_recurring ?? false,
      recurrence_pattern: body.recurrence_pattern || null,
      recurrence_interval: body.recurrence_interval || null,
      recurrence_end_date: body.recurrence_end_date || null,
      stato: body.stato || 'APERTA',
      priorita: body.priorita || 'MEDIA',
      responsabile_email: body.responsabile_email || null,
      notifiche_attive: body.notifiche_attive ?? true,
      notifica_giorni_prima: body.notifica_giorni_prima || [7, 3, 1],
      tags: body.tags || [],
      created_by: body.created_by || 'system'
    }

    const { data, error } = await supabase
      .from('scadenze_bandi_scadenze_contrattuali')
      .insert([scadenzaData])
      .select()
      .single()

    if (error) throw error

    // Inserisci log di creazione
    await supabase
      .from('scadenze_bandi_scadenze_contrattuali_log')
      .insert([{
        scadenza_id: data.id,
        azione: 'creazione',
        descrizione: `Scadenza "${data.titolo}" creata`,
        eseguito_da: body.created_by || 'system'
      }])

    return Response.json({
      success: true,
      data,
      message: 'Scadenza contrattuale creata con successo'
    })

  } catch (error: any) {
    console.error('Errore nella creazione scadenza contrattuale:', error)
    return Response.json({
      success: false,
      error: error.message || 'Errore nella creazione della scadenza contrattuale'
    }, { status: 500 })
  }
}
