import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { supabase } from '@/lib/supabase'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
    }

    const body = await request.json()

    // Verifica se l'utente è admin
    const { data: admin, error: adminError } = await supabase
      .from('scadenze_bandi_utenti')
      .select('id, livello_permessi')
      .eq('email', session.user.email)
      .single()

    if (adminError || admin.livello_permessi !== 'admin') {
      return NextResponse.json({ error: 'Accesso non autorizzato - Solo amministratori' }, { status: 403 })
    }

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
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
    }

    // Verifica se l'utente è admin
    const { data: admin, error: adminError } = await supabase
      .from('scadenze_bandi_utenti')
      .select('id, livello_permessi')
      .eq('email', session.user.email)
      .single()

    if (adminError || admin.livello_permessi !== 'admin') {
      return NextResponse.json({ error: 'Accesso non autorizzato - Solo amministratori' }, { status: 403 })
    }

    if (admin.id === id) {
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