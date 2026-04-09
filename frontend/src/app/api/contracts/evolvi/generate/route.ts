import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getValidGoogleToken } from '@/lib/googleAuth'
import { findWordTemplate, processWordTemplate } from '@/lib/wordTemplate'
import { uploadFileToFolder, createDriveFolderInSharedDrive, listSharedDriveFiles } from '@/lib/googleDrive'

export async function POST(req: NextRequest) {
  try {
    const { contrattoId, clienteId } = await req.json()

    if (!contrattoId || !clienteId) {
      return Response.json({
        success: false,
        message: 'ID contratto e ID cliente richiesti'
      }, { status: 400 })
    }

    // 1. Recupera dati contratto
    console.log('Ricerca contratto Evolvi ID:', contrattoId)

    const { data: contratto, error: contrattoError } = await supabase
      .from('scadenze_bandi_contratti_evolvi')
      .select('*')
      .eq('id', contrattoId)
      .single()

    if (contrattoError || !contratto) {
      return Response.json({
        success: false,
        message: `Contratto non trovato: ${contrattoError?.message || 'Unknown error'}`
      }, { status: 404 })
    }

    // 2. Recupera dati cliente
    const { data: cliente, error: clienteError } = await supabase
      .from('scadenze_bandi_clienti')
      .select('denominazione, partita_iva, codice_fiscale, indirizzo_fatturazione, citta_fatturazione, provincia_fatturazione, cap_fatturazione, pec, email, telefono, legale_rappresentante_nome, legale_rappresentante_cognome')
      .eq('id', clienteId)
      .single()

    if (clienteError || !cliente) {
      return Response.json({
        success: false,
        message: `Cliente non trovato: ${clienteError?.message || 'Unknown error'}`
      }, { status: 404 })
    }

    console.log('Contratto e cliente trovati:', cliente.denominazione)

    // 3. Ottieni token Google Drive
    const googleAccessToken = await getValidGoogleToken()
    if (!googleAccessToken) {
      return Response.json({
        success: false,
        message: 'Google Drive non configurato'
      }, { status: 401 })
    }

    // 4. Cerca template Word su Google Drive
    console.log('Ricerca template Word per contratto Evolvi...')
    let wordTemplateResult = await findWordTemplate(googleAccessToken, 'CONTRATTO EVOLVI')

    if (!wordTemplateResult.success) {
      // Fallback: prova con nome alternativo
      console.log('Template "CONTRATTO EVOLVI" non trovato, provo con "METODO EVOLVI"...')
      wordTemplateResult = await findWordTemplate(googleAccessToken, 'METODO EVOLVI')
    }

    if (!wordTemplateResult.success) {
      return Response.json({
        success: false,
        message: 'Template Word per contratto Evolvi non trovato. Assicurati che esista un file con nome contenente "CONTRATTO EVOLVI" o "METODO EVOLVI" nella cartella MODELLI.'
      }, { status: 404 })
    }

    // 5. Calcola durata contratto in mesi
    let durataContratto = ''
    if (contratto.data_inizio && contratto.data_fine) {
      const inizio = new Date(contratto.data_inizio)
      const fine = new Date(contratto.data_fine)
      const mesi = (fine.getFullYear() - inizio.getFullYear()) * 12 + (fine.getMonth() - inizio.getMonth())
      durataContratto = `${mesi} mesi`
    }

    // 6. Formatta importi in EUR
    const formatEUR = (amount: number | null | undefined): string => {
      if (!amount) return ''
      return new Intl.NumberFormat('it-IT', {
        style: 'currency',
        currency: 'EUR'
      }).format(amount)
    }

    // 7. Prepara dati per template Word
    const templateData: any = {
      Denominazione: cliente.denominazione || '',
      PartitaIVA: cliente.partita_iva || '',
      Indirizzo: cliente.indirizzo_fatturazione || '',
      Citta: cliente.citta_fatturazione || '',
      Provincia: cliente.provincia_fatturazione || '',
      PEC: cliente.pec || '',
      LegaleRappresentante: [cliente.legale_rappresentante_nome, cliente.legale_rappresentante_cognome].filter(Boolean).join(' ') || '',
      DataContratto: contratto.data_contratto
        ? new Date(contratto.data_contratto).toLocaleDateString('it-IT')
        : new Date().toLocaleDateString('it-IT'),
      DataInizio: contratto.data_inizio
        ? new Date(contratto.data_inizio).toLocaleDateString('it-IT')
        : '',
      DataFine: contratto.data_fine
        ? new Date(contratto.data_fine).toLocaleDateString('it-IT')
        : '',
      ImportoAnnuale: formatEUR(contratto.importo_annuale),
      ImportoTotale: formatEUR(contratto.importo_totale),
      ModalitaPagamento: contratto.modalita_pagamento || '',
      CheckMensile: contratto.modalita_pagamento === 'mensile' ? '☑' : '☐',
      CheckAnnuale: contratto.modalita_pagamento === 'annuale' ? '☑' : '☐',
      DurataContratto: durataContratto,
      NumeroContratto: contratto.numero_contratto || `EVO-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`
    }

    console.log('Dati template preparati:', templateData)

    // 8. Processa template Word
    const processResult = await processWordTemplate(
      googleAccessToken,
      wordTemplateResult.fileId!,
      templateData,
      wordTemplateResult.mimeType
    )

    if (!processResult.success) {
      return Response.json({
        success: false,
        message: `Errore elaborazione template: ${processResult.error}`
      }, { status: 500 })
    }

    // 9. Trova cartella cliente su Google Drive
    const clientFolderResult = await findClientFolder(googleAccessToken, cliente.denominazione)

    if (!clientFolderResult.success) {
      return Response.json({
        success: false,
        message: clientFolderResult.message
      }, { status: 404 })
    }

    // 10. Crea/trova cartella CONTRATTI EVOLVI dentro la cartella del cliente
    const contractsFolderId = await findOrCreateContractsFolder(
      googleAccessToken,
      clientFolderResult.sharedDriveId!,
      clientFolderResult.clientFolderId!
    )

    // 11. Genera nome file contratto
    const contractFileName = `Contratto_Evolvi_${cliente.denominazione.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.docx`

    // 12. Carica contratto su Google Drive (convertito in Google Docs per rendering corretto)
    const uploadResult = await uploadFileToFolder(
      googleAccessToken,
      contractsFolderId,
      contractFileName,
      Buffer.from(processResult.processedDoc as ArrayBuffer),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      true // Converti in Google Docs nativo
    )

    console.log('Contratto Evolvi caricato su Drive:', uploadResult.id)

    // 13. Aggiorna record contratto nel database
    const { error: updateError } = await supabase
      .from('scadenze_bandi_contratti_evolvi')
      .update({
        contract_word_id: uploadResult.id,
        contract_word_url: uploadResult.webViewLink,
        stato: 'in_revisione',
        numero_contratto: templateData.NumeroContratto
      })
      .eq('id', contrattoId)

    if (updateError) {
      console.error('Errore aggiornamento contratto nel database:', updateError)
    }

    return Response.json({
      success: true,
      message: 'Contratto Evolvi generato con successo',
      data: {
        contractId: uploadResult.id,
        contractUrl: uploadResult.webViewLink,
        wordFileId: uploadResult.id
      }
    })

  } catch (error: any) {
    console.error('Errore generazione contratto Evolvi:', error)
    return Response.json({
      success: false,
      message: 'Errore durante generazione contratto Evolvi',
      error: error.message
    }, { status: 500 })
  }
}

// Trova o crea cartella cliente su Google Drive (struttura: Gestionale Evolvi > CLIENTI > [nome cliente])
async function findClientFolder(googleAccessToken: string, clienteName: string) {
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

    // 2. Trova cartella "CLIENTI" (la crea se non esiste)
    let clientiFolder = await listSharedDriveFiles(
      googleAccessToken,
      gestionaleEvolvi.id,
      "name='CLIENTI' and mimeType='application/vnd.google-apps.folder' and trashed=false"
    )

    if (clientiFolder.length === 0) {
      console.log('Cartella CLIENTI non trovata, la creo...')
      const newClientiFolder = await createDriveFolderInSharedDrive(
        googleAccessToken,
        'CLIENTI',
        gestionaleEvolvi.id
      )
      clientiFolder = [newClientiFolder]
      console.log('Cartella CLIENTI creata:', newClientiFolder.id)
    }

    const clientiFolderId = clientiFolder[0].id!
    console.log('Cartella CLIENTI:', clientiFolderId)

    // 3. Cerca cartella del cliente
    const escapedName = clienteName.replace(/'/g, "\\'")
    const clientFolder = await listSharedDriveFiles(
      googleAccessToken,
      clientiFolderId,
      `name='${escapedName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
    )

    if (clientFolder.length > 0) {
      return {
        success: true,
        sharedDriveId: gestionaleEvolvi.id,
        clientFolderId: clientFolder[0].id
      }
    }

    // Prova ricerca parziale prima di creare
    const partialSearch = await listSharedDriveFiles(
      googleAccessToken,
      clientiFolderId,
      `name contains '${escapedName.substring(0, 20)}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
    )

    if (partialSearch.length > 0) {
      return {
        success: true,
        sharedDriveId: gestionaleEvolvi.id,
        clientFolderId: partialSearch[0].id
      }
    }

    // 4. Cartella non trovata: la creo automaticamente
    console.log(`Cartella cliente "${clienteName}" non trovata, la creo...`)
    const newClientFolder = await createDriveFolderInSharedDrive(
      googleAccessToken,
      clienteName,
      gestionaleEvolvi.id,
      clientiFolderId
    )
    console.log('Cartella cliente creata:', newClientFolder.id)

    return {
      success: true,
      sharedDriveId: gestionaleEvolvi.id,
      clientFolderId: newClientFolder.id
    }

  } catch (error) {
    console.error('Errore ricerca/creazione cartella cliente:', error)
    return { success: false, message: 'Errore durante ricerca/creazione cartella cliente: ' + (error instanceof Error ? error.message : 'Unknown error') }
  }
}

// Trova o crea cartella CONTRATTI EVOLVI nella cartella del cliente
async function findOrCreateContractsFolder(googleAccessToken: string, sharedDriveId: string, clientFolderId: string) {
  try {
    // Controlla se cartella CONTRATTI EVOLVI esiste già
    const existingFolders = await listSharedDriveFiles(
      googleAccessToken,
      clientFolderId,
      "name='CONTRATTI EVOLVI' and mimeType='application/vnd.google-apps.folder' and trashed=false"
    )

    if (existingFolders.length > 0) {
      console.log('Cartella CONTRATTI EVOLVI esistente trovata')
      return existingFolders[0].id!
    }

    // Crea nuova cartella CONTRATTI EVOLVI
    const folderData = await createDriveFolderInSharedDrive(
      googleAccessToken,
      'CONTRATTI EVOLVI',
      sharedDriveId,
      clientFolderId
    )

    console.log('Cartella CONTRATTI EVOLVI creata:', folderData.id)
    return folderData.id!

  } catch (error) {
    console.error('Errore creazione cartella CONTRATTI EVOLVI:', error)
    throw error
  }
}
