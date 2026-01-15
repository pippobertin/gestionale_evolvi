import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    // Delete existing test user if exists
    await supabase
      .from('scadenze_bandi_utenti')
      .delete()
      .eq('email', 'test@example.com')

    // Create test user with temporary password 'user!'
    const temporaryPassword = 'user!'
    const passwordHash = await bcrypt.hash(temporaryPassword, 10)

    const { data: newUser, error: createError } = await supabase
      .from('scadenze_bandi_utenti')
      .insert([{
        email: 'test@example.com',
        nome: 'Test',
        cognome: 'User',
        password_hash: passwordHash,
        livello_permessi: 'collaboratore',
        first_login_password_change: true,
        attivo: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single()

    if (createError) throw createError

    return NextResponse.json({
      success: true,
      user: newUser,
      temporaryPassword,
      message: `Test user created with email: test@example.com and password: ${temporaryPassword}`
    })

  } catch (error) {
    console.error('Error creating test user:', error)
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}