import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.accessToken) {
      return NextResponse.json({
        success: false,
        error: 'Access token non disponibile'
      }, { status: 401 })
    }

    // Controlla se il token di refresh è fallito (token scaduto e non rinnovabile)
    if ((session as any).error === 'RefreshAccessTokenError') {
      console.warn('⚠️ Refresh token fallito - utente deve rifare il login')
      return NextResponse.json({
        success: false,
        error: 'Token scaduto - effettuare logout e login nuovamente'
      }, { status: 401 })
    }

    return NextResponse.json({
      success: true,
      accessToken: session.accessToken
    })

  } catch (error) {
    console.error('❌ Errore recupero access token per Calendar:', error)

    return NextResponse.json({
      success: false,
      error: 'Errore interno del server'
    }, { status: 500 })
  }
}