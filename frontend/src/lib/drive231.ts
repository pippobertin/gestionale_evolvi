import { getValidGoogleToken } from './googleAuth'
import { createDriveFolderInSharedDrive, findOrCreateSharedDrive, listSharedDriveFiles, uploadFileToFolder } from './googleDrive'

/**
 * Documenti dei registri del Modello 231 nel Drive condiviso "Gestionale Evolvi",
 * cartella MODELLO 231 > <registro> > <anno> (create se mancano).
 */
async function cartella(token: string, padre: string, nome: string, driveId: string): Promise<string> {
  const trovate = await listSharedDriveFiles(token, padre,
    `name='${nome.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`)
  if (trovate.length) return trovate[0].id!
  const creata = await createDriveFolderInSharedDrive(token, nome, driveId, padre === driveId ? undefined : padre)
  return creata.id!
}

export async function caricaDocumento231(registro: string, file: File, prefisso: string) {
  const token = await getValidGoogleToken()
  if (!token) throw new Error('Accesso a Google Drive non disponibile')
  const driveId = await findOrCreateSharedDrive(token, 'Gestionale Evolvi')
  const radice = await cartella(token, driveId, 'MODELLO 231', driveId)
  const reg = await cartella(token, radice, registro, driveId)
  const anno = await cartella(token, reg, String(new Date().getFullYear()), driveId)
  const nome = `${prefisso}_${new Date().toISOString().slice(0, 10)}_${file.name}`.replace(/[\\/:*?"<>|]/g, '_')
  const caricato = await uploadFileToFolder(token, anno, nome, Buffer.from(await file.arrayBuffer()), file.type || 'application/octet-stream')
  return { nome: file.name, id: caricato.id || null, url: caricato.webViewLink || null }
}
