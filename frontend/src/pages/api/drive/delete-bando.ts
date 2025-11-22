import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { deleteDriveFolder, findOrCreateSharedDrive, findFolderInSharedDrive } from '@/lib/googleDrive'
import { authOptions } from '../auth/[...nextauth]'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const session = await getServerSession(req, res, authOptions)

    if (!(session as any)?.accessToken) {
      return res.status(401).json({ message: 'Non autenticato con Google' })
    }

    const { bandoName, driveFolderId } = req.body

    if (!bandoName && !driveFolderId) {
      return res.status(400).json({ message: 'Nome bando o ID cartella Drive richiesto' })
    }

    let folderIdToDelete = driveFolderId

    // Se non abbiamo l'ID, cerchiamo la cartella per nome
    if (!folderIdToDelete && bandoName) {
      // 1. Trova il Drive Condiviso "Gestionale Evolvi"
      const sharedDriveId = await findOrCreateSharedDrive(session.accessToken as string)

      // 2. Trova la cartella del bando
      const bandoFolder = await findFolderInSharedDrive(
        session.accessToken as string,
        sharedDriveId,
        bandoName
      )

      if (!bandoFolder) {
        return res.status(404).json({
          success: false,
          message: `Cartella bando "${bandoName}" non trovata in Google Drive`
        })
      }

      folderIdToDelete = bandoFolder.id!
    }

    // 3. Elimina la cartella e tutto il suo contenuto
    await deleteDriveFolder(session.accessToken as string, folderIdToDelete)

    return res.status(200).json({
      success: true,
      message: `Cartella bando eliminata da Google Drive`,
      deletedFolderId: folderIdToDelete
    })

  } catch (error) {
    console.error('Errore eliminazione bando Drive:', error)
    return res.status(500).json({
      success: false,
      message: 'Errore interno del server'
    })
  }
}