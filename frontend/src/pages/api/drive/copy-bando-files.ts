import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { findOrCreateSharedDrive, listSharedDriveFiles, createDriveClient } from '@/lib/googleDrive'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const session = await getServerSession(req, res, authOptions)

    if (!(session as any)?.accessToken) {
      return res.status(401).json({ message: 'Non autenticato con Google' })
    }

    const { bandoName, progettoName } = req.body

    if (!bandoName || !progettoName) {
      return res.status(400).json({
        message: 'Parametri richiesti: bandoName, progettoName'
      })
    }

    // Session is guaranteed non-null after the check above
    const accessToken = session!.accessToken as string

    // 1. Trova il Drive Condiviso "Gestionale Evolvi"
    let sharedDriveId: string
    try {
      sharedDriveId = await findOrCreateSharedDrive(accessToken, 'Gestionale Evolvi')
      console.log('📁 Drive Condiviso trovato:', sharedDriveId)
    } catch (error: any) {
      console.error('📁 Errore Drive Condiviso:', error)
      return res.status(404).json({
        success: false,
        message: 'Drive Condiviso "Gestionale Evolvi" non trovato.'
      })
    }

    // 2. Trova cartella bando
    let bandoFolderId: string
    try {
      const existingBandoFolders = await listSharedDriveFiles(
        accessToken,
        sharedDriveId,
        `name='${bandoName}' and mimeType='application/vnd.google-apps.folder'`
      )

      if (existingBandoFolders.length > 0) {
        bandoFolderId = existingBandoFolders[0].id!
        console.log('📁 Cartella bando trovata:', bandoFolderId)
      } else {
        return res.status(404).json({
          success: false,
          message: `Cartella bando "${bandoName}" non trovata.`
        })
      }
    } catch (error: any) {
      console.error('📁 Errore ricerca cartella bando:', error)
      throw error
    }

    // 3. Trova cartella ALLEGATI del bando (sorgente)
    let bandoAllegatiFolderId: string
    try {
      const bandoAllegatifolders = await listSharedDriveFiles(
        accessToken,
        bandoFolderId,
        `name='ALLEGATI' and mimeType='application/vnd.google-apps.folder'`
      )

      if (bandoAllegatifolders.length > 0) {
        bandoAllegatiFolderId = bandoAllegatifolders[0].id!
        console.log('📁 Cartella ALLEGATI bando trovata:', bandoAllegatiFolderId)
      } else {
        return res.status(200).json({
          success: true,
          message: 'Nessuna cartella ALLEGATI trovata nel bando, niente da copiare.',
          filesCopied: 0
        })
      }
    } catch (error: any) {
      console.error('📁 Errore ricerca cartella ALLEGATI bando:', error)
      throw error
    }

    // 4. Trova cartella PROGETTI del bando
    let progettiFolderId: string
    try {
      const progettifolders = await listSharedDriveFiles(
        accessToken,
        bandoFolderId,
        `name='PROGETTI' and mimeType='application/vnd.google-apps.folder'`
      )

      if (progettifolders.length > 0) {
        progettiFolderId = progettifolders[0].id!
        console.log('📁 Cartella PROGETTI trovata:', progettiFolderId)
      } else {
        return res.status(404).json({
          success: false,
          message: `Cartella PROGETTI non trovata nel bando "${bandoName}".`
        })
      }
    } catch (error: any) {
      console.error('📁 Errore ricerca cartella PROGETTI:', error)
      throw error
    }

    // 5. Trova cartella progetto
    let progettoFolderId: string
    try {
      const progettoFolders = await listSharedDriveFiles(
        accessToken,
        progettiFolderId,
        `name='${progettoName}' and mimeType='application/vnd.google-apps.folder'`
      )

      if (progettoFolders.length > 0) {
        progettoFolderId = progettoFolders[0].id!
        console.log('📁 Cartella progetto trovata:', progettoFolderId)
      } else {
        return res.status(404).json({
          success: false,
          message: `Cartella progetto "${progettoName}" non trovata.`
        })
      }
    } catch (error: any) {
      console.error('📁 Errore ricerca cartella progetto:', error)
      throw error
    }

    // 6. Trova cartella ALLEGATI del progetto (destinazione)
    let progettoAllegatiFolderId: string
    try {
      const progettoAllegatifolders = await listSharedDriveFiles(
        accessToken,
        progettoFolderId,
        `name='ALLEGATI' and mimeType='application/vnd.google-apps.folder'`
      )

      if (progettoAllegatifolders.length > 0) {
        progettoAllegatiFolderId = progettoAllegatifolders[0].id!
        console.log('📁 Cartella ALLEGATI progetto trovata:', progettoAllegatiFolderId)
      } else {
        return res.status(404).json({
          success: false,
          message: `Cartella ALLEGATI del progetto "${progettoName}" non trovata.`
        })
      }
    } catch (error: any) {
      console.error('📁 Errore ricerca cartella ALLEGATI progetto:', error)
      throw error
    }

    // 7. Lista tutti i file nella cartella ALLEGATI del bando
    const allegatiFiles = await listSharedDriveFiles(
      accessToken,
      bandoAllegatiFolderId,
      `mimeType != 'application/vnd.google-apps.folder'`
    )

    console.log(`📄 Trovati ${allegatiFiles.length} file da copiare nella cartella ALLEGATI del bando`)

    // 8. Copia ogni file nella cartella ALLEGATI del progetto
    const drive = await createDriveClient(accessToken)
    const copiedFiles = []

    for (const file of allegatiFiles) {
      try {
        const copyResponse = await drive.files.copy({
          fileId: file.id!,
          requestBody: {
            name: file.name,
            parents: [progettoAllegatiFolderId]
          },
          supportsAllDrives: true
        })

        copiedFiles.push({
          originalId: file.id,
          originalName: file.name,
          newId: copyResponse.data.id,
          newName: copyResponse.data.name
        })

        console.log(`📄 File copiato: ${file.name}`)
      } catch (copyError) {
        console.error(`❌ Errore copia file ${file.name}:`, copyError)
      }
    }

    res.status(200).json({
      success: true,
      message: `Copiati ${copiedFiles.length} file dalla cartella ALLEGATI del bando alla cartella ALLEGATI del progetto`,
      data: {
        bandoName,
        progettoName,
        totalFiles: allegatiFiles.length,
        filesCopied: copiedFiles.length,
        copiedFiles
      }
    })

  } catch (error: any) {
    console.error('Errore API copy-bando-files:', error)
    res.status(500).json({
      success: false,
      message: 'Errore durante copia file da bando a progetto',
      error: error.message
    })
  }
}