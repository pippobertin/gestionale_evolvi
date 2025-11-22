import { NextRequest } from 'next/server'
import { findOrCreateSharedDrive, createDriveFolderInSharedDrive, listSharedDriveFiles } from '@/lib/googleDrive'
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

    const { bandoName } = await req.json()

    if (!bandoName) {
      return Response.json({
        success: false,
        message: 'Nome bando richiesto'
      }, { status: 400 })
    }

    console.log(`🔑 Token Drive ricevuto: ${googleAccessToken.substring(0, 20)}...`)

    // 1. Trova il Drive Condiviso "Gestionale Evolvi"
    let sharedDriveId: string
    try {
      sharedDriveId = await findOrCreateSharedDrive(googleAccessToken, 'Gestionale Evolvi')
      console.log('📁 Drive Condiviso trovato:', sharedDriveId)
    } catch (error: any) {
      console.error('📁 Errore Drive Condiviso:', error)
      return Response.json({
        success: false,
        message: 'Drive Condiviso "Gestionale Evolvi" non trovato. Crealo manualmente in Google Drive e assicurati che l\'account info@blmproject.com abbia accesso.'
      }, { status: 404 })
    }

    // 2. Cerca o crea cartella bando nel Drive Condiviso
    let bandoFolderId: string
    try {
      const existingBandoFolders = await listSharedDriveFiles(
        googleAccessToken,
        sharedDriveId,
        `name='${bandoName}' and mimeType='application/vnd.google-apps.folder'`
      )

      if (existingBandoFolders.length > 0) {
        bandoFolderId = existingBandoFolders[0].id!
        console.log('📁 Cartella bando esistente trovata:', bandoFolderId)
      } else {
        const bandoFolderData = await createDriveFolderInSharedDrive(
          googleAccessToken,
          bandoName,
          sharedDriveId
        )
        bandoFolderId = bandoFolderData.id!
        console.log('📁 Cartella bando creata:', bandoFolderId)
      }
    } catch (error: any) {
      console.error('📁 Errore cartella bando:', error)
      throw error
    }

    // 3. Crea sottocartelle del bando
    const subFolders = ['NORMATIVA', 'ALLEGATI']
    const createdSubFolders: any = {}

    for (const folderName of subFolders) {
      try {
        // Controlla se la sottocartella esiste già
        const existingSubFolders = await listSharedDriveFiles(
          googleAccessToken,
          bandoFolderId,
          `name='${folderName}' and mimeType='application/vnd.google-apps.folder'`
        )

        if (existingSubFolders.length > 0) {
          createdSubFolders[folderName] = existingSubFolders[0].id!
          console.log(`📂 Sottocartella ${folderName} esistente trovata:`, createdSubFolders[folderName])
        } else {
          const subFolderData = await createDriveFolderInSharedDrive(
            googleAccessToken,
            folderName,
            sharedDriveId,
            bandoFolderId
          )
          createdSubFolders[folderName] = subFolderData.id!
          console.log(`📂 Sottocartella ${folderName} creata:`, createdSubFolders[folderName])
        }
      } catch (error: any) {
        console.error(`📂 Errore sottocartella ${folderName}:`, error)
        // Continua con le altre cartelle anche se una fallisce
      }
    }

    return Response.json({
      success: true,
      message: 'Struttura bando creata su Google Drive',
      data: {
        bandoName,
        bandoFolderId,
        subFolders: createdSubFolders,
        folderPath: `Drive Condivisi > Gestionale Evolvi > ${bandoName}`
      }
    })

  } catch (error: any) {
    console.error('Errore API create-bando:', error)
    return Response.json({
      success: false,
      message: 'Errore durante creazione struttura bando',
      error: error.message
    }, { status: 500 })
  }
}