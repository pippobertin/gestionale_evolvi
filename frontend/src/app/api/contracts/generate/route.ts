import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getValidGoogleToken } from '@/lib/googleAuth'
import { createDriveFolderInSharedDrive, listSharedDriveFiles, uploadFileToFolder } from '@/lib/googleDrive'
import { findWordTemplate, processWordTemplate } from '@/lib/wordTemplate'
import fs from 'fs'
import path from 'path'

interface ContractData {
  // Cliente
  Denominazione: string
  'Partita IVA': string
  Città: string
  Provincia: string
  Indirizzo: string
  PEC: string

  // Bando
  nome_bando: string
  ente_finanziatore: string

  // Sistema
  data_oggi: string
}

export async function POST(req: NextRequest) {
  try {
    const { progettoId, templateName = 'MODELLO CONTRATTO SPOT', importoConsulenza, customEmailTarget, previewOnly = false, useWordTemplate = true } = await req.json()

    if (!progettoId) {
      return Response.json({ message: 'ID progetto richiesto' }, { status: 400 })
    }

    // 1. Recupera dati progetto con join cliente e bando (con retry per race conditions)
    console.log('🔍 Ricerca progetto ID:', progettoId)

    let progetto = null
    let projectError = null

    // Retry logic per gestire eventuali race conditions del database
    for (let attempt = 1; attempt <= 3; attempt++) {
      console.log(`🔄 Tentativo ${attempt}/3 - Recupero dati progetto...`)

      // Prima recupera il progetto base
      const progettoResult = await supabase
        .from('scadenze_bandi_progetti')
        .select('*')
        .eq('id', progettoId)
        .single()

      if (progettoResult.error || !progettoResult.data) {
        projectError = progettoResult.error
        console.log(`⚠️ Tentativo ${attempt} - Progetto non trovato:`, progettoResult.error?.message)

        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 1000))
          continue
        }
        break
      }

      const baseProgetto = progettoResult.data

      // Poi recupera i dati del cliente
      const clienteResult = await supabase
        .from('scadenze_bandi_clienti')
        .select('denominazione, partita_iva, citta_fatturazione, provincia_fatturazione, indirizzo_fatturazione, pec, email')
        .eq('id', baseProgetto.cliente_id)
        .single()

      // E i dati del bando
      const bandoResult = await supabase
        .from('scadenze_bandi_bandi')
        .select('nome, ente_erogatore')
        .eq('id', baseProgetto.bando_id)
        .single()

      if (clienteResult.error || bandoResult.error) {
        projectError = clienteResult.error || bandoResult.error
        console.log(`⚠️ Tentativo ${attempt} - Errore recupero relazioni:`, projectError?.message)

        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 1000))
          continue
        }
        break
      }

      // Componi l'oggetto finale
      progetto = {
        ...baseProgetto,
        scadenze_bandi_clienti: clienteResult.data,
        scadenze_bandi_bandi: bandoResult.data
      }

      projectError = null
      console.log('✅ Progetto e relazioni trovati:', progetto.titolo_progetto)
      break
    }

    if (projectError || !progetto) {
      console.error('❌ Progetto non trovato dopo 3 tentativi:', projectError)
      return Response.json({
        success: false,
        message: `Progetto non trovato: ${projectError?.message || 'Unknown error'}`
      }, { status: 404 })
    }

    // 2. Ottieni token Google Drive
    const googleAccessToken = await getValidGoogleToken()
    if (!googleAccessToken) {
      return Response.json({
        success: false,
        message: 'Google Drive non configurato'
      }, { status: 401 })
    }

    // 3. Prova a trovare template Word su Google Drive (se abilitato)
    let wordTemplateResult = null
    if (useWordTemplate) {
      console.log('🔍 Tentativo utilizzo template Word da Google Drive...')
      wordTemplateResult = await findWordTemplate(googleAccessToken, templateName)
      if (!wordTemplateResult.success) {
        console.log('⚠️ Template Word non trovato, fallback a template testo:', wordTemplateResult.error)
      }
    }

    let contractData: any
    let compiledContract: string | ArrayBuffer
    let isWordDocument = false
    let fileExtension = 'txt'
    let mimeType = 'text/plain'

    if (wordTemplateResult && wordTemplateResult.success) {
      // USA TEMPLATE WORD
      console.log('📄 Utilizzando template Word formattato')
      isWordDocument = true
      fileExtension = 'docx'
      mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

      // Prepara dati per template Word (solo campi presenti nel template)
      contractData = {
        // Campi effettivamente presenti nel template Word
        Denominazione: progetto.scadenze_bandi_clienti.denominazione || '',
        PartitaIVA: progetto.scadenze_bandi_clienti.partita_iva || '',
        Citta: progetto.scadenze_bandi_clienti.citta_fatturazione || '',
        Provincia: progetto.scadenze_bandi_clienti.provincia_fatturazione || '',
        Indirizzo: progetto.scadenze_bandi_clienti.indirizzo_fatturazione || '',
        NomeBando: progetto.scadenze_bandi_bandi.nome || '',
        EnteErogatore: progetto.scadenze_bandi_bandi.ente_erogatore || '',
        PEC: progetto.scadenze_bandi_clienti.pec || '',
        ImportoConsulenza: importoConsulenza || '',
        DataContratto: new Date().toLocaleDateString('it-IT')
      }

      if (previewOnly) {
        return Response.json({
          success: true,
          message: 'Anteprima contratto Word generata',
          data: {
            contractContent: `📄 Template Word: ${templateName}\n\n✅ Formato: Documento Word formattato (.docx)\n\n📊 Dati che saranno sostituiti:\n${JSON.stringify(contractData, null, 2)}`,
            clientData: contractData,
            template: templateName,
            preview: true,
            isWordDocument: true
          }
        })
      }

      // Processa template Word
      const processResult = await processWordTemplate(
        googleAccessToken,
        wordTemplateResult.fileId!,
        contractData
      )

      if (!processResult.success) {
        console.log('⚠️ Errore template Word, fallback a template testo:', processResult.error)
        // Fallback a template testo
        isWordDocument = false
        fileExtension = 'txt'
        mimeType = 'text/plain'

        // Usa logica template testo
        const textContractData = {
          'Denominazione': progetto.scadenze_bandi_clienti.denominazione || '',
          'Partita IVA': progetto.scadenze_bandi_clienti.partita_iva || '',
          'Città': progetto.scadenze_bandi_clienti.citta_fatturazione || '',
          'Provincia': progetto.scadenze_bandi_clienti.provincia_fatturazione || '',
          'Indirizzo': progetto.scadenze_bandi_clienti.indirizzo_fatturazione || '',
          'PEC': progetto.scadenze_bandi_clienti.pec || '',
          'nome_bando': progetto.scadenze_bandi_bandi.nome || '',
          'ente_finanziatore': progetto.scadenze_bandi_bandi.ente_erogatore || '',
          'data_oggi': new Date().toLocaleDateString('it-IT')
        }

        // Leggi template di testo
        const templatePath = path.join(process.cwd(), 'templates', 'contracts', 'contratto-BLM-template.txt')
        let templateContent: string

        try {
          templateContent = fs.readFileSync(templatePath, 'utf-8')
        } catch (error) {
          return Response.json({
            message: 'Template di testo non trovato',
            error: 'Text template file not found'
          }, { status: 404 })
        }

        // Sostituisci placeholder
        compiledContract = templateContent
        for (const [key, value] of Object.entries(textContractData)) {
          const placeholder = `{{${key}}}`
          compiledContract = compiledContract.replace(new RegExp(placeholder, 'g'), value as string)
        }

        // Sostituisci importo consulenza
        if (importoConsulenza) {
          compiledContract = compiledContract.replace(/euro ___________/g, `euro ${importoConsulenza}`)
          compiledContract = compiledContract.replace(/per la cifra di euro __________ \+ IVA/g, `per la cifra di euro ${importoConsulenza} + IVA`)
        }
      } else {
        compiledContract = processResult.processedDoc!
      }
    } else {
      // USA TEMPLATE TESTO (FALLBACK)
      console.log('📝 Utilizzando template di testo (fallback)')

      contractData = {
        'Denominazione': progetto.scadenze_bandi_clienti.denominazione || '',
        'Partita IVA': progetto.scadenze_bandi_clienti.partita_iva || '',
        'Città': progetto.scadenze_bandi_clienti.citta_fatturazione || '',
        'Provincia': progetto.scadenze_bandi_clienti.provincia_fatturazione || '',
        'Indirizzo': progetto.scadenze_bandi_clienti.indirizzo_fatturazione || '',
        'PEC': progetto.scadenze_bandi_clienti.pec || '',
        'nome_bando': progetto.scadenze_bandi_bandi.nome || '',
        'ente_finanziatore': progetto.scadenze_bandi_bandi.ente_erogatore || '',
        'data_oggi': new Date().toLocaleDateString('it-IT')
      }

      // Leggi template di testo
      const templatePath = path.join(process.cwd(), 'templates', 'contracts', 'contratto-BLM-template.txt')
      let templateContent: string

      try {
        templateContent = fs.readFileSync(templatePath, 'utf-8')
      } catch (error) {
        return Response.json({
          message: 'Template di testo non trovato',
          error: 'Text template file not found'
        }, { status: 404 })
      }

      // Sostituisci placeholder
      compiledContract = templateContent
      for (const [key, value] of Object.entries(contractData)) {
        const placeholder = `{{${key}}}`
        compiledContract = compiledContract.replace(new RegExp(placeholder, 'g'), value as string)
      }

      // Sostituisci importo consulenza
      if (importoConsulenza) {
        compiledContract = compiledContract.replace(/euro ___________/g, `euro ${importoConsulenza}`)
        compiledContract = compiledContract.replace(/per la cifra di euro __________ \+ IVA/g, `per la cifra di euro ${importoConsulenza} + IVA`)
      }

      if (previewOnly) {
        return Response.json({
          success: true,
          message: 'Anteprima contratto generata con successo',
          data: {
            contractContent: compiledContract as string,
            clientData: contractData,
            template: 'contratto-BLM-template.txt',
            preview: true,
            isWordDocument: false
          }
        })
      }
    }

    // 4. Trova cartella progetto su Google Drive
    const driveResult = await findProjectFolder(
      googleAccessToken,
      progetto.scadenze_bandi_bandi.nome,
      progetto.titolo_progetto
    )

    if (!driveResult.success) {
      return Response.json({
        success: false,
        message: driveResult.message
      }, { status: 404 })
    }

    // 5. Crea/trova cartella CONTRATTI
    const contractsFolderId = await createContractsFolder(
      googleAccessToken,
      driveResult.sharedDriveId!,
      driveResult.projectFolderId!
    )

    // 6. Genera nome file contratto
    const contractFileName = `Contratto_${progetto.scadenze_bandi_clienti.denominazione.replace(/[^a-zA-Z0-9]/g, '_')}_${progetto.codice_progetto}_${new Date().toISOString().split('T')[0]}.${fileExtension}`

    // 7. Carica contratto su Google Drive
    const uploadResult = await uploadFileToFolder(
      googleAccessToken,
      contractsFolderId,
      contractFileName,
      isWordDocument ? Buffer.from(compiledContract as ArrayBuffer) : (compiledContract as string),
      mimeType
    )

    return Response.json({
      success: true,
      message: `Contratto ${isWordDocument ? 'Word' : 'testo'} generato con successo`,
      data: {
        contractFileName,
        contractId: uploadResult.id,
        contractUrl: uploadResult.webViewLink,
        contractsFolder: contractsFolderId,
        clientData: contractData,
        template: isWordDocument ? templateName : 'contratto-BLM-template.txt',
        isWordDocument
      }
    })

  } catch (error: any) {
    console.error('Errore generazione contratto:', error)
    return Response.json({
      success: false,
      message: 'Errore durante generazione contratto',
      error: error.message
    }, { status: 500 })
  }
}

// Trova cartella progetto su Google Drive
async function findProjectFolder(googleAccessToken: string, bandoName: string, progettoName: string) {
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

    // 2. Trova cartella bando
    const bandoFolders = await listSharedDriveFiles(
      googleAccessToken,
      gestionaleEvolvi.id,
      `name='${bandoName.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
    )

    if (bandoFolders.length === 0) {
      return { success: false, message: `Cartella bando "${bandoName}" non trovata` }
    }

    // 3. Trova cartella PROGETTI
    const progettiFolders = await listSharedDriveFiles(
      googleAccessToken,
      bandoFolders[0].id!,
      "name='PROGETTI' and mimeType='application/vnd.google-apps.folder' and trashed=false"
    )

    if (progettiFolders.length === 0) {
      return { success: false, message: 'Cartella PROGETTI non trovata' }
    }

    // 4. Trova cartella progetto
    const progettoFolders = await listSharedDriveFiles(
      googleAccessToken,
      progettiFolders[0].id!,
      `name='${progettoName.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
    )

    if (progettoFolders.length === 0) {
      return { success: false, message: `Cartella progetto "${progettoName}" non trovata` }
    }

    return {
      success: true,
      sharedDriveId: gestionaleEvolvi.id,
      bandoFolderId: bandoFolders[0].id,
      progettiFolderId: progettiFolders[0].id,
      projectFolderId: progettoFolders[0].id
    }

  } catch (error) {
    console.error('Errore ricerca cartella progetto:', error)
    return { success: false, message: 'Errore durante ricerca cartella progetto' }
  }
}

// Crea cartella CONTRATTI nel progetto
async function createContractsFolder(googleAccessToken: string, sharedDriveId: string, projectFolderId: string) {
  try {
    // Controlla se cartella CONTRATTI esiste già
    const existingFolders = await listSharedDriveFiles(
      googleAccessToken,
      projectFolderId,
      "name='CONTRATTI' and mimeType='application/vnd.google-apps.folder' and trashed=false"
    )

    if (existingFolders.length > 0) {
      console.log('Cartella CONTRATTI esistente trovata')
      return existingFolders[0].id!
    }

    // Crea nuova cartella CONTRATTI
    const folderData = await createDriveFolderInSharedDrive(
      googleAccessToken,
      'CONTRATTI',
      sharedDriveId,
      projectFolderId
    )

    console.log('Cartella CONTRATTI creata:', folderData.id)
    return folderData.id!

  } catch (error) {
    console.error('Errore creazione cartella CONTRATTI:', error)
    throw error
  }
}