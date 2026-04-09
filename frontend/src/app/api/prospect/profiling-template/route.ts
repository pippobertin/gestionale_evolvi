import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET - Lista template di profilazione attivi
export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabase
      .from('scadenze_bandi_profiling_template')
      .select('*')
      .eq('attivo', true)
      .order('ordine', { ascending: true })

    if (error) throw error

    return Response.json({
      success: true,
      data
    })

  } catch (error: any) {
    console.error('Errore nel recupero profiling template:', error)
    return Response.json({
      success: false,
      error: error.message || 'Errore nel recupero dei template di profilazione'
    }, { status: 500 })
  }
}

// POST - Crea nuova domanda template
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.domanda || !body.tipo) {
      return Response.json({
        success: false,
        error: 'I campi domanda e tipo sono obbligatori'
      }, { status: 400 })
    }

    const validTypes = ['text', 'number', 'select', 'multiselect', 'boolean', 'textarea', 'rating']
    if (!validTypes.includes(body.tipo)) {
      return Response.json({
        success: false,
        error: `Tipo non valido. Tipi accettati: ${validTypes.join(', ')}`
      }, { status: 400 })
    }

    const templateData = {
      domanda: body.domanda,
      tipo: body.tipo,
      opzioni: body.opzioni || [],
      peso: body.peso || 1,
      categoria: body.categoria || 'generale',
      ordine: body.ordine || 0,
      attivo: body.attivo !== undefined ? body.attivo : true
    }

    const { data, error } = await supabase
      .from('scadenze_bandi_profiling_template')
      .insert([templateData])
      .select()
      .single()

    if (error) throw error

    return Response.json({
      success: true,
      data,
      message: 'Domanda di profilazione creata con successo'
    })

  } catch (error: any) {
    console.error('Errore nella creazione profiling template:', error)
    return Response.json({
      success: false,
      error: error.message || 'Errore nella creazione della domanda di profilazione'
    }, { status: 500 })
  }
}

// PUT - Aggiorna domanda template
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.id) {
      return Response.json({
        success: false,
        error: 'Il campo id è obbligatorio'
      }, { status: 400 })
    }

    if (body.tipo) {
      const validTypes = ['text', 'number', 'select', 'multiselect', 'boolean', 'textarea', 'rating']
      if (!validTypes.includes(body.tipo)) {
        return Response.json({
          success: false,
          error: `Tipo non valido. Tipi accettati: ${validTypes.join(', ')}`
        }, { status: 400 })
      }
    }

    const { id, ...updateData } = body

    const { data, error } = await supabase
      .from('scadenze_bandi_profiling_template')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return Response.json({
          success: false,
          error: 'Domanda di profilazione non trovata'
        }, { status: 404 })
      }
      throw error
    }

    return Response.json({
      success: true,
      data,
      message: 'Domanda di profilazione aggiornata con successo'
    })

  } catch (error: any) {
    console.error('Errore nell\'aggiornamento profiling template:', error)
    return Response.json({
      success: false,
      error: error.message || 'Errore nell\'aggiornamento della domanda di profilazione'
    }, { status: 500 })
  }
}
