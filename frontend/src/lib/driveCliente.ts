import { supabaseAdmin } from './supabaseAdmin'
import { getValidGoogleToken } from './googleAuth'
import { createDriveClient, createDriveFolderInSharedDrive, findOrCreateSharedDrive, listSharedDriveFiles, uploadFileToFolder } from './googleDrive'

/**
 * Documenti dei clienti su Google Drive: Drive condiviso "Gestionale Evolvi",
 * cartella CLIENTI/<cliente>/DOCUMENTI/<categoria>. La cartella del cliente si
 * ricorda nella sua scheda (drive_cartella_id), così un cambio di
 * denominazione non crea una seconda cartella. È la stessa cartella del
 * cliente che contiene già "CONTRATTI EVOLVI".
 */

type Contesto = { token: string; driveId: string; cartelle: Map<string, string> }

export async function contestoDrive(): Promise<Contesto> {
  const token = await getValidGoogleToken()
  if (!token) throw new Error('Accesso a Google Drive non disponibile')
  const driveId = await findOrCreateSharedDrive(token, 'Gestionale Evolvi')
  return { token, driveId, cartelle: new Map() }
}

const q = (nome: string) => nome.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

async function sottocartella(c: Contesto, padre: string, nome: string): Promise<string> {
  const chiave = `${padre}/${nome}`
  const nota = c.cartelle.get(chiave)
  if (nota) return nota
  const trovate = await listSharedDriveFiles(c.token, padre, `name='${q(nome)}' and mimeType='application/vnd.google-apps.folder' and trashed=false`)
  const id = trovate.length ? trovate[0].id! : (await createDriveFolderInSharedDrive(c.token, nome, c.driveId, padre === c.driveId ? undefined : padre)).id!
  c.cartelle.set(chiave, id)
  return id
}

/** Cartella del cliente in CLIENTI (creata se manca) e salvata nella sua scheda. */
export async function cartellaCliente(c: Contesto, clienteId: string): Promise<string> {
  const chiave = `cliente:${clienteId}`
  const nota = c.cartelle.get(chiave)
  if (nota) return nota
  const { data: cliente } = await supabaseAdmin.from('scadenze_bandi_clienti').select('denominazione, drive_cartella_id').eq('id', clienteId).maybeSingle()
  if (!cliente) throw new Error('Cliente non trovato')
  let id: string | null = cliente.drive_cartella_id || null
  if (id) {
    try {
      const drive = await createDriveClient(c.token)
      const { data } = await drive.files.get({ fileId: id, fields: 'id, trashed', supportsAllDrives: true })
      if (data.trashed) id = null
    } catch {
      id = null
    }
  }
  if (!id) {
    const clienti = await sottocartella(c, c.driveId, 'CLIENTI')
    id = await sottocartella(c, clienti, (cliente.denominazione || 'Cliente senza nome').trim())
    await supabaseAdmin.from('scadenze_bandi_clienti').update({ drive_cartella_id: id }).eq('id', clienteId)
  }
  c.cartelle.set(chiave, id)
  return id
}

/** Carica un documento del cliente in CLIENTI/<cliente>/DOCUMENTI/<categoria>. */
export async function caricaDocumentoCliente(c: Contesto, clienteId: string, categoria: string, nome: string, contenuto: Buffer, mime: string) {
  const cliente = await cartellaCliente(c, clienteId)
  const documenti = await sottocartella(c, cliente, 'DOCUMENTI')
  const cartella = await sottocartella(c, documenti, (categoria || 'ALTRO').toUpperCase())
  const file = await uploadFileToFolder(c.token, cartella, nome, contenuto, mime || 'application/octet-stream')
  if (!file?.id) throw new Error('Caricamento su Drive non riuscito')
  return { id: file.id as string, url: (file.webViewLink as string) || `https://drive.google.com/file/d/${file.id}/view` }
}

/** Sposta nel cestino di Drive (ripristinabile dal Registro attività). */
export async function cestinaSuDrive(token: string, fileId: string) {
  const drive = await createDriveClient(token)
  await drive.files.update({ fileId, requestBody: { trashed: true }, supportsAllDrives: true })
}
