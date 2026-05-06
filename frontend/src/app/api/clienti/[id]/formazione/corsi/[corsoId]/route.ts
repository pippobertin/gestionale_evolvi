import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyJWT } from '@/lib/jwtAuth'

// PUT - Aggiorna corso formativo
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; corsoId: string }> }
) {
  try {
    await verifyJWT(request)
    const { corsoId } = await params
    const body = await request.json()

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    const fields = [
      'piano_formativo_id', 'titolo', 'area_tematica', 'modalita',
      'ore_durata', 'data_inizio', 'data_fine', 'sede', 'ente_erogatore',
      'docente', 'numero_partecipanti', 'stato', 'attestato_rilasciato',
      'costo_totale', 'note',
    ]

    for (const field of fields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    const { data, error } = await supabase
      .from('scadenze_bandi_corsi_formativi')
      .update(updateData)
      .eq('id', corsoId)
      .select()
      .single()

    if (error) throw error

    return Response.json({ success: true, data })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore aggiornamento corso'
    console.error('[API corsi] PUT Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}

// DELETE - Elimina corso formativo
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; corsoId: string }> }
) {
  try {
    await verifyJWT(request)
    const { corsoId } = await params

    const { error } = await supabase
      .from('scadenze_bandi_corsi_formativi')
      .delete()
      .eq('id', corsoId)

    if (error) throw error

    return Response.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore eliminazione corso'
    console.error('[API corsi] DELETE Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
