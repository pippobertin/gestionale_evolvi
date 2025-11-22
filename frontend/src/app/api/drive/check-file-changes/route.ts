import { NextRequest } from 'next/server'
import { google } from 'googleapis'
import { getValidGoogleToken } from '@/lib/googleAuth'

export async function POST(req: NextRequest) {
  try {
    // Ottieni token Google con refresh automatico
    const googleAccessToken = await getValidGoogleToken()

    if (!googleAccessToken) {
      return Response.json({
        success: false,
        message: 'Google Drive non configurato o token scaduto - riconnetti dalle impostazioni'
      }, { status: 401 })
    }

    const { fileId, lastChecked } = await req.json()

    if (!fileId) {
      return Response.json({
        success: false,
        message: 'ID file richiesto'
      }, { status: 400 })
    }

    // Configura client Google Drive
    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: googleAccessToken })
    const drive = google.drive({ version: 'v3', auth })

    try {
      // Ottieni informazioni aggiornate del file
      const fileResponse = await drive.files.get({
        fileId: fileId,
        fields: 'id,name,modifiedTime,size,webViewLink,webContentLink,mimeType',
        supportsAllDrives: true
      })

      const file = fileResponse.data
      const currentModifiedTime = file.modifiedTime

      // Confronta con l'ultima verifica
      let hasChanges = false
      if (lastChecked && currentModifiedTime) {
        const lastCheckedDate = new Date(lastChecked)
        const currentModifiedDate = new Date(currentModifiedTime)
        hasChanges = currentModifiedDate > lastCheckedDate
      } else {
        // Se non abbiamo una data di ultima verifica, considera sempre modificato
        hasChanges = true
      }

      console.log(`🔍 File check - ${file.name}:`)
      console.log(`   Last checked: ${lastChecked || 'mai'}`)
      console.log(`   Modified: ${currentModifiedTime}`)
      console.log(`   Has changes: ${hasChanges}`)

      return Response.json({
        success: true,
        hasChanges,
        modifiedTime: currentModifiedTime,
        file: {
          id: file.id,
          name: file.name,
          size: file.size,
          webViewLink: file.webViewLink,
          webContentLink: file.webContentLink,
          mimeType: file.mimeType
        }
      })

    } catch (driveError: any) {
      console.error('❌ Errore accesso file Drive:', driveError)

      if (driveError.code === 404) {
        return Response.json({
          success: false,
          message: 'File non trovato su Google Drive',
          hasChanges: false
        }, { status: 404 })
      }

      if (driveError.code === 403) {
        return Response.json({
          success: false,
          message: 'Accesso negato al file su Google Drive',
          hasChanges: false
        }, { status: 403 })
      }

      throw driveError
    }

  } catch (error: any) {
    console.error('Errore API check-file-changes:', error)
    return Response.json({
      success: false,
      message: 'Errore durante controllo modifiche file',
      error: error.message,
      hasChanges: false
    }, { status: 500 })
  }
}