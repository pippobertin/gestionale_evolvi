import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

// POST - Segna fattura come pagata
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Verifica che la fattura esista e non sia gia pagata
    const { data: fattura, error: fetchError } = await supabase
      .from('scadenze_bandi_evolvi_fatture')
      .select('id, stato_pagamento, numero_fattura')
      .eq('id', id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return Response.json({
          success: false,
          error: 'Fattura non trovata'
        }, { status: 404 })
      }
      throw fetchError
    }

    if (fattura.stato_pagamento === 'PAID') {
      return Response.json({
        success: false,
        error: 'La fattura risulta gia pagata'
      }, { status: 400 })
    }

    if (fattura.stato_pagamento === 'CANCELLED') {
      return Response.json({
        success: false,
        error: 'Impossibile segnare come pagata una fattura annullata'
      }, { status: 400 })
    }

    const updateData: Record<string, any> = {
      stato_pagamento: 'PAID',
      data_pagamento: body.data_pagamento || new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString()
    }

    if (body.metodo_pagamento) {
      updateData.metodo_pagamento = body.metodo_pagamento
    }

    if (body.riferimento_pagamento) {
      updateData.riferimento_pagamento = body.riferimento_pagamento
    }

    const { data, error } = await supabase
      .from('scadenze_bandi_evolvi_fatture')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return Response.json({
      success: true,
      data,
      message: `Fattura "${fattura.numero_fattura || id}" segnata come pagata`
    })

  } catch (error: any) {
    console.error('Errore nel segnare fattura come pagata:', error)
    return Response.json({
      success: false,
      error: error.message || 'Errore nel segnare la fattura come pagata'
    }, { status: 500 })
  }
}
