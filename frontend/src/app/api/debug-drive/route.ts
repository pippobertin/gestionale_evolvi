import { NextRequest } from 'next/server'
import { getValidGoogleToken } from '@/lib/googleAuth'
import { google } from 'googleapis'

export async function GET(req: NextRequest) {
  try {
    console.log('🔍 Debug Google Drive - Inizio verifica...')

    // Test 1: Verifica token
    const googleAccessToken = await getValidGoogleToken()

    if (!googleAccessToken) {
      return Response.json({
        success: false,
        error: 'Token Google non disponibile',
        status: 'TOKEN_MISSING',
        message: 'Riconfigura Google Drive nelle impostazioni'
      })
    }

    console.log('✅ Token ottenuto:', googleAccessToken.substring(0, 20) + '...')

    // Test 2: Verifica accesso Google Drive
    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: googleAccessToken })
    const drive = google.drive({ version: 'v3', auth })

    let aboutResponse: any
    try {
      aboutResponse = await drive.about.get({ fields: 'user' })
      console.log('✅ Accesso Google Drive OK:', aboutResponse.data.user?.displayName)
    } catch (driveError: any) {
      return Response.json({
        success: false,
        error: 'Errore accesso Google Drive',
        status: 'DRIVE_ACCESS_ERROR',
        details: driveError.message
      })
    }

    // Test 3: Verifica Shared Drives
    try {
      const sharedDrivesResponse = await drive.drives.list({
        pageSize: 100,
        fields: 'drives(id,name,capabilities)'
      })

      const drives = sharedDrivesResponse.data.drives || []
      const gestionaleDrive = drives.find(d => d.name === 'Gestionale Evolvi')

      console.log('📁 Shared Drives trovati:', drives.map(d => d.name))

      if (!gestionaleDrive) {
        return Response.json({
          success: false,
          error: 'Drive "Gestionale Evolvi" non trovato',
          status: 'SHARED_DRIVE_NOT_FOUND',
          availableDrives: drives.map(d => d.name),
          message: 'Crea il Drive Condiviso "Gestionale Evolvi" o verifica i permessi'
        })
      }

      // Test 4: Verifica contenuto Drive Condiviso
      const sharedDriveFiles = await drive.files.list({
        driveId: gestionaleDrive.id,
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        corpora: 'drive',
        q: "mimeType='application/vnd.google-apps.folder'",
        pageSize: 100,
        fields: 'files(id,name,parents)'
      })

      const folders = sharedDriveFiles.data.files || []
      console.log('📂 Cartelle nel Drive Condiviso:', folders.map(f => f.name))

      return Response.json({
        success: true,
        status: 'ALL_OK',
        message: 'Google Drive configurato correttamente',
        data: {
          userEmail: aboutResponse.data.user?.displayName,
          sharedDriveId: gestionaleDrive.id,
          sharedDriveName: gestionaleDrive.name,
          foldersCount: folders.length,
          folders: folders.map(f => ({ name: f.name, id: f.id }))
        }
      })

    } catch (sharedDriveError: any) {
      return Response.json({
        success: false,
        error: 'Errore verifica Shared Drives',
        status: 'SHARED_DRIVES_ERROR',
        details: sharedDriveError.message
      })
    }

  } catch (error: any) {
    console.error('🔍 Errore debug Google Drive:', error)
    return Response.json({
      success: false,
      error: 'Errore generale verifica Google Drive',
      status: 'GENERAL_ERROR',
      details: error.message
    })
  }
}