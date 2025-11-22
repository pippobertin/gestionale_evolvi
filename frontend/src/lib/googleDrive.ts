import { google } from 'googleapis'
import { getSession } from 'next-auth/react'

// Crea client Google Drive autenticato
export async function createDriveClient(accessToken: string) {
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: accessToken })

  return google.drive({ version: 'v3', auth })
}

// Upload file su Google Drive
export async function uploadFileToDrive(
  accessToken: string,
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  parentFolderId?: string
) {
  try {
    const drive = await createDriveClient(accessToken)

    const fileMetadata: any = {
      name: fileName,
    }

    if (parentFolderId) {
      fileMetadata.parents = [parentFolderId]
    }

    const media = {
      mimeType,
      body: require('stream').Readable.from([fileBuffer]),
    }

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: 'id,name,webViewLink,webContentLink'
    })

    return response.data
  } catch (error) {
    console.error('Errore upload Google Drive:', error)
    throw error
  }
}

// Crea cartella su Google Drive
export async function createDriveFolder(
  accessToken: string,
  folderName: string,
  parentFolderId?: string
) {
  try {
    const drive = await createDriveClient(accessToken)

    const fileMetadata: any = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    }

    if (parentFolderId) {
      fileMetadata.parents = [parentFolderId]
    }

    const response = await drive.files.create({
      requestBody: fileMetadata,
      fields: 'id,name'
    })

    return response.data
  } catch (error) {
    console.error('Errore creazione cartella Google Drive:', error)
    throw error
  }
}

// Ottieni lista file da Google Drive
export async function listDriveFiles(
  accessToken: string,
  folderId?: string,
  query?: string
) {
  try {
    const drive = await createDriveClient(accessToken)

    let q = query || ''
    if (folderId && folderId !== 'root') {
      const parentQuery = `'${folderId}' in parents`
      q = q ? `${parentQuery} and ${q}` : parentQuery
    } else if (folderId === 'root' && query) {
      q = query
    } else if (folderId === 'root') {
      q = "'root' in parents"
    }

    console.log('🔍 Drive query:', q)

    const response = await drive.files.list({
      q,
      fields: 'files(id,name,mimeType,modifiedTime,webViewLink,webContentLink)',
      orderBy: 'modifiedTime desc'
    })

    console.log('📁 Files found:', response.data.files?.length || 0)
    return response.data.files || []
  } catch (error) {
    console.error('Errore lista file Google Drive:', error)
    throw error
  }
}

// Ottieni URL di preview per un file
export function getDrivePreviewUrl(fileId: string) {
  return `https://drive.google.com/file/d/${fileId}/preview`
}

// Ottieni URL di visualizzazione per un file
export function getDriveViewUrl(fileId: string) {
  return `https://drive.google.com/file/d/${fileId}/view`
}

// Elimina cartella da Google Drive con retry per gestire timing issues
export async function deleteDriveFolder(accessToken: string, folderId: string) {
  const maxRetries = 3
  const retryDelay = 1000 // 1 secondo

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const drive = await createDriveClient(accessToken)

      // Prima verifica che la cartella esista ancora
      try {
        await drive.files.get({
          fileId: folderId,
          fields: 'id,name,trashed',
          supportsAllDrives: true
        })
        console.log(`🔍 Tentativo ${attempt}: Cartella ${folderId} esiste, procedo con eliminazione`)
      } catch (getError: any) {
        if (getError.code === 404) {
          console.log(`⚠️ Cartella ${folderId} già eliminata o non esistente`)
          return true
        }
        throw getError
      }

      // Procedi con l'eliminazione
      await drive.files.delete({
        fileId: folderId,
        supportsAllDrives: true
      })

      console.log(`✅ Cartella Drive eliminata: ${folderId}`)
      return true

    } catch (error: any) {
      console.error(`❌ Tentativo ${attempt} fallito:`, error.message)

      if (error.code === 404) {
        console.log(`⚠️ Cartella ${folderId} non trovata - probabilmente già eliminata`)
        return true
      }

      // Se è l'ultimo tentativo, rilancia l'errore
      if (attempt === maxRetries) {
        console.error(`❌ Tutti i ${maxRetries} tentativi falliti per eliminazione ${folderId}`)
        throw error
      }

      // Attendi prima del prossimo tentativo
      console.log(`⏳ Attendo ${retryDelay}ms prima del tentativo ${attempt + 1}...`)
      await new Promise(resolve => setTimeout(resolve, retryDelay))
    }
  }

  throw new Error(`Fallimento eliminazione cartella ${folderId} dopo ${maxRetries} tentativi`)
}

// Rinomina cartella su Google Drive
export async function renameDriveFolder(accessToken: string, folderId: string, newName: string) {
  try {
    const drive = await createDriveClient(accessToken)

    const response = await drive.files.update({
      fileId: folderId,
      requestBody: {
        name: newName
      }
    })

    console.log(`✅ Cartella Drive rinominata: ${folderId} → ${newName}`)
    return response.data
  } catch (error) {
    console.error('Errore rinomina cartella Drive:', error)
    throw error
  }
}

// Trova cartella per nome nel Drive Condiviso
export async function findFolderInSharedDrive(accessToken: string, sharedDriveId: string, folderName: string) {
  try {
    const drive = await createDriveClient(accessToken)

    const response = await drive.files.list({
      q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and parents='${sharedDriveId}' and trashed=false`,
      driveId: sharedDriveId,
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      fields: 'files(id,name)'
    })

    return response.data.files?.[0] || null
  } catch (error) {
    console.error('Errore ricerca cartella Drive:', error)
    throw error
  }
}

// Trova Drive Condiviso "Gestionale Evolvi"
export async function findOrCreateSharedDrive(accessToken: string, sharedDriveName: string = 'Gestionale Evolvi') {
  try {
    console.log('🔑 Token Drive ricevuto:', accessToken?.substring(0, 20) + '...')
    const drive = await createDriveClient(accessToken)

    // Lista tutti i Drive Condivisi
    console.log('📁 Tentativo accesso ai Drive Condivisi...')
    const response = await drive.drives.list({
      fields: 'drives(id,name)'
    })

    const drives = response.data.drives || []
    console.log('📁 Drive Condivisi trovati:', drives)

    // Cerca il Drive "Gestionale Evolvi"
    const targetDrive = drives.find(d => d.name === sharedDriveName)

    if (targetDrive) {
      console.log(`✅ Drive Condiviso "${sharedDriveName}" trovato:`, targetDrive.id)
      return targetDrive.id!
    } else {
      console.log(`⚠️ Drive Condiviso "${sharedDriveName}" non trovato, creazione automatica...`)

      // Crea il Drive Condiviso automaticamente
      const createResponse = await drive.drives.create({
        requestId: `gestionale-evolvi-${Date.now()}`, // ID univoco per evitare duplicati
        requestBody: {
          name: sharedDriveName
        }
      })

      if (createResponse.data && createResponse.data.id) {
        console.log(`✅ Drive Condiviso "${sharedDriveName}" creato:`, createResponse.data.id)
        return createResponse.data.id
      } else {
        throw new Error(`Impossibile creare Drive Condiviso "${sharedDriveName}"`)
      }
    }
  } catch (error) {
    console.error('Errore ricerca Drive Condiviso:', error)
    throw error
  }
}

// Crea cartella su Drive Condiviso
export async function createDriveFolderInSharedDrive(
  accessToken: string,
  folderName: string,
  sharedDriveId: string,
  parentFolderId?: string
) {
  try {
    const drive = await createDriveClient(accessToken)

    const fileMetadata: any = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentFolderId ? [parentFolderId] : [sharedDriveId]
    }

    const response = await drive.files.create({
      requestBody: fileMetadata,
      fields: 'id,name',
      supportsAllDrives: true
    })

    return response.data
  } catch (error) {
    console.error('Errore creazione cartella Drive Condiviso:', error)
    throw error
  }
}

// Upload file su Drive Condiviso
export async function uploadFileToSharedDrive(
  accessToken: string,
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  parentFolderId: string
) {
  try {
    const drive = await createDriveClient(accessToken)

    const fileMetadata = {
      name: fileName,
      parents: [parentFolderId]
    }

    const media = {
      mimeType,
      body: require('stream').Readable.from([fileBuffer]),
    }

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: 'id,name,webViewLink,webContentLink',
      supportsAllDrives: true
    })

    return response.data
  } catch (error) {
    console.error('Errore upload Drive Condiviso:', error)
    throw error
  }
}

// Lista file in Drive Condiviso
export async function listSharedDriveFiles(
  accessToken: string,
  parentFolderId: string,
  query?: string
) {
  try {
    const drive = await createDriveClient(accessToken)

    let q = query || ''
    if (parentFolderId) {
      const parentQuery = `'${parentFolderId}' in parents`
      q = q ? `${parentQuery} and ${q}` : parentQuery
    }

    console.log('🔍 Shared Drive query:', q)

    const response = await drive.files.list({
      q,
      fields: 'files(id,name,mimeType,modifiedTime,webViewLink,webContentLink)',
      orderBy: 'modifiedTime desc',
      includeItemsFromAllDrives: true,
      supportsAllDrives: true
    })

    console.log('📁 Files found in Shared Drive:', response.data.files?.length || 0)
    return response.data.files || []
  } catch (error) {
    console.error('Errore lista file Drive Condiviso:', error)
    throw error
  }
}

// Copia file da una cartella Drive ad un'altra
export async function copyFileToFolder(
  accessToken: string,
  sourceFileId: string,
  destinationFolderId: string,
  newFileName?: string
) {
  try {
    const drive = await createDriveClient(accessToken)

    // Prima ottieni le informazioni del file sorgente con supporto per Drive Condivisi
    const sourceFile = await drive.files.get({
      fileId: sourceFileId,
      fields: 'name,mimeType,webViewLink,webContentLink',
      supportsAllDrives: true
    })

    // Copia il file con supporto per Drive Condivisi
    const copyRequest = {
      parents: [destinationFolderId],
      name: newFileName || sourceFile.data.name
    }

    const response = await drive.files.copy({
      fileId: sourceFileId,
      requestBody: copyRequest,
      fields: 'id,name,mimeType,webViewLink,webContentLink,modifiedTime',
      supportsAllDrives: true
    })

    console.log(`📋 File copiato: ${sourceFile.data.name} → ${response.data.name}`)
    return response.data
  } catch (error) {
    console.error('Errore copia file Drive:', error)
    throw error
  }
}