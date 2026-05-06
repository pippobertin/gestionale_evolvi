import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET - Lista fondi interprofessionali (lookup)
export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabase
      .from('scadenze_bandi_fondi_interprofessionali')
      .select('*')
      .eq('attivo', true)
      .order('nome')

    if (error) throw error

    return Response.json({
      success: true,
      data: data || []
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore nel recupero fondi'
    console.error('[API fondi] Error:', message)
    return Response.json({
      success: false,
      error: message
    }, { status: 500 })
  }
}
