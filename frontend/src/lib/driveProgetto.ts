import { createDriveFolderInSharedDrive, listSharedDriveFiles } from '@/lib/googleDrive'

/**
 * Cartelle Drive di un progetto (pratica):
 * Gestionale Evolvi > BANDI E PROGETTI > <anno> > <bando> > PROGETTI > <progetto>.
 * Stessa ricerca usata dalla generazione dei contratti.
 */
export async function findProjectFolder(googleAccessToken: string, bandoName: string, progettoName: string) {
  try {
    // 1. Trova Drive Condiviso
    const sharedDriveResponse = await fetch('https://www.googleapis.com/drive/v3/drives', {
      headers: {
        'Authorization': `Bearer ${googleAccessToken}`
      }
    })

    const sharedDrives = await sharedDriveResponse.json()
    const gestionaleEvolvi = sharedDrives.drives?.find((drive: any) => drive.name === 'Gestionale Evolvi')

    if (!gestionaleEvolvi) {
      return { success: false, message: 'Drive Condiviso "Gestionale Evolvi" non trovato' }
    }

    console.log('📁 Drive Condiviso trovato:', gestionaleEvolvi.id)

    // 2. Trova cartella "BANDI E PROGETTI"
    const bandiProgettiFolder = await listSharedDriveFiles(
      googleAccessToken,
      gestionaleEvolvi.id,
      "name='BANDI E PROGETTI' and mimeType='application/vnd.google-apps.folder' and trashed=false"
    )

    if (bandiProgettiFolder.length === 0) {
      return { success: false, message: 'Cartella "BANDI E PROGETTI" non trovata nel Drive Condiviso' }
    }

    console.log('📁 Cartella BANDI E PROGETTI trovata:', bandiProgettiFolder[0].id)

    // 3. Cerca cartelle anno (prova anno corrente e precedenti)
    const currentYear = new Date().getFullYear()
    let yearFolderId: string | null = null
    let foundYear: number | null = null

    // Prova anno corrente e 2 anni precedenti
    for (let year = currentYear; year >= currentYear - 2; year--) {
      const yearFolders = await listSharedDriveFiles(
        googleAccessToken,
        bandiProgettiFolder[0].id!,
        `name='${year}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
      )

      if (yearFolders.length > 0) {
        // Verifica se il bando esiste in questa cartella anno
        const bandoInYear = await listSharedDriveFiles(
          googleAccessToken,
          yearFolders[0].id!,
          `name='${bandoName.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
        )

        if (bandoInYear.length > 0) {
          yearFolderId = yearFolders[0].id!
          foundYear = year
          console.log(`📁 Cartella anno ${year} trovata con bando:`, yearFolderId)
          break
        }
      }
    }

    if (!yearFolderId) {
      return { success: false, message: `Cartella anno con bando "${bandoName}" non trovata. Verifica che il bando esista in una cartella anno.` }
    }

    // 4. Trova cartella bando dentro la cartella anno
    const bandoFolders = await listSharedDriveFiles(
      googleAccessToken,
      yearFolderId,
      `name='${bandoName.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
    )

    if (bandoFolders.length === 0) {
      return { success: false, message: `Cartella bando "${bandoName}" non trovata nella cartella anno ${foundYear}` }
    }

    console.log('📁 Cartella bando trovata:', bandoFolders[0].id)

    // 5. Trova cartella PROGETTI
    const progettiFolders = await listSharedDriveFiles(
      googleAccessToken,
      bandoFolders[0].id!,
      "name='PROGETTI' and mimeType='application/vnd.google-apps.folder' and trashed=false"
    )

    if (progettiFolders.length === 0) {
      return { success: false, message: `Cartella PROGETTI non trovata nel bando "${bandoName}"` }
    }

    console.log('📁 Cartella PROGETTI trovata:', progettiFolders[0].id)

    // 6. Trova cartella progetto
    const progettoFolders = await listSharedDriveFiles(
      googleAccessToken,
      progettiFolders[0].id!,
      `name='${progettoName.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
    )

    if (progettoFolders.length === 0) {
      return { success: false, message: `Cartella progetto "${progettoName}" non trovata in PROGETTI` }
    }

    console.log('📁 Cartella progetto trovata:', progettoFolders[0].id)

    return {
      success: true,
      sharedDriveId: gestionaleEvolvi.id,
      yearFolderId: yearFolderId,
      bandoFolderId: bandoFolders[0].id,
      progettiFolderId: progettiFolders[0].id,
      projectFolderId: progettoFolders[0].id,
      foundPath: `Gestionale Evolvi > BANDI E PROGETTI > ${foundYear} > ${bandoName} > PROGETTI > ${progettoName}`
    }

  } catch (error) {
    console.error('Errore ricerca cartella progetto:', error)
    return { success: false, message: 'Errore durante ricerca cartella progetto: ' + (error instanceof Error ? error.message : 'Unknown error') }
  }
}

/** Sottocartella del progetto (per esempio CONTRATTI o INVIO DOMANDA), creata se manca. */
export async function sottocartellaProgetto(
  googleAccessToken: string,
  sharedDriveId: string,
  projectFolderId: string,
  nome: string
): Promise<string> {
  const esistenti = await listSharedDriveFiles(
    googleAccessToken,
    projectFolderId,
    `name='${nome.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  )
  if (esistenti.length > 0) return esistenti[0].id!
  const creata = await createDriveFolderInSharedDrive(googleAccessToken, nome, sharedDriveId, projectFolderId)
  return creata.id!
}
