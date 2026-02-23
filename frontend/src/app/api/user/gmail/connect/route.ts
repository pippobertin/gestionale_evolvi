import { NextRequest, NextResponse } from 'next/server'
import { createGoogleAuthClient } from '@/lib/gmail'
import { verifyJWT } from '@/lib/jwtAuth'

/**
 * GET /api/user/gmail/connect
 * Generates OAuth URL for user to connect their Gmail account
 */
export async function GET(request: NextRequest) {
  try {
    console.log('📧 Gmail connect request received')
    console.log('🍪 Cookies:', request.cookies.getAll().map(c => c.name))
    console.log('🔑 Authorization header:', request.headers.get('authorization') ? 'Present' : 'Missing')

    // Verify user is logged in
    const decoded = await verifyJWT(request)
    console.log('👤 Decoded JWT:', decoded)

    if (!decoded || !decoded.userId) {
      console.error('❌ JWT verification failed - user not authenticated')
      return NextResponse.json(
        { error: 'Non autenticato' },
        { status: 401 }
      )
    }

    console.log(`✅ User authenticated: ${decoded.userId} (${decoded.email})`)

    // Generate OAuth URL with state parameter to identify user
    const oauth2Client = createGoogleAuthClient(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/user/gmail/callback`
    )

    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.labels',
      'https://www.googleapis.com/auth/userinfo.email'
    ]

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      state: decoded.userId, // Pass userId in state to identify user in callback
      include_granted_scopes: true
    })

    return NextResponse.json({
      success: true,
      authUrl
    })

  } catch (error: any) {
    console.error('Error generating Gmail auth URL:', error)
    return NextResponse.json(
      { error: error.message || 'Errore interno del server' },
      { status: 500 }
    )
  }
}
