import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET - Ottieni tutti i destinatari aggiuntivi attivi
export async function GET() {
  try {
    const { data: recipients, error } = await supabase
      .from('scadenze_bandi_additional_recipients')
      .select('email')
      .eq('active', true)
      .order('email')

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data: recipients?.map(r => r.email) || []
    })

  } catch (error) {
    console.error('Errore recupero destinatari aggiuntivi:', error)
    return NextResponse.json({
      success: false,
      error: 'Errore interno del server'
    }, { status: 500 })
  }
}

// POST - Aggiungi nuovo destinatario
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, createdBy } = body

    if (!email || !email.includes('@')) {
      return NextResponse.json({
        success: false,
        error: 'Email valida richiesta'
      }, { status: 400 })
    }

    // Controlla se già esiste
    const { data: existing } = await supabase
      .from('scadenze_bandi_additional_recipients')
      .select('id')
      .eq('email', email)
      .eq('active', true)
      .single()

    if (existing) {
      return NextResponse.json({
        success: false,
        error: 'Email già presente nei destinatari'
      }, { status: 400 })
    }

    // Aggiungi nuovo destinatario
    const { data, error } = await supabase
      .from('scadenze_bandi_additional_recipients')
      .insert({
        email: email.toLowerCase().trim(),
        created_by: createdBy,
        active: true
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Destinatario aggiunto con successo'
    })

  } catch (error) {
    console.error('Errore aggiunta destinatario:', error)
    return NextResponse.json({
      success: false,
      error: 'Errore interno del server'
    }, { status: 500 })
  }
}

// DELETE - Rimuovi destinatario
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json({
        success: false,
        error: 'Email richiesta'
      }, { status: 400 })
    }

    // Disattiva invece di cancellare per mantenere audit trail
    const { error } = await supabase
      .from('scadenze_bandi_additional_recipients')
      .update({
        active: false,
        updated_at: new Date().toISOString()
      })
      .eq('email', email)
      .eq('active', true)

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      message: 'Destinatario rimosso con successo'
    })

  } catch (error) {
    console.error('Errore rimozione destinatario:', error)
    return NextResponse.json({
      success: false,
      error: 'Errore interno del server'
    }, { status: 500 })
  }
}