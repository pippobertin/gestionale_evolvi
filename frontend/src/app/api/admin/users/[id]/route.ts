import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireAdmin } from '@/lib/jwtAuth'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Verifica autenticazione JWT e permessi admin
    const admin = await requireAdmin(request)

    if (!admin) {
      return NextResponse.json({ error: 'Non autenticato o permessi insufficienti' }, { status: 401 })
    }

    const body = await request.json()

      const updates: any = { updated_at: new Date().toISOString() }

      if (body.attivo !== undefined) {
        updates.attivo = body.attivo
      }

      if (body.livello_permessi) {
        if (!['admin', 'collaboratore'].includes(body.livello_permessi)) {
          return NextResponse.json({ error: 'Livello permessi non valido' }, { status: 400 })
        }
        updates.livello_permessi = body.livello_permessi
      }

      const { data, error } = await supabase
        .from('scadenze_bandi_utenti')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      return NextResponse.json({ user: data, message: 'Utente aggiornato con successo' })
  } catch (error) {
    console.error('Errore nell\'aggiornamento utente:', error)
    return NextResponse.json({ error: 'Errore del server' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Verifica autenticazione JWT e permessi admin
    const admin = await requireAdmin(request)

    if (!admin) {
      return NextResponse.json({ error: 'Non autenticato o permessi insufficienti' }, { status: 401 })
    }

    // Impedisci all'admin di eliminare se stesso
    if (admin.userId === id) {
      return NextResponse.json({ error: 'Non puoi eliminare il tuo account' }, { status: 400 })
    }

      const { error } = await supabase
        .from('scadenze_bandi_utenti')
        .delete()
        .eq('id', id)

      if (error) throw error

      return NextResponse.json({ message: 'Utente eliminato con successo' })
  } catch (error) {
    console.error('Errore nell\'eliminazione utente:', error)
    return NextResponse.json({ error: 'Errore del server' }, { status: 500 })
  }
}