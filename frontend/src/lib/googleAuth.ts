import { google } from 'googleapis'
import { supabase } from './supabase'
import path from 'path'
import fs from 'fs'

// Funzione per ottenere token Service Account (mai scade)
async function getServiceAccountToken(): Promise<string | null> {
  try {
    const serviceAccountPath = path.join(process.cwd(), 'service-account-key.json')

    if (!fs.existsSync(serviceAccountPath)) {
      console.log('⚠️ Service Account key non trovato, fallback a OAuth')
      return null
    }

    const serviceAccountKey = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))

    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccountKey,
      scopes: [
        'https://www.googleapis.com/auth/drive',
        'https://www.googleapis.com/auth/gmail.send'
      ]
    })

    const client = await auth.getClient()
    const accessToken = await client.getAccessToken()

    if (accessToken.token) {
      console.log('✅ Service Account token ottenuto (mai scade)')
      return accessToken.token
    }

    return null
  } catch (error) {
    console.error('❌ Errore Service Account:', error)
    return null
  }
}

// Configurazione OAuth2 (fallback)
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/gmail/callback`
)

// Funzione principale per ottenere token Google (Service Account + fallback OAuth)
export async function getValidGoogleToken(): Promise<string | null> {
  try {
    // PRIMA: Prova con Service Account (non scade mai)
    const serviceAccountToken = await getServiceAccountToken()
    if (serviceAccountToken) {
      return serviceAccountToken
    }

    // FALLBACK: Se Service Account non disponibile, usa OAuth
    console.log('🔄 Service Account non disponibile, fallback a OAuth...')
    // Ottieni token dal database
    const { data: refreshTokenData } = await supabase
      .from('scadenze_bandi_system_settings')
      .select('value')
      .eq('key', 'gmail_refresh_token')
      .single()

    const { data: accessTokenData } = await supabase
      .from('scadenze_bandi_system_settings')
      .select('value')
      .eq('key', 'gmail_access_token')
      .single()

    if (!refreshTokenData?.value) {
      console.error('❌ Refresh token non trovato - richiesta autenticazione utente')
      return null
    }

    // Configura OAuth2 client
    oauth2Client.setCredentials({
      refresh_token: refreshTokenData.value,
      access_token: accessTokenData?.value
    })

    // Controlla se il token è prossimo alla scadenza (refresh preventivo)
    const { data: tokenExpiresData } = await supabase
      .from('scadenze_bandi_system_settings')
      .select('value')
      .eq('key', 'gmail_token_expires_at')
      .single()

    const now = Date.now()
    const expiresAt = tokenExpiresData?.value ? parseInt(tokenExpiresData.value) : 0
    const timeUntilExpiry = expiresAt - now

    // Se mancano meno di 5 minuti alla scadenza, rinnova preventivamente
    if (timeUntilExpiry > 0 && timeUntilExpiry < 5 * 60 * 1000) {
      console.log('🔄 Token in scadenza tra', Math.round(timeUntilExpiry / 1000 / 60), 'minuti - refresh preventivo...')

      try {
        const { credentials } = await oauth2Client.refreshAccessToken()
        if (credentials.access_token) {
          // Salva il nuovo token e la sua scadenza
          await supabase
            .from('scadenze_bandi_system_settings')
            .upsert({
              key: 'gmail_access_token',
              value: credentials.access_token
            })

          const newExpiry = now + (credentials.expiry_date ? credentials.expiry_date - now : 55 * 60 * 1000) // default 55 min
          await supabase
            .from('scadenze_bandi_system_settings')
            .upsert({
              key: 'gmail_token_expires_at',
              value: newExpiry.toString()
            })

          console.log('✅ Token rinnovato preventivamente, valido fino a', new Date(newExpiry).toLocaleString())
          return credentials.access_token
        }
      } catch (preventiveRefreshError) {
        console.log('⚠️ Refresh preventivo fallito, provo con il token esistente...')
      }
    }

    // Prova a usare il token esistente
    try {
      // Testa il token con una chiamata API semplice
      const drive = google.drive({ version: 'v3', auth: oauth2Client })
      await drive.about.get({ fields: 'user' })

      console.log('✅ Token Google valido')
      return accessTokenData?.value || null
    } catch (testError: any) {
      console.log('🔄 Token scaduto, tentativo refresh automatico...')

      // Il token è scaduto, prova a rinnovarlo automaticamente
      try {
        const { credentials } = await oauth2Client.refreshAccessToken()

        if (credentials.access_token) {
          // Salva il nuovo token nel database
          await supabase
            .from('scadenze_bandi_system_settings')
            .upsert({
              key: 'gmail_access_token',
              value: credentials.access_token
            })

          // Salva la scadenza del token per il refresh preventivo
          const expiryTime = now + (credentials.expiry_date ? credentials.expiry_date - now : 55 * 60 * 1000) // default 55 min
          await supabase
            .from('scadenze_bandi_system_settings')
            .upsert({
              key: 'gmail_token_expires_at',
              value: expiryTime.toString()
            })

          // Se abbiamo anche un nuovo refresh token, salvalo
          if (credentials.refresh_token) {
            await supabase
              .from('scadenze_bandi_system_settings')
              .upsert({
                key: 'gmail_refresh_token',
                value: credentials.refresh_token
              })
          }

          console.log('✅ Token Google rinnovato automaticamente, valido fino a', new Date(expiryTime).toLocaleString())
          return credentials.access_token
        }
      } catch (refreshError: any) {
        console.error('❌ Errore refresh token:', refreshError)

        // Log più dettagliato per il debug
        if (refreshError.response?.data) {
          console.error('❌ Dettagli errore Google:', refreshError.response.data)
        }

        // Se il refresh fallisce, potrebbe essere necessaria una nuova autenticazione
        // Rimuovi i token invalidi per forzare una nuova autenticazione
        await supabase
          .from('scadenze_bandi_system_settings')
          .delete()
          .eq('key', 'gmail_access_token')

        // Se l'errore è 'invalid_grant', il refresh token è probabilmente scaduto
        if (refreshError.response?.data?.error === 'invalid_grant') {
          console.log('⚠️ Refresh token scaduto - richiesta nuova autenticazione completa')
          // Rimuovi anche il refresh token scaduto
          await supabase
            .from('scadenze_bandi_system_settings')
            .delete()
            .eq('key', 'gmail_refresh_token')
        } else {
          console.log('⚠️ Token invalidato - richiesta nuova autenticazione')
        }

        return null
      }
    }

    return null
  } catch (error) {
    console.error('❌ Errore gestione token Google:', error)
    return null
  }
}

// Funzione helper per creare un client Google Drive autenticato
export async function getAuthenticatedDriveClient() {
  const accessToken = await getValidGoogleToken()

  if (!accessToken) {
    throw new Error('Token Google non disponibile - richiesta autenticazione')
  }

  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })

  return google.drive({ version: 'v3', auth })
}

// Funzione per verificare se l'utente è autenticato con Google
export async function isGoogleAuthenticated(): Promise<boolean> {
  const token = await getValidGoogleToken()
  return token !== null
}