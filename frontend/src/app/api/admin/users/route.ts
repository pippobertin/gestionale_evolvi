import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import jwt from 'jsonwebtoken'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase configuration')
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export async function GET(request: NextRequest) {
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

      const { data: users, error } = await supabase
        .from('scadenze_bandi_utenti')
        .select('id, email, nome, cognome, livello_permessi, attivo, created_at, updated_at, ultimo_accesso')
        .order('created_at', { ascending: false })

      if (error) throw error

      return NextResponse.json({ users })
    } catch (jwtError) {
      return NextResponse.json({ error: 'Token non valido' }, { status: 401 })
    }
  } catch (error) {
    console.error('Errore nel recupero utenti:', error)
    return NextResponse.json({ error: 'Errore del server' }, { status: 500 })
  }
}