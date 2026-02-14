import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import bcrypt from 'bcrypt'
import { requireAdmin } from '@/lib/jwtAuth'

export async function GET(request: NextRequest) {
  try {
    // Verifica autenticazione JWT e permessi admin
    const admin = await requireAdmin(request)

    if (!admin) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
    }

    // Recupera tutti gli utenti
    const { data: users, error } = await supabase
      .from('scadenze_bandi_utenti')
      .select('id, email, nome, cognome, livello_permessi, attivo, created_at, updated_at, ultimo_accesso')
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json({ users })

  } catch (error) {
    console.error('Errore nel recupero utenti:', error)
    return NextResponse.json({ error: 'Errore del server' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verifica autenticazione JWT e permessi admin
    const admin = await requireAdmin(request)

    if (!admin) {
      return NextResponse.json({ error: 'Non autenticato o permessi insufficienti' }, { status: 401 })
    }

    const body = await request.json()
    const { nome, cognome, email, livello_permessi } = body

    // Validazione input
    if (!nome || !cognome || !email) {
      return NextResponse.json({ error: 'Nome, cognome ed email sono obbligatori' }, { status: 400 })
    }

    if (!['admin', 'collaboratore'].includes(livello_permessi)) {
      return NextResponse.json({ error: 'Livello permessi non valido' }, { status: 400 })
    }

    // Controlla se l'email esiste già
    const { data: existingUser, error: checkError } = await supabase
      .from('scadenze_bandi_utenti')
      .select('id')
      .eq('email', email)
      .single()

    if (existingUser) {
      return NextResponse.json({ error: 'Un utente con questa email esiste già' }, { status: 409 })
    }

    // Genera password temporanea: cognome + ! (tutto minuscolo)
    const temporaryPassword = cognome.toLowerCase().trim() + '!'
    const passwordHash = await bcrypt.hash(temporaryPassword, 10)

    // Crea nuovo utente
    const { data: newUser, error: createError } = await supabase
      .from('scadenze_bandi_utenti')
      .insert([{
        nome: nome.trim(),
        cognome: cognome.trim(),
        email: email.toLowerCase().trim(),
        livello_permessi,
        password_hash: passwordHash,
        first_login_password_change: true, // Deve cambiare password al primo accesso
        attivo: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single()

    if (createError) throw createError

    return NextResponse.json({
      user: newUser,
      temporaryPassword,
      message: `Utente creato con successo. Password temporanea: ${temporaryPassword}`
    })

  } catch (error) {
    console.error('Errore nella creazione utente:', error)
    return NextResponse.json({ error: 'Errore del server' }, { status: 500 })
  }
}