import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

// DELETE: rimuove associazione consulente -> cliente
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; relId: string }> }
) {
  try {
    const { id: consulenteId, relId } = await params

    const { error } = await supabase
      .from('scadenze_bandi_consulenti_clienti')
      .delete()
      .eq('id', relId)
      .eq('consulente_id', consulenteId)

    if (error) throw error

    return Response.json({ success: true })
  } catch (error: any) {
    console.error('Errore rimozione associazione consulente:', error)
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }
}
