import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import { getValidGoogleToken } from './googleAuth'

interface TemplateData {
  // Cliente
  Denominazione: string
  PartitaIVA: string
  CodiceFiscale?: string
  Indirizzo: string
  CAP?: string
  Citta: string
  Provincia: string
  Email?: string
  PEC?: string
  Telefono?: string

  // Progetto
  TitoloProgetto: string
  CodiceProgetto: string
  ImportoProgetto?: string
  ContributoAmmesso?: string
  PercentualeContributo?: string
  DataAvvio?: string
  DataFine?: string

  // Bando
  NomeBando: string
  EnteErogatore: string
  DataPubblicazione?: string

  // Consulenza
  ImportoConsulenza: string
  ImportoConsulenziaPiuIVA?: string
  DataContratto: string
  NumeroContratto?: string

  // Sistema
  DataOggi: string
}

// Trova il template Word nella cartella MODELLI su Google Drive
export async function findWordTemplate(
  googleAccessToken: string,
  templateName: string = 'MODELLO CONTRATTO SPOT'
): Promise<{ success: boolean; fileId?: string; error?: string }> {
  try {
    console.log('🔍 Ricerca template Word:', templateName)

    // 1. Trova Drive Condiviso "Gestionale Evolvi"
    const sharedDriveResponse = await fetch('https://www.googleapis.com/drive/v3/drives', {
      headers: {
        'Authorization': `Bearer ${googleAccessToken}`
      }
    })

    const sharedDrives = await sharedDriveResponse.json()
    const gestionaleEvolvi = sharedDrives.drives?.find((drive: any) => drive.name === 'Gestionale Evolvi')

    if (!gestionaleEvolvi) {
      return { success: false, error: 'Drive Condiviso "Gestionale Evolvi" non trovato' }
    }

    // 2. Cerca cartella MODELLI
    const modelliFolderResponse = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='MODELLI' and mimeType='application/vnd.google-apps.folder' and '${gestionaleEvolvi.id}' in parents&supportsAllDrives=true&includeItemsFromAllDrives=true`, {
      headers: {
        'Authorization': `Bearer ${googleAccessToken}`
      }
    })

    const modelliFolders = await modelliFolderResponse.json()
    if (!modelliFolders.files || modelliFolders.files.length === 0) {
      return { success: false, error: 'Cartella MODELLI non trovata' }
    }

    const modelliFolderId = modelliFolders.files[0].id

    // 3. Cerca il template Word nella cartella MODELLI
    const templateResponse = await fetch(`https://www.googleapis.com/drive/v3/files?q=name contains '${templateName}' and '${modelliFolderId}' in parents&supportsAllDrives=true&includeItemsFromAllDrives=true`, {
      headers: {
        'Authorization': `Bearer ${googleAccessToken}`
      }
    })

    const templateFiles = await templateResponse.json()
    if (!templateFiles.files || templateFiles.files.length === 0) {
      return { success: false, error: `Template "${templateName}" non trovato nella cartella MODELLI` }
    }

    const templateFile = templateFiles.files[0]
    console.log('✅ Template trovato:', templateFile.name, templateFile.id)

    return { success: true, fileId: templateFile.id }

  } catch (error) {
    console.error('❌ Errore ricerca template:', error)
    return { success: false, error: 'Errore durante ricerca template' }
  }
}

// Scarica e processa il template Word
export async function processWordTemplate(
  googleAccessToken: string,
  templateFileId: string,
  templateData: TemplateData
): Promise<{ success: boolean; processedDoc?: ArrayBuffer; error?: string }> {
  try {
    console.log('📄 Processing Word template:', templateFileId)

    // 1. Scarica il file template da Google Drive
    const downloadResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${templateFileId}?alt=media&supportsAllDrives=true`, {
      headers: {
        'Authorization': `Bearer ${googleAccessToken}`
      }
    })

    if (!downloadResponse.ok) {
      return { success: false, error: 'Errore download template da Google Drive' }
    }

    const templateBuffer = await downloadResponse.arrayBuffer()
    console.log('✅ Template scaricato:', templateBuffer.byteLength, 'bytes')

    // 2. Carica il documento con PizZip
    const zip = new PizZip(templateBuffer)

    // 3. Crea istanza Docxtemplater con delimitatori personalizzati
    let doc: Docxtemplater
    try {
      doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: {
          start: '[[',
          end: ']]'
        }
      })
    } catch (error: any) {
      console.log('⚠️ Template Word ha placeholder malformati (fallback a testo):', error.name || 'Unknown error')
      if (error.name === 'TemplateError') {
        return {
          success: false,
          error: `Template Word contiene placeholder malformati. Verrà utilizzato il template di testo come fallback.`
        }
      }
      return {
        success: false,
        error: `Errore parsing template: ${error.message || 'Unknown error'}`
      }
    }

    // 4. Calcola valori derivati
    const importoNum = parseFloat(templateData.ImportoConsulenza.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0
    const importoConIVA = importoNum * 1.22 // IVA 22%

    const processedData = {
      ...templateData,
      ImportoConsulenziaPiuIVA: importoConIVA.toLocaleString('it-IT', {
        style: 'currency',
        currency: 'EUR'
      }),
      NumeroContratto: `CTR-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
    }

    console.log('📊 Dati per template:', processedData)

    // 5. Sostituisci i placeholder usando API moderna
    try {
      doc.render(processedData)
    } catch (error: any) {
      console.log('⚠️ Errore rendering template Word (fallback a testo):', error.name || 'Unknown error')
      if (error.name === 'TemplateError') {
        return {
          success: false,
          error: `Template Word contiene placeholder malformati. Verrà utilizzato il template di testo come fallback.`
        }
      }
      return {
        success: false,
        error: `Errore rendering template: ${error.message || 'Unknown error'}`
      }
    }

    // 6. Genera il buffer del documento processato
    const processedBuffer = doc.getZip().generate({
      type: 'arraybuffer',
      compression: 'DEFLATE',
    })

    console.log('✅ Template processato:', processedBuffer.byteLength, 'bytes')

    return { success: true, processedDoc: processedBuffer }

  } catch (error: any) {
    console.error('❌ Errore processing template:', error)
    return {
      success: false,
      error: `Errore processing template: ${error.message || 'Unknown error'}`
    }
  }
}

// Converte il documento Word processato in PDF (placeholder per implementazione futura)
export async function convertWordToPdf(
  wordBuffer: ArrayBuffer
): Promise<{ success: boolean; pdfBuffer?: ArrayBuffer; error?: string }> {
  // Per ora restituisce il documento Word - implementazione PDF in futuro
  console.log('📄 Mantengo formato Word (.docx) per ora')

  return { success: true, pdfBuffer: wordBuffer }
}