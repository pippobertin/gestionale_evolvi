import { NextRequest } from 'next/server'
import { findOrCreateSharedDrive, createDriveFolderInSharedDrive, listSharedDriveFiles, copyFileToFolder } from '@/lib/googleDrive'
import { getValidGoogleToken } from '@/lib/googleAuth'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    // Ottieni token Google con refresh automatico
    const googleAccessToken = await getValidGoogleToken()

    if (!googleAccessToken) {
      return Response.json({
        success: false,
        message: 'Google Drive non configurato o token scaduto - riconnetti dalle impostazioni'
      }, { status: 401 })
    }

    const { bandoName, progettoName, progettoId } = await req.json()

    if (!bandoName || !progettoName) {
      return Response.json({ message: 'Nome bando e nome progetto richiesti' }, { status: 400 })
    }

    console.log(`📋 Creazione progetto Drive: ${progettoName} (ID: ${progettoId || 'N/D'})`)

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
        `name='${bandoName.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
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

    // 3. Cerca o crea cartella "PROGETTI" dentro il bando
    let progettiFolderId: string
    try {
      const existingProgettiFolders = await listSharedDriveFiles(
        googleAccessToken,
        bandoFolderId,
        "name='PROGETTI' and mimeType='application/vnd.google-apps.folder' and trashed=false"
      )

      if (existingProgettiFolders.length > 0) {
        progettiFolderId = existingProgettiFolders[0].id!
        console.log('📁 Cartella PROGETTI esistente trovata:', progettiFolderId)
      } else {
        const progettiFolderData = await createDriveFolderInSharedDrive(
          googleAccessToken,
          'PROGETTI',
          sharedDriveId,
          bandoFolderId
        )
        progettiFolderId = progettiFolderData.id!
        console.log('📁 Cartella PROGETTI creata:', progettiFolderId)
      }
    } catch (error: any) {
      console.error('📁 Errore cartella PROGETTI:', error)
      throw error
    }

    // 4. Cerca o crea cartella progetto dentro PROGETTI
    let progettoFolderId: string
    try {
      const existingProgettoFolders = await listSharedDriveFiles(
        googleAccessToken,
        progettiFolderId,
        `name='${progettoName.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
      )

      if (existingProgettoFolders.length > 0) {
        progettoFolderId = existingProgettoFolders[0].id!
        console.log('📁 Cartella progetto esistente trovata:', progettoFolderId)
      } else {
        const progettoFolderData = await createDriveFolderInSharedDrive(
          googleAccessToken,
          progettoName,
          sharedDriveId,
          progettiFolderId
        )
        progettoFolderId = progettoFolderData.id!
        console.log('📁 Cartella progetto creata:', progettoFolderId)
      }
    } catch (error: any) {
      console.error('📁 Errore cartella progetto:', error)
      throw error
    }

    // 5. Crea sottocartelle del progetto (inclusa CONTRATTI)
    const subFolders = ['ALLEGATI', 'DOC AMM', 'CONTRATTI']
    const createdSubFolders: any = {}

    for (const folderName of subFolders) {
      try {
        // Controlla se la sottocartella esiste già
        const existingSubFolders = await listSharedDriveFiles(
          googleAccessToken,
          progettoFolderId,
          `name='${folderName.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
        )

        if (existingSubFolders.length > 0) {
          createdSubFolders[folderName] = existingSubFolders[0].id!
          console.log(`📂 Sottocartella ${folderName} esistente trovata:`, createdSubFolders[folderName])
        } else {
          const subFolderData = await createDriveFolderInSharedDrive(
            googleAccessToken,
            folderName,
            sharedDriveId,
            progettoFolderId
          )
          createdSubFolders[folderName] = subFolderData.id!
          console.log(`📂 Sottocartella ${folderName} creata:`, createdSubFolders[folderName])
        }
      } catch (error: any) {
        console.error(`📂 Errore sottocartella ${folderName}:`, error)
        // Continua con le altre cartelle anche se una fallisce
      }
    }

    // 6. Copia allegati del bando nella cartella ALLEGATI del progetto
    const allegatiResult = await copyBandoAllegatiToProgetto(
      googleAccessToken,
      bandoName,
      progettoName,
      progettoId,
      bandoFolderId,
      createdSubFolders.ALLEGATI
    )

    return Response.json({
      success: true,
      message: `Struttura progetto creata su Google Drive${allegatiResult.copiedFiles > 0 ? ` con ${allegatiResult.copiedFiles} allegati copiati` : ''}`,
      data: {
        bandoName,
        progettoName,
        progettoFolderId,
        subFolders: createdSubFolders,
        allegatiCopy: allegatiResult,
        folderPath: `Drive Condivisi > Gestionale Evolvi > ${bandoName} > PROGETTI > ${progettoName}`
      }
    })

  } catch (error: any) {
    console.error('Errore API create-progetto:', error)
    return Response.json({
      success: false,
      message: 'Errore durante creazione struttura progetto',
      error: error.message
    }, { status: 500 })
  }
}

// Funzione per copiare allegati del bando nella cartella progetto
async function copyBandoAllegatiToProgetto(
  googleAccessToken: string,
  bandoName: string,
  progettoName: string,
  progettoId: string | undefined,
  bandoFolderId: string,
  progettoAllegatiFolderId: string
) {
  try {
    console.log(`📋 Inizio copia allegati bando "${bandoName}" per progetto "${progettoName}"`)

    // Trova cartella ALLEGATI del bando
    const bandoAllegatiFolder = await listSharedDriveFiles(
      googleAccessToken,
      bandoFolderId,
      "name='ALLEGATI' and mimeType='application/vnd.google-apps.folder' and trashed=false"
    )

    if (bandoAllegatiFolder.length === 0) {
      console.log('📂 Nessuna cartella ALLEGATI trovata nel bando')
      return { copiedFiles: 0, files: [] }
    }

    const bandoAllegatiFolderId = bandoAllegatiFolder[0].id!
    console.log(`📂 Cartella ALLEGATI bando trovata: ${bandoAllegatiFolderId}`)

    // Lista tutti gli allegati nella cartella del bando
    const bandoAllegati = await listSharedDriveFiles(
      googleAccessToken,
      bandoAllegatiFolderId,
      "mimeType != 'application/vnd.google-apps.folder'"
    )

    if (bandoAllegati.length === 0) {
      console.log('📄 Nessun allegato trovato nella cartella ALLEGATI del bando')
      return { copiedFiles: 0, files: [] }
    }

    console.log(`📄 Trovati ${bandoAllegati.length} allegati da copiare`)

    // Copia ogni allegato nella cartella progetto
    const copiedFiles = []
    for (const allegato of bandoAllegati) {
      try {
        // Personalizza il nome file aggiungendo info progetto/azienda
        const projectFileName = `[${progettoName}] ${allegato.name}`

        const copiedFile = await copyFileToFolder(
          googleAccessToken,
          allegato.id!,
          progettoAllegatiFolderId,
          projectFileName
        )

        copiedFiles.push({
          originalId: allegato.id,
          originalName: allegato.name,
          newId: copiedFile.id,
          newName: copiedFile.name,
          webViewLink: copiedFile.webViewLink
        })

        console.log(`✅ Allegato copiato: ${allegato.name} → ${projectFileName}`)
      } catch (error) {
        console.error(`❌ Errore copia allegato ${allegato.name}:`, error)
      }
    }

    console.log(`📋 Copia completata: ${copiedFiles.length}/${bandoAllegati.length} file copiati`)

    // Aggiorna database con i nuovi ID Google Drive
    await updateProjectDocumentsWithDriveIds(progettoId, progettoName, bandoName, copiedFiles)

    return {
      copiedFiles: copiedFiles.length,
      totalFiles: bandoAllegati.length,
      files: copiedFiles
    }
  } catch (error) {
    console.error('📋 Errore copia allegati bando:', error)
    return { copiedFiles: 0, files: [], error: error instanceof Error ? error.message : 'Errore sconosciuto' }
  }
}

// Aggiorna database documenti progetto con ID Google Drive
async function updateProjectDocumentsWithDriveIds(
  progettoId: string | undefined,
  progettoName: string,
  bandoName: string,
  copiedFiles: any[]
) {
  try {
    console.log(`💾 Aggiornamento database documenti progetto ${progettoId || 'N/D'}: ${copiedFiles.length} documenti`)

    for (const file of copiedFiles) {
      // Strategia di matching: cerca documenti che potrebbero corrispondere al file copiato
      // 1. Prima cerca per nome_originale (matching esatto)
      // 2. Poi cerca per nome_file senza prefisso [NomeProgetto]
      // 3. Poi cerca per pattern nel nome_file (per template TEMPLATE_*)

      let documents = null
      let findError = null

      console.log(`🔍 Cercando documento per file: ${file.originalName} (copiato come: ${file.newName})`)

      // Se non abbiamo il progettoId, salta l'aggiornamento per sicurezza
      if (!progettoId) {
        console.warn(`⚠️ Nessun progettoId fornito, skip aggiornamento per ${file.originalName}`)
        continue
      }

      // Tentativo 1: Match per nome_originale con categoria 'allegato' (documenti ereditati)
      const result1 = await supabase
        .from('scadenze_bandi_documenti_progetto')
        .select('*')
        .eq('progetto_id', progettoId)  // FILTRO PER PROGETTO SPECIFICO
        .eq('nome_originale', file.originalName)
        .in('categoria', ['allegato', 'allegati', 'ereditato']) // Supporta varianti categoria

      if (!result1.error && result1.data && result1.data.length > 0) {
        documents = result1.data
        console.log(`✅ Match esatto per nome_originale: ${file.originalName}`)
      } else {
        // Tentativo 1b: Match per nome_file che corrisponde esattamente al nome originale
        const result1b = await supabase
          .from('scadenze_bandi_documenti_progetto')
          .select('*')
          .eq('progetto_id', progettoId)  // FILTRO PER PROGETTO SPECIFICO
          .eq('nome_file', file.originalName)
          .in('categoria', ['allegato', 'allegati', 'ereditato'])

        if (!result1b.error && result1b.data && result1b.data.length > 0) {
          documents = result1b.data
          console.log(`✅ Match esatto per nome_file: ${file.originalName}`)
        }
      }

      if (!documents) {
        // Tentativo 2: Match per pattern nel nome_file (es. TEMPLATE_Modello A... o [NomeProgetto] ...)
        const result2 = await supabase
          .from('scadenze_bandi_documenti_progetto')
          .select('*')
          .eq('progetto_id', progettoId)  // FILTRO PER PROGETTO SPECIFICO
          .ilike('nome_file', `%${file.originalName}%`)
          .in('categoria', ['allegato', 'allegati', 'ereditato']) // Supporta varianti categoria

        if (!result2.error && result2.data && result2.data.length > 0) {
          documents = result2.data
          console.log(`🔍 Match trovato per pattern: ${file.originalName} → ${documents[0].nome_file}`)
        } else {
          // Tentativo 3: Match per parti del nome (rimuove estensioni e prefissi)
          const cleanName = file.originalName.replace(/\.(docx?|pdf|xlsx?)$/i, '').trim()
          const result3 = await supabase
            .from('scadenze_bandi_documenti_progetto')
            .select('*')
            .eq('progetto_id', progettoId)  // FILTRO PER PROGETTO SPECIFICO
            .ilike('nome_file', `%${cleanName}%`)
            .in('categoria', ['allegato', 'allegati', 'ereditato']) // Supporta varianti categoria

          if (!result3.error && result3.data && result3.data.length > 0) {
            documents = result3.data
            console.log(`🔍 Match fuzzy trovato: ${cleanName} → ${documents[0].nome_file}`)
          }
        }
      }

      if (findError) {
        console.error(`❌ Errore ricerca documento ${file.originalName}:`, findError)
        continue
      }

      if (documents && documents.length > 0) {
        // Aggiorna con info Google Drive
        const { error: updateError } = await supabase
          .from('scadenze_bandi_documenti_progetto')
          .update({
            google_drive_id: file.newId,
            google_drive_url: file.webViewLink,
            google_drive_modified: new Date().toISOString(),
            last_checked: new Date().toISOString(),
            has_changes: false
          })
          .eq('id', documents[0].id)

        if (updateError) {
          console.error(`❌ Errore aggiornamento documento ${file.originalName}:`, updateError)
        } else {
          console.log(`✅ Database aggiornato per: ${file.originalName} → ${documents[0].nome_file}`)
        }
      } else {
        console.log(`⚠️ Documento ${file.originalName} non trovato nel database con nessuna strategia`)
      }
    }
  } catch (error) {
    console.error('💾 Errore aggiornamento database:', error)
  }
}