import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyJWT } from '@/lib/jwtAuth'
import { syncPianoScadenze } from '@/lib/formazione/syncScadenze'
import { canTransition, type StatoPiano } from '@/lib/formazione/pianoStateMachine'

// PUT - Aggiorna piano formativo
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pianoId: string }> }
) {
  try {
    await verifyJWT(request)
    const { pianoId } = await params
    const body = await request.json()

    // If state transition requested, validate it
    if (body.stato) {
      const { data: current } = await supabase
        .from('scadenze_bandi_piani_formativi')
        .select('stato')
        .eq('id', pianoId)
        .single()

      if (current && current.stato !== body.stato) {
        const result = canTransition(current.stato as StatoPiano, body.stato as StatoPiano, body)
        if (!result.valid) {
          return Response.json({ success: false, error: result.error }, { status: 400 })
        }
      }
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    // Only update provided fields
    const fields = [
      'adesione_fpi_id', 'fondo_id', 'codice_piano', 'titolo', 'descrizione',
      'tipologia', 'canale_finanziamento', 'avviso_riferimento', 'stato',
      'data_presentazione', 'data_approvazione', 'data_inizio_attivita',
      'data_fine_attivita', 'data_scadenza_rendicontazione', 'data_saldo',
      'importo_richiesto', 'importo_approvato', 'importo_erogato', 'importo_saldato',
      'ore_previste', 'ore_erogate', 'num_partecipanti_previsti', 'num_partecipanti_effettivi',
      'responsabile_piano', 'note', 'drive_folder_id', 'drive_folder_url',
    ]

    for (const field of fields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    const { data, error } = await supabase
      .from('scadenze_bandi_piani_formativi')
      .update(updateData)
      .eq('id', pianoId)
      .select()
      .single()

    if (error) throw error

    // Sync scadenze after update
    await syncPianoScadenze(pianoId)

    return Response.json({ success: true, data })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore aggiornamento piano'
    console.error('[API piani] PUT Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}

// DELETE - Elimina piano formativo
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pianoId: string }> }
) {
  try {
    await verifyJWT(request)
    const { pianoId } = await params

    // Remove linked scadenze first
    await supabase
      .from('scadenze_bandi_scadenze_contrattuali')
      .delete()
      .eq('entity_type', 'FORMAZIONE')
      .eq('entity_id', pianoId)

    const { error } = await supabase
      .from('scadenze_bandi_piani_formativi')
      .delete()
      .eq('id', pianoId)

    if (error) throw error

    return Response.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore eliminazione piano'
    console.error('[API piani] DELETE Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
