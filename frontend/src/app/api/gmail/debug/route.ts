import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/gmail/debug
 * Diagnostic endpoint to check Gmail system token state.
 * Requires admin authentication.
 */
export async function GET(request: NextRequest) {
  try {
    // Require admin
    const decoded = await verifyJWT(request)
    if (!decoded || decoded.livello_permessi !== 'admin') {
      return NextResponse.json({ error: 'Admin required' }, { status: 403 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Check system Gmail tokens
    const { data: settings } = await supabase
      .from('scadenze_bandi_system_settings')
      .select('key, value, updated_at')
      .in('key', ['gmail_refresh_token', 'gmail_access_token', 'gmail_token_expires_at'])

    const tokenState: Record<string, any> = {}
    for (const s of settings || []) {
      if (s.key === 'gmail_refresh_token') {
        tokenState.refresh_token = {
          exists: !!s.value,
          length: s.value?.length || 0,
          prefix: s.value?.substring(0, 10) + '...',
          updated_at: s.updated_at
        }
      } else if (s.key === 'gmail_access_token') {
        tokenState.access_token = {
          exists: !!s.value,
          length: s.value?.length || 0,
          updated_at: s.updated_at
        }
      } else if (s.key === 'gmail_token_expires_at') {
        const expiresAt = parseInt(s.value)
        tokenState.expires_at = {
          value: s.value,
          date: new Date(expiresAt).toISOString(),
          expired: Date.now() > expiresAt,
          minutes_ago: Math.round((Date.now() - expiresAt) / 60000)
        }
      }
    }

    // Check user-specific Gmail tokens
    const { data: userData } = await supabase
      .from('scadenze_bandi_utenti')
      .select('id, email, gmail_email, gmail_connected_at')
      .eq('id', decoded.userId)
      .single()

    // Check env vars (existence only, not values)
    const envCheck = {
      GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
      GOOGLE_SERVICE_ACCOUNT_KEY: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      JWT_SECRET_SET: process.env.JWT_SECRET !== undefined && process.env.JWT_SECRET !== 'fallback-secret-key-change-in-production'
    }

    return NextResponse.json({
      system_tokens: tokenState,
      user_gmail: {
        email: userData?.gmail_email,
        connected_at: userData?.gmail_connected_at,
        has_personal_gmail: !!userData?.gmail_email
      },
      env: envCheck,
      missing_tokens: !tokenState.refresh_token?.exists
        ? 'REFRESH TOKEN MISSING - system Gmail needs re-authorization'
        : !tokenState.access_token?.exists
        ? 'ACCESS TOKEN MISSING - will be refreshed automatically if refresh_token is valid'
        : 'All tokens present'
    })

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
