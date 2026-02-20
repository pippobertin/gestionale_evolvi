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
    const { bandoName, driveFolderId } = req.body

    if (!bandoName && !driveFolderId) {
      return res.status(400).json({ message: 'Nome bando o ID cartella Drive richiesto' })
    }

    // Ottieni client Drive autenticato con Service Account
    const drive = await getAuthenticatedDriveClient()

    let folderIdToDelete = driveFolderId

    // Se non abbiamo l'ID, cerchiamo la cartella per nome
    if (!folderIdToDelete && bandoName) {
      // 1. Trova il Drive Condiviso "Gestionale Evolvi"
      const drivesResponse = await drive.drives.list({
        pageSize: 100,
        fields: 'drives(id,name)'
      })

      const gestionaleEvolvi = drivesResponse.data.drives?.find(d => d.name === 'Gestionale Evolvi')

      if (!gestionaleEvolvi?.id) {
        return res.status(404).json({
          success: false,
          message: 'Drive Condiviso "Gestionale Evolvi" non trovato'
        })
      }

      // 2. Trova la cartella del bando nel Drive Condiviso
      const foldersResponse = await drive.files.list({
        q: `name='${bandoName}' and mimeType='application/vnd.google-apps.folder' and '${gestionaleEvolvi.id}' in parents and trashed=false`,
        driveId: gestionaleEvolvi.id,
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        fields: 'files(id,name)',
        pageSize: 1
      })

      const bandoFolder = foldersResponse.data.files?.[0]

      if (!bandoFolder?.id) {
        return res.status(404).json({
          success: false,
          message: `Cartella bando "${bandoName}" non trovata in Google Drive`
        })
      }

      folderIdToDelete = bandoFolder.id
    }

    // 3. Elimina la cartella e tutto il suo contenuto (ricorsivo)
    await drive.files.delete({
      fileId: folderIdToDelete,
      supportsAllDrives: true
    })

    console.log(`✅ Cartella bando ${folderIdToDelete} eliminata da Google Drive`)

    return res.status(200).json({
      success: true,
      message: `Cartella bando eliminata da Google Drive`,
      deletedFolderId: folderIdToDelete
    })

  } catch (error: any) {
    console.error('❌ Errore eliminazione bando Drive:', error)
    return res.status(500).json({
      success: false,
      message: 'Errore interno del server',
      error: error.message
    })
  }
}
