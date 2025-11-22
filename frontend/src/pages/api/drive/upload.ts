import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { uploadFileToDrive, createDriveFolder } from '@/lib/googleDrive'
import { authOptions } from '../auth/[...nextauth]'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const session = await getServerSession(req, res, authOptions)

    console.log('🔍 Session debug:', {
      hasSession: !!session,
      email: session?.user?.email,
      hasAccessToken: !!(session as any)?.accessToken,
      sessionKeys: session ? Object.keys(session) : 'no session'
    })

    if (!(session as any)?.accessToken) {
      return res.status(401).json({ message: 'Non autenticato con Google' })
    }

    const { fileName, fileBuffer, mimeType, bandoName, projectName, folderType } = req.body

    if (!bandoName) {
      return res.status(400).json({ message: 'Nome bando richiesto' })
    }

    // 1. Trova cartella principale "Gestionale Evolvi"
    let mainFolderId: string
    try {
      const { listDriveFiles } = await import('@/lib/googleDrive')
      const existingFolders = await listDriveFiles(
        session.accessToken as string,
        'root',
        "name='Gestionale Evolvi' and mimeType='application/vnd.google-apps.folder'"
      )

      if (existingFolders.length > 0) {
        mainFolderId = existingFolders[0].id!
        console.log('📁 Cartella principale trovata:', mainFolderId)
      } else {
        return res.status(404).json({
          success: false,
          message: 'Cartella "Gestionale Evolvi" non trovata. Crea prima la struttura.'
        })
      }
    } catch (error: any) {
      console.error('📁 Errore ricerca cartella principale:', error)
      throw error
    }

    // 2. Trova cartella bando
    let bandoFolderId: string
    try {
      const { listDriveFiles } = await import('@/lib/googleDrive')
      const existingBandoFolders = await listDriveFiles(
        session.accessToken as string,
        mainFolderId,
        `name='${bandoName}' and mimeType='application/vnd.google-apps.folder'`
      )

      if (existingBandoFolders.length > 0) {
        bandoFolderId = existingBandoFolders[0].id!
        console.log('📁 Cartella bando trovata:', bandoFolderId)
      } else {
        return res.status(404).json({
          success: false,
          message: `Cartella bando "${bandoName}" non trovata. Crea prima il bando.`
        })
      }
    } catch (error: any) {
      console.error('📁 Errore ricerca cartella bando:', error)
      throw error
    }

    // 3. Determina cartella di destinazione basata su tipo
    let targetFolderId: string
    let folderPath: string

    if (projectName) {
      // Upload per progetto - vai nelle sottocartelle del progetto
      try {
        const { listDriveFiles } = await import('@/lib/googleDrive')

        // Trova cartella PROGETTI
        const progettiFolders = await listDriveFiles(
          session.accessToken as string,
          bandoFolderId,
          "name='PROGETTI' and mimeType='application/vnd.google-apps.folder'"
        )

        if (progettiFolders.length === 0) {
          return res.status(404).json({
            success: false,
            message: 'Cartella PROGETTI non trovata. Crea prima il progetto.'
          })
        }

        const progettiFolderId = progettiFolders[0].id!

        // Trova cartella progetto
        const projectFolders = await listDriveFiles(
          session.accessToken as string,
          progettiFolderId,
          `name='${projectName}' and mimeType='application/vnd.google-apps.folder'`
        )

        if (projectFolders.length === 0) {
          return res.status(404).json({
            success: false,
            message: `Cartella progetto "${projectName}" non trovata. Crea prima il progetto.`
          })
        }

        const projectFolderId = projectFolders[0].id!

        // Trova sottocartella del progetto (ALLEGATI o DOC AMM)
        if (folderType && (folderType === 'ALLEGATI' || folderType === 'DOC AMM')) {
          const subFolders = await listDriveFiles(
            session.accessToken as string,
            projectFolderId,
            `name='${folderType}' and mimeType='application/vnd.google-apps.folder'`
          )

          if (subFolders.length > 0) {
            targetFolderId = subFolders[0].id!
            folderPath = `Drive > Gestionale Evolvi > ${bandoName} > PROGETTI > ${projectName} > ${folderType}`
          } else {
            targetFolderId = projectFolderId
            folderPath = `Drive > Gestionale Evolvi > ${bandoName} > PROGETTI > ${projectName}`
          }
        } else {
          targetFolderId = projectFolderId
          folderPath = `Drive > Gestionale Evolvi > ${bandoName} > PROGETTI > ${projectName}`
        }

      } catch (error: any) {
        console.error('📂 Errore ricerca cartelle progetto:', error)
        throw error
      }
    } else {
      // Upload per bando - vai nelle sottocartelle del bando
      try {
        if (folderType && (folderType === 'NORMATIVA' || folderType === 'ALLEGATI')) {
          const { listDriveFiles } = await import('@/lib/googleDrive')
          const subFolders = await listDriveFiles(
            session.accessToken as string,
            bandoFolderId,
            `name='${folderType}' and mimeType='application/vnd.google-apps.folder'`
          )

          if (subFolders.length > 0) {
            targetFolderId = subFolders[0].id!
            folderPath = `Drive > Gestionale Evolvi > ${bandoName} > ${folderType}`
          } else {
            targetFolderId = bandoFolderId
            folderPath = `Drive > Gestionale Evolvi > ${bandoName}`
          }
        } else {
          targetFolderId = bandoFolderId
          folderPath = `Drive > Gestionale Evolvi > ${bandoName}`
        }
      } catch (error: any) {
        console.error('📂 Errore cartelle bando:', error)
        targetFolderId = bandoFolderId
        folderPath = `Drive > Gestionale Evolvi > ${bandoName}`
      }
    }

    // Upload file nella cartella di destinazione
    const uploadResult = await uploadFileToDrive(
      session.accessToken as string,
      Buffer.from(fileBuffer, 'base64'),
      fileName,
      mimeType,
      targetFolderId
    )

    console.log('📄 File caricato:', {
      fileId: uploadResult.id,
      fileName: uploadResult.name,
      webViewLink: uploadResult.webViewLink,
      folderPath: folderPath
    })

    res.status(200).json({
      success: true,
      file: uploadResult,
      message: 'File caricato su Google Drive con successo',
      debug: {
        userEmail: session?.user?.email,
        bandoName: bandoName,
        projectName: projectName || 'N/A',
        folderType: folderType || 'N/A',
        fileName: fileName,
        fileId: uploadResult.id,
        directLink: `https://drive.google.com/file/d/${uploadResult.id}/view`,
        folderPath: folderPath
      }
    })

  } catch (error: any) {
    console.error('Errore API upload Drive:', error)
    res.status(500).json({
      success: false,
      message: 'Errore durante upload su Google Drive',
      error: error.message
    })
  }
}