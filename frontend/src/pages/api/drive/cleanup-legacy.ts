import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { findOrCreateSharedDrive, listSharedDriveFiles, deleteDriveFolder } from '@/lib/googleDrive'
import { authOptions } from '../auth/[...nextauth]'
import { supabase } from '@/lib/supabase'

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

    // 1. Trova il Drive Condiviso "Gestionale Evolvi"
    const sharedDriveId = await findOrCreateSharedDrive(session.accessToken as string)

    // 2. Lista tutte le cartelle nel Drive Condiviso
    const driveFiles = await listSharedDriveFiles(
      session.accessToken as string,
      sharedDriveId,
      sharedDriveId // Parent è il Drive stesso
    )

    const driveFolders = driveFiles.filter((f: any) =>
      f.mimeType === 'application/vnd.google-apps.folder'
    )

    // 3. Recupera tutti i bandi attivi nel database
    const { data: bandiFetch } = await supabase
      .from('scadenze_bandi_bandi')
      .select('nome, id')

    const bandiNomiDB = new Set((bandiFetch || []).map(b => b.nome))

    // 4. Trova cartelle orfane (esistono in Drive ma non nel DB)
    const cartelleOrfane = driveFolders.filter((folder: any) =>
      !bandiNomiDB.has(folder.name)
    )

    if (cartelleOrfane.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'Nessuna cartella orfana trovata',
        orphanFolders: []
      })
    }

    // 5. Elimina cartelle orfane
    const deletedFolders = []
    const failedDeletions = []

    for (const folder of cartelleOrfane) {
      try {
        await deleteDriveFolder(session.accessToken as string, folder.id!)
        deletedFolders.push({
          name: folder.name,
          id: folder.id
        })
        console.log(`✅ Cartella orfana eliminata: ${folder.name}`)
      } catch (error) {
        console.error(`❌ Errore eliminazione cartella ${folder.name}:`, error)
        failedDeletions.push({
          name: folder.name,
          id: folder.id,
          error: error instanceof Error ? error.message : 'Errore sconosciuto'
        })
      }
    }

    return res.status(200).json({
      success: true,
      message: `Pulizia completata: ${deletedFolders.length} cartelle eliminate, ${failedDeletions.length} errori`,
      deletedFolders,
      failedDeletions,
      totalOrphanFolders: cartelleOrfane.length
    })

  } catch (error) {
    console.error('Errore pulizia Drive:', error)
    return res.status(500).json({
      success: false,
      message: 'Errore interno del server',
      error: error instanceof Error ? error.message : 'Errore sconosciuto'
    })
  }
}