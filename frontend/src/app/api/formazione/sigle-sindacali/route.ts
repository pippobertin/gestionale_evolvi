import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET - Lista sigle sindacali, opzionalmente filtrate per ccnl_id
export async function GET(request: NextRequest) {
  try {
    const ccnlId = request.nextUrl.searchParams.get('ccnl_id')

    if (ccnlId) {
      // Restituisci solo le sigle firmatarie di questo CCNL
      const { data, error } = await supabase
        .from('scadenze_bandi_ccnl_sigle')
        .select('sigla_id, scadenze_bandi_sigle_sindacali!inner(id, sigla, nome_completo, confederazione)')
        .eq('ccnl_id', ccnlId)

      if (error) throw error

      const sigle = (data || []).map((row: Record<string, unknown>) => {
        const s = row.scadenze_bandi_sigle_sindacali as Record<string, unknown>
        return {
          id: s.id,
          sigla: s.sigla,
          nome_completo: s.nome_completo,
          confederazione: s.confederazione,
        }
      })

      return Response.json({ success: true, data: sigle })
    }

    // Senza filtro: restituisci tutte le sigle attive
    const { data, error } = await supabase
      .from('scadenze_bandi_sigle_sindacali')
      .select('id, sigla, nome_completo, confederazione')
      .eq('attivo', true)
      .order('confederazione')
      .order('sigla')

    if (error) throw error
    return Response.json({ success: true, data: data || [] })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore nel recupero sigle sindacali'
    console.error('[API sigle-sindacali] GET Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
