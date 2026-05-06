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
): Promise<{ success: boolean; fileId?: string; mimeType?: string; error?: string }> {
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

    // 3. Cerca il template Word nella cartella MODELLI (include mimeType per distinguere DOCX da Google Docs)
    const templateResponse = await fetch(`https://www.googleapis.com/drive/v3/files?q=name contains '${templateName}' and '${modelliFolderId}' in parents&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,mimeType)`, {
      headers: {
        'Authorization': `Bearer ${googleAccessToken}`
      }
    })

    const templateFiles = await templateResponse.json()
    if (!templateFiles.files || templateFiles.files.length === 0) {
      return { success: false, error: `Template "${templateName}" non trovato nella cartella MODELLI` }
    }

    const templateFile = templateFiles.files[0]
    console.log('✅ Template trovato:', templateFile.name, templateFile.id, `(${templateFile.mimeType})`)

    return { success: true, fileId: templateFile.id, mimeType: templateFile.mimeType }

  } catch (error) {
    console.error('❌ Errore ricerca template:', error)
    return { success: false, error: 'Errore durante ricerca template' }
  }
}

// Scarica e processa il template Word
export async function processWordTemplate(
  googleAccessToken: string,
  templateFileId: string,
  templateData: TemplateData | Record<string, any>,
  templateMimeType?: string
): Promise<{ success: boolean; processedDoc?: ArrayBuffer; error?: string }> {
  try {
    console.log('📄 Processing Word template:', templateFileId, templateMimeType || '')

    // 1. Scarica il file template da Google Drive
    // Per Google Docs nativi: usa export endpoint per ottenere DOCX pulito
    // Per file DOCX: scarica direttamente
    const isGoogleDoc = templateMimeType === 'application/vnd.google-apps.document'
    const downloadUrl = isGoogleDoc
      ? `https://www.googleapis.com/drive/v3/files/${templateFileId}/export?mimeType=application/vnd.openxmlformats-officedocument.wordprocessingml.document`
      : `https://www.googleapis.com/drive/v3/files/${templateFileId}?alt=media&supportsAllDrives=true`

    console.log(isGoogleDoc ? '📥 Export da Google Docs nativo' : '📥 Download DOCX diretto')

    const downloadResponse = await fetch(downloadUrl, {
      headers: {
        'Authorization': `Bearer ${googleAccessToken}`
      }
    })

    if (!downloadResponse.ok) {
      const errText = await downloadResponse.text().catch(() => '')
      console.error('❌ Download fallito:', downloadResponse.status, errText.substring(0, 200))
      return { success: false, error: 'Errore download template da Google Drive' }
    }

    const templateBuffer = await downloadResponse.arrayBuffer()
    console.log('✅ Template scaricato:', templateBuffer.byteLength, 'bytes', isGoogleDoc ? '(export)' : '(diretto)')

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
    const processedData: Record<string, any> = {
      ...templateData,
    }

    // Calcola IVA solo per contratti spot (che hanno ImportoConsulenza)
    if (templateData.ImportoConsulenza) {
      const importoNum = parseFloat(templateData.ImportoConsulenza.replace(/[^\d,.-]/g, '').replace(',', '.')) || 0
      const importoConIVA = importoNum * 1.22 // IVA 22%
      processedData.ImportoConsulenziaPiuIVA = importoConIVA.toLocaleString('it-IT', {
        style: 'currency',
        currency: 'EUR'
      })
    }

    // Genera NumeroContratto solo se non è già fornito
    if (!processedData.NumeroContratto) {
      processedData.NumeroContratto = `CTR-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`
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

    // 6. Post-process: rimuovi artefatti PDF-to-DOCX
    const docXml = doc.getZip().file('word/document.xml')?.asText()
    if (docXml) {
      const cleanedXml = docXml
        // Rimuovi <w:spacing w:val="X"/> (character spacing, non paragraph spacing)
        .replace(/<w:spacing w:val="[^"]*"\s*\/>/g, '')
        // Rimuovi <w:w w:val="X"/> dove non e' 100% (horizontal scaling artifact)
        .replace(/<w:w w:val="(?!100")[^"]*"\s*\/>/g, '')
        // Cambia lineRule="exact" in "atLeast" per permettere alle righe di adattarsi
        .replace(/w:lineRule="exact"/g, 'w:lineRule="atLeast"')
      doc.getZip().file('word/document.xml', cleanedXml)
      console.log(`🧹 Post-process PDF artifacts. XML: ${docXml.length} -> ${cleanedXml.length}`)
    }

    // 7. Genera il buffer del documento processato
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