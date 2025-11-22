import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase configuration')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token mancante' }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const body = await request.json()

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any

      const { data: admin, error: adminError } = await supabase
        .from('scadenze_bandi_utenti')
        .select('livello_permessi')
        .eq('id', decoded.userId)
        .single()

      if (adminError || admin.livello_permessi !== 'admin') {
        return NextResponse.json({ error: 'Accesso non autorizzato' }, { status: 403 })
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
        .eq('id', params.id)
        .select()
        .single()

      if (error) throw error

      return NextResponse.json({ user: data, message: 'Utente aggiornato con successo' })
    } catch (jwtError) {
      return NextResponse.json({ error: 'Token non valido' }, { status: 401 })
    }
  } catch (error) {
    console.error('Errore nell\'aggiornamento utente:', error)
    return NextResponse.json({ error: 'Errore del server' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Token mancante' }, { status: 401 })
    }

    const token = authHeader.substring(7)

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any

      const { data: admin, error: adminError } = await supabase
        .from('scadenze_bandi_utenti')
        .select('livello_permessi')
        .eq('id', decoded.userId)
        .single()

      if (adminError || admin.livello_permessi !== 'admin') {
        return NextResponse.json({ error: 'Accesso non autorizzato' }, { status: 403 })
      }

      if (decoded.userId === params.id) {
        return NextResponse.json({ error: 'Non puoi eliminare il tuo account' }, { status: 400 })
      }

      const { error } = await supabase
        .from('scadenze_bandi_utenti')
        .delete()
        .eq('id', params.id)

      if (error) throw error

      return NextResponse.json({ message: 'Utente eliminato con successo' })
    } catch (jwtError) {
      return NextResponse.json({ error: 'Token non valido' }, { status: 401 })
    }
  } catch (error) {
    console.error('Errore nell\'eliminazione utente:', error)
    return NextResponse.json({ error: 'Errore del server' }, { status: 500 })
  }
}