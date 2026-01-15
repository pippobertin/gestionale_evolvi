import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    // First, check if user exists
    const { data: existingUser, error: findError } = await supabase
      .from('scadenze_bandi_utenti')
      .select('*')
      .eq('email', email)
      .single()

    if (findError || !existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    console.log('Found user:', existingUser.email, 'current first_login_password_change:', existingUser.first_login_password_change)

    // Update the user to require password change
    const { data: updatedUser, error: updateError } = await supabase
      .from('scadenze_bandi_utenti')
      .update({
        first_login_password_change: true,
        updated_at: new Date().toISOString()
      })
      .eq('email', email)
      .select()
      .single()

    if (updateError) throw updateError

    return NextResponse.json({
      success: true,
      message: `User ${email} updated to require password change`,
      user: updatedUser
    })

  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    )
  }
}