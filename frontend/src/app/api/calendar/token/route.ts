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