import { NextRequest } from 'next/server'
import { findOrCreateSharedDrive, listSharedDriveFiles, uploadFileToSharedDrive } from '@/lib/googleDrive'
import { getValidGoogleToken } from '@/lib/googleAuth'

export async function POST(req: NextRequest) {
  try {

    // Ottieni token Google con Service Account + fallback OAuth
    const googleAccessToken = await getValidGoogleToken()

    if (!googleAccessToken) {
      return Response.json({
        success: false,
        message: 'Google Drive non configurato - accesso non disponibile'
      }, { status: 401 })
    }

    const { bandoName, categoria, fileName, fileBuffer } = await req.json()

    if (!bandoName || !categoria || !fileName || !fileBuffer) {
      return Response.json({
        message: 'Parametri richiesti: bandoName, categoria, fileName, fileBuffer'
      }, { status: 400 })
    }

    // Converti il buffer da base64
    const buffer = Buffer.from(fileBuffer, 'base64')

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

    // 2. Trova cartella bando
    let bandoFolderId: string
    try {
      const existingBandoFolders = await listSharedDriveFiles(
        googleAccessToken,
        sharedDriveId,
        `name='${bandoName}' and mimeType='application/vnd.google-apps.folder'`
      )

      if (existingBandoFolders.length > 0) {
        bandoFolderId = existingBandoFolders[0].id!
        console.log('📁 Cartella bando trovata:', bandoFolderId)
      } else {
        return Response.json({
          success: false,
          message: `Cartella bando "${bandoName}" non trovata. Crea prima il bando.`
        }, { status: 404 })
      }
    } catch (error: any) {
      console.error('📁 Errore ricerca cartella bando:', error)
      throw error
    }

    // 3. Trova cartella categoria (NORMATIVA o ALLEGATI)
    const categoryFolderName = categoria === 'normativa' ? 'NORMATIVA' : 'ALLEGATI'
    let categoryFolderId: string

    try {
      const existingCategoryFolders = await listSharedDriveFiles(
        googleAccessToken,
        bandoFolderId,
        `name='${categoryFolderName}' and mimeType='application/vnd.google-apps.folder'`
      )

      if (existingCategoryFolders.length > 0) {
        categoryFolderId = existingCategoryFolders[0].id!
        console.log(`📁 Cartella ${categoryFolderName} trovata:`, categoryFolderId)
      } else {
        return Response.json({
          success: false,
          message: `Cartella "${categoryFolderName}" non trovata nel bando "${bandoName}".`
        }, { status: 404 })
      }
    } catch (error: any) {
      console.error(`📁 Errore ricerca cartella ${categoryFolderName}:`, error)
      throw error
    }

    // 4. Upload file nella cartella categoria
    try {
      const mimeType = getMimeType(fileName)
      const uploadResult = await uploadFileToSharedDrive(
        googleAccessToken,
        buffer,
        fileName,
        mimeType,
        categoryFolderId
      )

      console.log('📤 File caricato su Google Drive:', uploadResult)

      return Response.json({
        success: true,
        message: 'File caricato su Google Drive con successo',
        data: {
          fileId: uploadResult.id,
          fileName: uploadResult.name,
          webViewLink: uploadResult.webViewLink,
          folderPath: `Drive Condivisi > Gestionale Evolvi > ${bandoName} > ${categoryFolderName} > ${fileName}`
        }
      })

    } catch (error: any) {
      console.error('📤 Errore upload file:', error)
      throw error
    }

  } catch (error: any) {
    console.error('Errore API upload-file:', error)
    return Response.json({
      success: false,
      message: 'Errore durante upload file su Google Drive',
      error: error.message
    }, { status: 500 })
  }
}

// Helper per determinare il mime type
function getMimeType(fileName: string): string {
  const extension = fileName.toLowerCase().split('.').pop()

  const mimeTypes: { [key: string]: string } = {
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'txt': 'text/plain',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'zip': 'application/zip',
    'rar': 'application/x-rar-compressed'
  }

  return mimeTypes[extension || ''] || 'application/octet-stream'
}