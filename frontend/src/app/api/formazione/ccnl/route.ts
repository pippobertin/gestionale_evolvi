import { supabase } from '@/lib/supabase'

// GET - Lista CCNL
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('scadenze_bandi_ccnl')
      .select('id, codice, denominazione, settore')
      .eq('attivo', true)
      .order('settore')
      .order('denominazione')

    if (error) throw error
    return Response.json({ success: true, data: data || [] })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore nel recupero CCNL'
    console.error('[API ccnl] GET Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
