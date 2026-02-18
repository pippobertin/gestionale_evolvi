import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import path from 'path'
import fs from 'fs'

function getServiceAccountKey(): any | null {
  try {
    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      const decoded = Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY, 'base64').toString('utf8')
      return JSON.parse(decoded)
    }
    const serviceAccountPath = path.join(process.cwd(), 'service-account-key.json')
    if (fs.existsSync(serviceAccountPath)) {
      return JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))
    }
    return null
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const serviceAccountKey = getServiceAccountKey()

    if (!serviceAccountKey) {
      return NextResponse.json({
        success: false,
        error: 'Service account key non disponibile'
      }, { status: 401 })
    }

    // Genera access token con scope Calendar usando il Service Account
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccountKey,
      scopes: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events'
      ]
    })

    const client = await auth.getClient()
    const tokenResponse = await client.getAccessToken()

    if (!tokenResponse.token) {
      return NextResponse.json({
        success: false,
        error: 'Impossibile ottenere access token dal Service Account'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      accessToken: tokenResponse.token
    })

  } catch (error) {
    console.error('❌ Errore recupero token Calendar (Service Account):', error)
    return NextResponse.json({
      success: false,
      error: 'Errore interno del server'
    }, { status: 500 })
  }
}
