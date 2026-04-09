import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import jwt from 'jsonwebtoken'
import { supabase } from '@/lib/supabase'

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key-change-in-production'

/**
 * GET /api/auth/google-jwt
 * Creates a JWT token for Google OAuth users so they can access
 * API routes that require auth_token cookie/header.
 */
export async function GET(request: NextRequest) {
  try {
    // Verify the NextAuth Google session server-side
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'No active Google session' },
        { status: 401 }
      )
    }

    // Find user in database
    const { data: utente, error } = await supabase
      .from('scadenze_bandi_utenti')
      .select('id, email, nome, cognome, livello_permessi, attivo')
      .eq('email', session.user.email.toLowerCase())
      .eq('attivo', true)
      .single()

    if (error || !utente) {
      return NextResponse.json(
        { error: 'User not found or inactive' },
        { status: 404 }
      )
    }

    // Create JWT (same format as /api/auth/login)
    const token = jwt.sign(
      {
        userId: utente.id,
        email: utente.email,
        livello_permessi: utente.livello_permessi
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    // Update last access
    await supabase
      .from('scadenze_bandi_utenti')
      .update({ ultimo_accesso: new Date().toISOString() })
      .eq('id', utente.id)

    const response = NextResponse.json({
      success: true,
      token,
      user: {
        id: utente.id,
        email: utente.email,
        nome: utente.nome,
        cognome: utente.cognome,
        livello_permessi: utente.livello_permessi,
        nome_completo: `${utente.nome} ${utente.cognome}`
      }
    })

    // Set auth_token HTTP-only cookie (same as /api/auth/login)
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/'
    })

    console.log(`✅ JWT created for Google OAuth user: ${utente.email}`)
    return response

  } catch (error: any) {
    console.error('Error creating Google JWT:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
