import { NextApiRequest, NextApiResponse } from 'next'
import { getAuthenticatedDriveClient } from '@/lib/googleAuth'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const { bandoName, progettoNome, driveFolderId } = req.body

    if (!driveFolderId && (!bandoName || !progettoNome)) {
      return res.status(400).json({
        message: 'ID cartella Drive o (nome bando + nome progetto) richiesti'
      })
    }

    // Ottieni client Drive autenticato con Service Account
    const drive = await getAuthenticatedDriveClient()

    let folderIdToDelete = driveFolderId

    // Se non abbiamo l'ID, cerchiamo la cartella per nome
    if (!folderIdToDelete && progettoNome) {
      console.log(`🗑️ Ricerca cartella progetto "${progettoNome}" (bando: "${bandoName || 'N/A'}")`)

      // 1. Trova il Drive Condiviso "Gestionale Evolvi"
      const drivesResponse = await drive.drives.list({
        pageSize: 100,
        fields: 'drives(id,name)'
      })

      const gestionaleDrive = drivesResponse.data.drives?.find(d => d.name === 'Gestionale Evolvi')

      if (!gestionaleDrive?.id) {
        console.log('❌ Drive Condiviso "Gestionale Evolvi" non trovato')
        return res.status(404).json({
          success: false,
          message: 'Drive Condiviso "Gestionale Evolvi" non trovato'
        })
      }

      const sharedDriveId = gestionaleDrive.id
      console.log(`📁 Drive Condiviso trovato: ${sharedDriveId}`)

      // 2. Ricerca diretta cartella progetto in tutto il Drive
      console.log(`🔍 Ricerca diretta cartella progetto "${progettoNome}" nel Drive Condiviso`)
      const directSearchResponse = await drive.files.list({
        driveId: sharedDriveId,
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        corpora: 'drive',
        q: `name='${progettoNome}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        pageSize: 100,
        fields: 'files(id,name,parents,trashed)'
      })

      console.log(`📊 Ricerca diretta: trovati ${directSearchResponse.data.files?.length || 0} risultati`)

      // Prendi la prima cartella valida (non cestinata)
      const validFolder = directSearchResponse.data.files?.find(f => !f.trashed)

      if (validFolder?.id) {
        console.log(`🎯 Cartella progetto trovata: ${validFolder.id}`)
        folderIdToDelete = validFolder.id
      }

      // 3. Fallback: cerca tramite struttura bando > PROGETTI > progetto
      if (!folderIdToDelete && bandoName) {
        console.log(`🔍 Fallback: ricerca tramite struttura bando "${bandoName}"`)

        // Trova cartella bando
        const bandoSearchResponse = await drive.files.list({
          driveId: sharedDriveId,
          includeItemsFromAllDrives: true,
          supportsAllDrives: true,
          corpora: 'drive',
          q: `name='${bandoName}' and mimeType='application/vnd.google-apps.folder' and '${sharedDriveId}' in parents and trashed=false`,
          pageSize: 1,
          fields: 'files(id,name)'
        })

        const bandoFolder = bandoSearchResponse.data.files?.[0]

        if (bandoFolder?.id) {
          console.log(`📁 Cartella bando trovata: ${bandoFolder.name} (${bandoFolder.id})`)

          // Cerca cartella PROGETTI dentro il bando
          const progettiResponse = await drive.files.list({
            driveId: sharedDriveId,
            includeItemsFromAllDrives: true,
            supportsAllDrives: true,
            corpora: 'drive',
            q: `'${bandoFolder.id}' in parents and name='PROGETTI' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            pageSize: 1,
            fields: 'files(id,name)'
          })

          const progettiFolder = progettiResponse.data.files?.[0]

          if (progettiFolder?.id) {
            console.log(`📁 Cartella PROGETTI trovata: ${progettiFolder.id}`)

            // Cerca la cartella del progetto dentro PROGETTI
            const progettoResponse = await drive.files.list({
              driveId: sharedDriveId,
              includeItemsFromAllDrives: true,
              supportsAllDrives: true,
              corpora: 'drive',
              q: `'${progettiFolder.id}' in parents and name='${progettoNome}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
              pageSize: 1,
              fields: 'files(id,name)'
            })

            const progettoFolder = progettoResponse.data.files?.[0]

            if (progettoFolder?.id) {
              console.log(`🎯 Cartella progetto trovata tramite bando: ${progettoFolder.id}`)
              folderIdToDelete = progettoFolder.id
            }
          }
        }
      }

      if (!folderIdToDelete) {
        console.log(`❌ Cartella progetto "${progettoNome}" non trovata con nessun metodo`)
        return res.status(404).json({
          success: false,
          message: `Cartella progetto "${progettoNome}" non trovata in Google Drive`
        })
      }
    }

    // 4. Elimina la cartella progetto e tutto il suo contenuto (ricorsivo)
    console.log(`🗑️ Eliminazione cartella Drive ID: ${folderIdToDelete}`)
    await drive.files.delete({
      fileId: folderIdToDelete,
      supportsAllDrives: true
    })

    console.log(`✅ Cartella progetto eliminata con successo`)
    return res.status(200).json({
      success: true,
      message: `Cartella progetto eliminata da Google Drive`,
      deletedFolderId: folderIdToDelete
    })

  } catch (error: any) {
    console.error('❌ Errore eliminazione progetto Drive:', error)
    return res.status(500).json({
      success: false,
      message: 'Errore interno del server',
      error: error.message
    })
  }
}
