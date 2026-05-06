import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyJWT } from '@/lib/jwtAuth'

// GET - Lista partecipanti per corso
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; corsoId: string }> }
) {
  try {
    const { corsoId } = await params

    const { data, error } = await supabase
      .from('scadenze_bandi_partecipanti_formazione')
      .select('*')
      .eq('corso_id', corsoId)
      .order('cognome')

    if (error) throw error

    return Response.json({ success: true, data: data || [] })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore nel recupero partecipanti'
    console.error('[API partecipanti] GET Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}

// POST - Aggiungi partecipante (singolo o batch)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; corsoId: string }> }
) {
  try {
    await verifyJWT(request)
    const { corsoId } = await params
    const body = await request.json()

    // Support both single and batch insert
    const partecipanti = Array.isArray(body) ? body : [body]

    const rows = partecipanti.map(p => ({
      corso_id: corsoId,
      cognome: p.cognome,
      nome: p.nome,
      codice_fiscale: p.codice_fiscale,
      qualifica: p.qualifica,
      ruolo_sicurezza: p.ruolo_sicurezza,
      presente: p.presente ?? true,
      ore_frequentate: p.ore_frequentate,
      esito: p.esito || 'NON_APPLICABILE',
      note: p.note,
    }))

    const { data, error } = await supabase
      .from('scadenze_bandi_partecipanti_formazione')
      .insert(rows)
      .select()

    if (error) throw error

    // Update participant count on the course
    const { count } = await supabase
      .from('scadenze_bandi_partecipanti_formazione')
      .select('*', { count: 'exact', head: true })
      .eq('corso_id', corsoId)

    if (count !== null) {
      await supabase
        .from('scadenze_bandi_corsi_formativi')
        .update({ numero_partecipanti: count })
        .eq('id', corsoId)
    }

    return Response.json({ success: true, data: data || [] })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore aggiunta partecipanti'
    console.error('[API partecipanti] POST Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}

// DELETE - Rimuovi partecipante (via query param ?partecipanteId=...)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; corsoId: string }> }
) {
  try {
    await verifyJWT(request)
    const { corsoId } = await params
    const { searchParams } = new URL(request.url)
    const partecipanteId = searchParams.get('partecipanteId')

    if (!partecipanteId) {
      return Response.json({ success: false, error: 'partecipanteId obbligatorio' }, { status: 400 })
    }

    const { error } = await supabase
      .from('scadenze_bandi_partecipanti_formazione')
      .delete()
      .eq('id', partecipanteId)
      .eq('corso_id', corsoId)

    if (error) throw error

    return Response.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore rimozione partecipante'
    console.error('[API partecipanti] DELETE Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
