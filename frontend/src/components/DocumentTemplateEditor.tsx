'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  Upload,
  Download,
  Save,
  FileText,
  ChevronDown,
  ChevronRight,
  Tag,
  Search,
  Copy,
  Eye,
  EyeOff
} from 'lucide-react'
import mammoth from 'mammoth'
import PizZip from 'pizzip'
import { supabase } from '@/lib/supabase'

interface Placeholder {
  key: string
  label: string
  category: string
  description: string
}

interface PlaceholderGroup {
  [category: string]: Placeholder[]
}

interface DocumentTemplateEditorProps {
  bandoId: string
  onSave: (template: any) => void
  existingTemplate?: any
}

export default function DocumentTemplateEditor({
  bandoId,
  onSave,
  existingTemplate
}: DocumentTemplateEditorProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Stato del documento
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [documentHtml, setDocumentHtml] = useState('')
  const [modifiedHtml, setModifiedHtml] = useState('')
  const [hasChanges, setHasChanges] = useState(false)

  // Stato dei placeholder
  const [placeholders, setPlaceholders] = useState<Placeholder[]>([])
  const [placeholdersByCategory, setPlaceholdersByCategory] = useState<PlaceholderGroup>({})
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Sistema', 'Dati Aziendali']))
  const [searchTerm, setSearchTerm] = useState('')
  const [showPlaceholders, setShowPlaceholders] = useState(true)

  // Refs
  const editorRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadPlaceholders()
    if (existingTemplate) {
      loadExistingTemplate()
    }
  }, [existingTemplate])

  const loadPlaceholders = async () => {
    try {
      const response = await fetch('/api/get-client-columns')
      const data = await response.json()

      if (data.success) {
        setPlaceholders(data.placeholders)
        setPlaceholdersByCategory(data.placeholdersByCategory)
      } else {
        setError('Errore nel caricamento dei placeholder')
      }
    } catch (err) {
      console.error('Errore nel caricamento placeholder:', err)
      setError('Errore nel caricamento dei placeholder')
    }
  }

  const loadExistingTemplate = async () => {
    if (existingTemplate?.document_html) {
      setDocumentHtml(existingTemplate.document_html)
      setModifiedHtml(existingTemplate.document_html)
    }
  }

  const handleFileUpload = async (file: File) => {
    if (!file.name.endsWith('.docx')) {
      setError('Il file deve essere in formato .docx')
      return
    }

    setLoading(true)
    setError('')

    try {
      const arrayBuffer = await file.arrayBuffer()

      // Converti a HTML usando mammoth
      const result = await mammoth.convertToHtml({ arrayBuffer })

      setOriginalFile(file)
      setDocumentHtml(result.value)
      setModifiedHtml(result.value)
      setHasChanges(false)
      setSuccess('Documento caricato con successo')

      // Nascondi il messaggio di successo dopo 3 secondi
      setTimeout(() => setSuccess(''), 3000)

    } catch (err) {
      console.error('Errore nel caricamento file:', err)
      setError('Errore nel caricamento del documento')
    } finally {
      setLoading(false)
    }
  }

  const insertPlaceholder = (placeholder: Placeholder) => {
    const editor = editorRef.current
    if (!editor) return

    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) {
      setError('Seleziona prima un punto nel documento dove inserire il placeholder')
      return
    }

    const range = selection.getRangeAt(0)

    // Crea l'elemento placeholder
    const placeholderElement = document.createElement('span')
    placeholderElement.className = 'placeholder-tag bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm border border-blue-300'
    placeholderElement.setAttribute('data-placeholder', placeholder.key)
    placeholderElement.setAttribute('title', placeholder.description)
    placeholderElement.textContent = `{${placeholder.key}}`
    placeholderElement.contentEditable = 'false'

    // Inserisci il placeholder
    range.deleteContents()
    range.insertNode(placeholderElement)

    // Muovi il cursore dopo il placeholder
    range.setStartAfter(placeholderElement)
    range.setEndAfter(placeholderElement)
    selection.removeAllRanges()
    selection.addRange(range)

    // Aggiorna lo stato
    setModifiedHtml(editor.innerHTML)
    setHasChanges(true)
  }

  const handleEditorChange = () => {
    if (editorRef.current) {
      setModifiedHtml(editorRef.current.innerHTML)
      setHasChanges(true)
    }
  }

  const saveTemplate = async () => {
    if (!originalFile || !modifiedHtml.trim()) {
      setError('Carica un documento e apporta delle modifiche prima di salvare')
      return
    }

    setLoading(true)
    setError('')

    try {
      console.log('🔧 Generando file Word con placeholder modificati...')

      // PRIMA: Salva il file originale per riferimento
      const originalFileBuffer = await originalFile.arrayBuffer()
      const originalUint8Array = new Uint8Array(originalFileBuffer)
      let originalBase64File = ''
      const chunkSize = 8192
      for (let i = 0; i < originalUint8Array.length; i += chunkSize) {
        const chunk = originalUint8Array.slice(i, i + chunkSize)
        originalBase64File += String.fromCharCode.apply(null, Array.from(chunk))
      }
      originalBase64File = btoa(originalBase64File)

      // SECONDO: Modifica il documento Word originale preservando la formattazione
      console.log('📝 Modificando documento Word originale preservando formattazione...')

      // Importa Docxtemplater per manipolare il file Word
      const Docxtemplater = (await import('docxtemplater')).default
      const PizZip = (await import('pizzip')).default

      // Dichiara variabili per lo scope corretto
      let modifiedBase64File = ''
      let finalPlaceholdersInHtml = []

      try {
        // Carica il documento Word originale
        const originalZip = new PizZip(originalUint8Array)
        const doc = new Docxtemplater(originalZip, { paragraphLoop: true, linebreaks: true })

        // Estrai placeholder dall'HTML modificato
        const tempDiv = document.createElement('div')
        tempDiv.innerHTML = modifiedHtml

        // Funzione più robusta per estrarre placeholder
        const extractPlaceholdersSafely = (text: string): string[] => {
          const placeholders: string[] = []
          const regex = /\{[A-Z_]+\}/g
          let match: RegExpExecArray | null

          while ((match = regex.exec(text)) !== null) {
            const placeholder = match[0]
            if (typeof placeholder === 'string' && placeholder.length > 2 && !placeholders.includes(placeholder)) {
              placeholders.push(placeholder)
            }
          }

          return placeholders
        }

        const placeholdersInHtml = extractPlaceholdersSafely(tempDiv.textContent || '')
        console.log('🔍 Placeholder trovati nell\'HTML (sicuri):', placeholdersInHtml)

        finalPlaceholdersInHtml = placeholdersInHtml

        if (placeholdersInHtml.length === 0) {
          console.warn('⚠️ Nessun placeholder trovato nell\'editor - usando file originale')
          modifiedBase64File = originalBase64File
          finalPlaceholdersInHtml = []
        } else {
          // NUOVO APPROCCIO: Sostituisce underscore nel Word con placeholder dall'HTML
          const originalWordText = doc.getFullText()
          console.log('📄 Testo originale Word (primi 500 caratteri):', originalWordText.substring(0, 500))

          // Trova sequenze di underscore nel documento Word (possibili placeholder)
          const underscoreMatches = originalWordText.match(/__{2,}/g) || [] // 2+ underscore consecutivi
          console.log('🔍 Sequenze underscore trovate nel Word:', underscoreMatches.length)

          // Se abbiamo underscore nel Word e placeholder nell'HTML, mappiamoli
          if (underscoreMatches.length > 0 && placeholdersInHtml.length > 0) {
            console.log('🔄 Strategia: sostituzione underscore con placeholder nel XML')

            // Raggruppa underscore unici e assegna placeholder
            const uniqueUnderscores = Array.from(new Set(underscoreMatches))
            const uniquePlaceholders = Array.from(new Set(placeholdersInHtml))

            console.log('🔍 DEBUG: uniqueUnderscores:', uniqueUnderscores)
            console.log('🔍 DEBUG: uniquePlaceholders:', uniquePlaceholders)

            try {
              // Modifica direttamente l'XML del documento sostituendo underscore con placeholder
              const documentXml = doc.getZip().files['word/document.xml'].asText()
              let modifiedXml = documentXml

              uniqueUnderscores.slice(0, uniquePlaceholders.length).forEach((underscore, index) => {
                const placeholder = uniquePlaceholders[index]

                console.log(`🔍 DEBUG XML: Processing at index ${index}:`, {
                  underscore: underscore,
                  placeholder: placeholder,
                  underscoreType: typeof underscore,
                  placeholderType: typeof placeholder
                })

                // Verifica che entrambi siano stringhe
                if (typeof underscore !== 'string' || typeof placeholder !== 'string') {
                  console.warn('⚠️ XML: Skipping - non sono stringhe:', { underscore, placeholder })
                  return
                }

                try {
                  // Crea stringhe sicure
                  const underscoreStr = String(underscore)
                  const placeholderStr = String(placeholder)

                  // Escape dell'underscore per regex
                  const escapedUnderscore = underscoreStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
                  const regex = new RegExp(escapedUnderscore, 'g')
                  const beforeCount = (modifiedXml.match(regex) || []).length
                  modifiedXml = modifiedXml.replace(regex, placeholderStr)
                  const afterCount = (modifiedXml.match(regex) || []).length
                  console.log(`✅ XML: Sostituito ${beforeCount - afterCount} occorrenze di "${underscoreStr}" con "${placeholderStr}"`)
                } catch (xmlReplaceError) {
                  console.error('❌ XML: Errore sostituzione:', xmlReplaceError)
                }
              })

              // Ricarica il documento con il contenuto modificato
              (doc.getZip().files as any)['word/document.xml'] = {
                asText: () => modifiedXml,
                asUint8Array: () => new TextEncoder().encode(modifiedXml)
              }

              console.log('✅ Underscore sostituiti con placeholder nel XML')
            } catch (xmlError) {
              console.warn('⚠️ Impossibile modificare XML direttamente:', xmlError)
            }
          } else {
            console.log('🔄 Nessun underscore da sostituire o nessun placeholder da HTML')
          }

          // DEBUG: Verifica contenuto dopo la modifica XML
          const modifiedText = doc.getFullText()
          console.log('📄 Contenuto Word dopo modifica XML (primi 500 caratteri):', modifiedText.substring(0, 500))
          const placeholdersInModified = modifiedText.match(/\{[A-Z_]+\}/g)
          console.log('🔍 Placeholder effettivamente presenti nel Word modificato:', placeholdersInModified)

          // Genera il nuovo documento Word con placeholder preservati
          const modifiedWordBuffer = doc.getZip().generate({
            type: 'uint8array',
            compression: 'DEFLATE'
          })

          // Converti in base64
          modifiedBase64File = ''
          for (let i = 0; i < modifiedWordBuffer.length; i += chunkSize) {
            const chunk = modifiedWordBuffer.slice(i, i + chunkSize)
            modifiedBase64File += String.fromCharCode.apply(null, Array.from(chunk))
          }
          modifiedBase64File = btoa(modifiedBase64File)

          console.log('✅ File Word modificato mantenendo formattazione originale')

          // NUOVO: Salva il documento Word modificato nel bucket del bando
          try {
            const fileName = `template_${bandoId}_${originalFile.name}`
            const wordBlob = new Blob([modifiedWordBuffer], {
              type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            })

            console.log('💾 Salvando documento Word modificato nel bucket bandi-documenti...')

            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('bandi-documenti')
              .upload(`${bandoId}/${fileName}`, wordBlob, {
                contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                cacheControl: '3600',
                upsert: true // Sovrascrivi se esiste già
              })

            if (uploadError) {
              console.error('❌ Errore upload nel bucket:', uploadError)
            } else {
              console.log('✅ Documento Word salvato nel bucket:', uploadData?.path)
            }
          } catch (bucketError) {
            console.error('❌ Errore salvataggio nel bucket:', bucketError)
            // Non bloccare il salvataggio del template se il bucket fallisce
          }
        }
      } catch (docxError) {
        console.error('❌ Errore nella modifica Word, usando approccio semplificato:', docxError)

        // Fallback: usa approccio semplificato
        const { Document, Packer, Paragraph, TextRun } = await import('docx')
        const tempDiv = document.createElement('div')
        tempDiv.innerHTML = modifiedHtml
        const fullTextContent = tempDiv.textContent || tempDiv.innerText || ''
        finalPlaceholdersInHtml = (fullTextContent.match(/\{[A-Z_]+\}/g) || [])
          .filter(p => typeof p === 'string' && p.length > 2)

        const modifiedDoc = new Document({
          sections: [{
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: fullTextContent,
                    font: 'Calibri',
                    size: 22
                  })
                ]
              })
            ]
          }]
        })

        const modifiedWordBuffer = await Packer.toBuffer(modifiedDoc)
        const modifiedUint8Array = new Uint8Array(modifiedWordBuffer)

        modifiedBase64File = ''
        for (let i = 0; i < modifiedUint8Array.length; i += chunkSize) {
          const chunk = modifiedUint8Array.slice(i, i + chunkSize)
          modifiedBase64File += String.fromCharCode.apply(null, Array.from(chunk))
        }
        modifiedBase64File = btoa(modifiedBase64File)
      }

      console.log('✅ File Word con placeholder creato:', modifiedBase64File.length, 'caratteri in base64')

      const templateData = {
        bando_id: bandoId,
        file_name: originalFile.name,
        original_html: documentHtml,
        template_html: modifiedHtml,
        original_docx_base64: modifiedBase64File, // 🚀 AGGIORNATO: File Word CON placeholder
        original_file_backup: originalBase64File, // Backup del file originale senza modifiche
        placeholders_used: extractPlaceholdersFromHtml(modifiedHtml),
        placeholders_found: finalPlaceholdersInHtml?.length || 0,
        last_modified: new Date().toISOString()
      }

      await onSave(templateData)
      setHasChanges(false)

      // Filtra solo stringhe valide per il messaggio di successo
      const validPlaceholders = (finalPlaceholdersInHtml || []).filter(p => typeof p === 'string' && p.length > 0)
      const successMessage = validPlaceholders.length > 0
        ? `✅ Template salvato con ${validPlaceholders.length} placeholder: ${validPlaceholders.join(', ')}`
        : '⚠️ Template salvato ma nessun placeholder {PLACEHOLDER} trovato nell\'editor'

      setSuccess(successMessage)

      // Nascondi il messaggio di successo dopo 5 secondi
      setTimeout(() => setSuccess(''), 5000)

    } catch (err) {
      console.error('Errore nel salvataggio:', err)
      setError('Errore nel salvataggio del template')
    } finally {
      setLoading(false)
    }
  }

  const extractPlaceholdersFromHtml = (html: string): string[] => {
    const placeholderRegex = /\{([A-Z_]+)\}/g
    const matches: string[] = []
    let match

    while ((match = placeholderRegex.exec(html)) !== null) {
      if (!matches.includes(match[1])) {
        matches.push(match[1])
      }
    }

    return matches
  }

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(category)) {
      newExpanded.delete(category)
    } else {
      newExpanded.add(category)
    }
    setExpandedCategories(newExpanded)
  }

  const filteredPlaceholders = placeholders.filter(p =>
    p.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.key.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredPlaceholdersByCategory = Object.entries(placeholdersByCategory).reduce((acc, [category, items]) => {
    const filtered = items.filter(p =>
      p.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.key.toLowerCase().includes(searchTerm.toLowerCase())
    )
    if (filtered.length > 0) {
      acc[category] = filtered
    }
    return acc
  }, {} as PlaceholderGroup)

  return (
    <div className="grid grid-cols-12 gap-6 h-full">
      {/* Sidebar Placeholder */}
      {showPlaceholders && (
        <div className="col-span-3 bg-gray-50 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Placeholder Disponibili
            </h3>
            <button
              onClick={() => setShowPlaceholders(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <EyeOff className="w-4 h-4" />
            </button>
          </div>

          {/* Ricerca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Cerca placeholder..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>

          {/* Lista Placeholder per Categoria */}
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {Object.entries(filteredPlaceholdersByCategory).map(([category, items]) => (
              <div key={category} className="border border-gray-200 rounded-lg">
                <button
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center justify-between p-3 text-left text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  <span>{category} ({items.length})</span>
                  {expandedCategories.has(category) ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>

                {expandedCategories.has(category) && (
                  <div className="border-t border-gray-200">
                    {items.map((placeholder) => (
                      <button
                        key={placeholder.key}
                        onClick={() => insertPlaceholder(placeholder)}
                        className="w-full p-2 text-left text-xs hover:bg-blue-50 border-b border-gray-100 last:border-b-0 group"
                        title={placeholder.description}
                      >
                        <div className="font-medium text-gray-900 group-hover:text-blue-700">
                          {placeholder.label}
                        </div>
                        <div className="text-gray-500 font-mono text-xs">
                          {`{${placeholder.key}}`}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Editor Area */}
      <div className={`${showPlaceholders ? 'col-span-9' : 'col-span-12'} space-y-4`}>
        {/* Toolbar */}
        <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            {!showPlaceholders && (
              <button
                onClick={() => setShowPlaceholders(true)}
                className="text-gray-400 hover:text-gray-600 flex items-center gap-1"
              >
                <Eye className="w-4 h-4" />
                Placeholder
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".docx"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileUpload(file)
              }}
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              {originalFile ? 'Cambia Documento' : 'Carica Documento'}
            </button>

            {originalFile && (
              <span className="text-sm text-gray-600">
                {originalFile.name}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {hasChanges && (
              <span className="text-sm text-orange-600">
                • Modifiche non salvate
              </span>
            )}

            <button
              onClick={saveTemplate}
              disabled={loading || !hasChanges || !originalFile}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              Salva Template
            </button>
          </div>
        </div>

        {/* Messaggi */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-green-800 text-sm">{success}</p>
          </div>
        )}

        {/* Area Editor */}
        {documentHtml ? (
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b border-gray-200">
              <h4 className="font-medium text-gray-900 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Editor Template
              </h4>
              <p className="text-sm text-gray-600 mt-1">
                Clicca nel documento e inserisci placeholder dal pannello laterale
              </p>
            </div>

            <div
              ref={editorRef}
              contentEditable
              onInput={handleEditorChange}
              className="p-6 min-h-[500px] max-h-[70vh] overflow-y-auto prose max-w-none focus:outline-none"
              dangerouslySetInnerHTML={{ __html: modifiedHtml }}
              style={{
                fontFamily: 'Times New Roman, serif',
                lineHeight: '1.6',
                fontSize: '14px'
              }}
            />
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Carica un documento Word
            </h3>
            <p className="text-gray-600 mb-4">
              Carica un file .docx per iniziare a creare il template con placeholder
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <Upload className="w-4 h-4" />
              Seleziona Documento
            </button>
          </div>
        )}

        {/* Loading Overlay */}
        {loading && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 flex items-center gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span>Elaborazione in corso...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}