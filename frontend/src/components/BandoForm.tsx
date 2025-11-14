'use client'

import { useState, useEffect } from 'react'
import {
  X,
  Save,
  Calendar,
  FileText,
  Building2,
  Euro,
  Clock,
  AlertTriangle,
  Plus,
  Trash2,
  Upload,
  Eye,
  ArrowRight,
  Settings,
  ExternalLink,
  Download,
  AlertCircle
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

// Interfacce
interface TemplateScadenza {
  id?: string
  nome: string
  descrizione: string
  giorni_da_evento: number
  unita_tempo: 'giorni' | 'mesi' // Nuovo campo
  evento_riferimento: string
  tipo_scadenza: string
  priorita: 'bassa' | 'media' | 'alta' | 'critica'
  obbligatoria: boolean
  ordine_sequenza: number
  dipende_da_template_id?: string
  responsabile_suggerito?: string
  note_template?: string
}

interface BandoFormData {
  codice_bando: string
  nome: string
  descrizione: string
  ente_erogatore: string
  tipologia_bando: string
  contributo_massimo: number
  spesa_minima_ammessa: number
  percentuale_contributo: number
  regime_aiuto: 'DE_MINIMIS' | 'ESENZIONE' | 'NO_AIUTO_STATO' | 'ALTRO'
  data_pubblicazione: string
  data_apertura_presentazione: string
  data_chiusura_presentazione: string
  data_pubblicazione_graduatoria: string
  tempo_valutazione_giorni: number
  tipo_valutazione: 'A_PUNTEGGIO' | 'JUST_IN_TIME'
  stato_bando: string
  link_bando_ufficiale: string
  settori_ammessi: string[]
  dimensioni_aziendali_ammesse: string[]
  localizzazione_geografica: string
  note_interne: string
  referente_bando: string
  email_referente: string
}

interface BandoFormProps {
  onClose: () => void
  onBandoCreated: () => void
  bando?: any // Per modifica esistente
}

type TabType = 'generale' | 'scadenze' | 'documenti'

export default function BandoForm({ onClose, onBandoCreated, bando }: BandoFormProps) {
  const [activeTab, setActiveTab] = useState<TabType>('generale')
  const [loading, setLoading] = useState(false)

  // Dati del bando
  const [formData, setFormData] = useState<BandoFormData>({
    codice_bando: '',
    nome: '',
    descrizione: '',
    ente_erogatore: '',
    tipologia_bando: '',
    contributo_massimo: 0,
    spesa_minima_ammessa: 5000,
    percentuale_contributo: 0,
    regime_aiuto: 'DE_MINIMIS',
    data_pubblicazione: '',
    data_apertura_presentazione: '',
    data_chiusura_presentazione: '',
    data_pubblicazione_graduatoria: '',
    tempo_valutazione_giorni: 60,
    tipo_valutazione: 'A_PUNTEGGIO',
    stato_bando: 'APERTO',
    link_bando_ufficiale: '',
    settori_ammessi: [],
    dimensioni_aziendali_ammesse: [],
    localizzazione_geografica: '',
    note_interne: '',
    referente_bando: '',
    email_referente: ''
  })

  // Template scadenze
  const [templateScadenze, setTemplateScadenze] = useState<TemplateScadenza[]>([])
  const [showAddTemplate, setShowAddTemplate] = useState(false)

  // Documenti
  const [documenti, setDocumenti] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({})

  useEffect(() => {
    // Genera codice automatico per nuovo bando
    if (!bando) {
      generateCodiceBando()
    }

    if (bando) {
      // Popola form per modifica
      setFormData({
        codice_bando: bando.codice_bando || '',
        nome: bando.nome || '',
        descrizione: bando.descrizione || '',
        ente_erogatore: bando.ente_erogatore || '',
        tipologia_bando: bando.tipologia_bando || '',
        contributo_massimo: bando.contributo_massimo || 0,
        spesa_minima_ammessa: bando.spesa_minima_ammessa || 5000,
        percentuale_contributo: bando.percentuale_contributo || 0,
        regime_aiuto: bando.regime_aiuto || 'DE_MINIMIS',
        data_pubblicazione: bando.data_pubblicazione ? bando.data_pubblicazione.split('T')[0] : '',
        data_apertura_presentazione: bando.data_apertura_presentazione ? bando.data_apertura_presentazione.split('T')[0] : '',
        data_chiusura_presentazione: bando.data_chiusura_presentazione ? bando.data_chiusura_presentazione.split('T')[0] : '',
        data_pubblicazione_graduatoria: bando.data_pubblicazione_graduatoria ? bando.data_pubblicazione_graduatoria.split('T')[0] : '',
        tempo_valutazione_giorni: bando.tempo_valutazione_giorni || 60,
        tipo_valutazione: bando.tipo_valutazione || 'A_PUNTEGGIO',
        stato_bando: bando.stato_bando || 'APERTO',
        link_bando_ufficiale: bando.link_bando_ufficiale || '',
        settori_ammessi: bando.settori_ammessi || [],
        dimensioni_aziendali_ammesse: bando.dimensioni_aziendali_ammesse || [],
        localizzazione_geografica: bando.localizzazione_geografica || '',
        note_interne: bando.note_interne || '',
        referente_bando: bando.referente_bando || '',
        email_referente: bando.email_referente || ''
      })
      loadTemplateScadenze(bando.id)
      loadDocumenti(bando.id)
    } else {
      // Carica template scadenze predefiniti per nuovo bando
      loadTemplateDefault()
    }
  }, [bando])

  const generateCodiceBando = async () => {
    try {
      const { data, error } = await supabase
        .from('scadenze_bandi_bandi')
        .select('codice_bando')
        .order('created_at', { ascending: false })
        .limit(1)

      if (error) throw error

      let nuovoNumero = 1
      if (data && data.length > 0) {
        const ultimoCodice = data[0].codice_bando
        // Estrai numero dal codice (es. "BND-2024-003" -> 3)
        const match = ultimoCodice?.match(/BND-(\d{4})-(\d{3})/)
        if (match) {
          const anno = new Date().getFullYear()
          const ultimoAnno = parseInt(match[1])
          const ultimoNumero = parseInt(match[2])

          if (ultimoAnno === anno) {
            nuovoNumero = ultimoNumero + 1
          } else {
            nuovoNumero = 1
          }
        }
      }

      const anno = new Date().getFullYear()
      const numeroFormattato = nuovoNumero.toString().padStart(3, '0')
      const nuovoCodice = `BND-${anno}-${numeroFormattato}`

      setFormData(prev => ({ ...prev, codice_bando: nuovoCodice }))
    } catch (error) {
      console.error('Errore generazione codice:', error)
      // Fallback
      const anno = new Date().getFullYear()
      const fallbackCodice = `BND-${anno}-001`
      setFormData(prev => ({ ...prev, codice_bando: fallbackCodice }))
    }
  }

  const loadTemplateScadenze = async (bandoId: string) => {
    try {
      const { data, error } = await supabase
        .from('scadenze_bandi_template_scadenze')
        .select('*')
        .eq('bando_id', bandoId)
        .order('ordine_sequenza', { ascending: true })

      if (error) throw error

      // Converte i template dal database nel formato dell'interfaccia
      const templatesConverted = (data || []).map(template => ({
        id: template.id,
        nome: template.nome,
        descrizione: template.descrizione,
        giorni_da_evento: template.giorni_da_evento >= 60 ? Math.round(template.giorni_da_evento / 30) : template.giorni_da_evento,
        unita_tempo: template.giorni_da_evento >= 60 ? 'mesi' : 'giorni',
        evento_riferimento: template.evento_riferimento,
        tipo_scadenza: template.tipo_scadenza,
        priorita: template.priorita,
        obbligatoria: template.obbligatoria,
        ordine_sequenza: template.ordine_sequenza,
        dipende_da_template_id: template.dipende_da_template_id,
        responsabile_suggerito: template.responsabile_suggerito,
        note_template: template.note_template
      }))

      setTemplateScadenze(templatesConverted)
    } catch (error) {
      console.error('Errore caricamento template:', error)
    }
  }

  const loadDocumenti = async (bandoId: string) => {
    try {
      const { data, error } = await supabase
        .from('scadenze_bandi_documenti')
        .select('*')
        .eq('bando_id', bandoId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setDocumenti(data || [])
    } catch (error) {
      console.error('Errore caricamento documenti:', error)
    }
  }

  const handleFileUpload = async (files: FileList, categoria: 'normativa' | 'allegato' = 'allegato') => {
    if (!files.length) return

    // Se stiamo modificando un bando esistente, usa l'ID del bando
    // Altrimenti aspetta che il bando venga salvato
    if (!bando?.id) {
      alert('Salva prima il bando, poi potrai caricare i documenti')
      return
    }

    setUploading(true)

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const fileName = file.name
      const fileKey = `${Date.now()}-${fileName}`

      try {
        setUploadProgress(prev => ({ ...prev, [fileName]: 0 }))

        // Upload file to Supabase Storage
        const filePath = `${bando.id}/${fileKey}`

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('bandi-documenti')
          .upload(filePath, file)

        if (uploadError) throw uploadError

        setUploadProgress(prev => ({ ...prev, [fileName]: 50 }))

        // Determina tipo documento dalla categoria e dal nome file
        let tipoDocumento = categoria === 'normativa' ? 'decreto' : 'allegato'
        if (categoria === 'normativa') {
          if (fileName.toLowerCase().includes('bando')) tipoDocumento = 'bando'
          else if (fileName.toLowerCase().includes('decreto')) tipoDocumento = 'decreto'
          else tipoDocumento = 'normativa'
        } else {
          if (fileName.toLowerCase().includes('modulo') || fileName.toLowerCase().includes('domanda')) tipoDocumento = 'modulistica'
          else tipoDocumento = 'allegato'
        }

        // Salva record nel database
        const { data: docData, error: docError } = await supabase
          .from('scadenze_bandi_documenti')
          .insert({
            bando_id: bando.id,
            nome_file: fileName,
            nome_originale: fileName,
            tipo_documento: tipoDocumento,
            categoria: categoria,
            formato_file: file.type,
            dimensione_bytes: file.size,
            url_file: filePath,
            descrizione: `${categoria === 'normativa' ? 'Documento normativo' : 'Allegato da compilare'} caricato il ${new Date().toLocaleDateString('it-IT')}`
          })
          .select()
          .single()

        if (docError) throw docError

        setUploadProgress(prev => ({ ...prev, [fileName]: 100 }))

        // Aggiorna lista documenti
        setDocumenti(prev => [docData, ...prev])

      } catch (error: any) {
        console.error('Errore upload dettagliato:', {
          error,
          fileName,
          bando: bando?.id,
          message: error.message,
          details: error.details,
          hint: error.hint
        })
        alert(`Errore caricando ${fileName}: ${error.message || 'Errore sconosciuto'}`)
      }
    }

    setUploading(false)
    setUploadProgress({})
  }

  const deleteDocument = async (docId: string, urlFile: string) => {
    try {
      // Rimuovi da storage
      const { error: storageError } = await supabase.storage
        .from('bandi-documenti')
        .remove([urlFile])

      if (storageError) throw storageError

      // Rimuovi dal database
      const { error: dbError } = await supabase
        .from('scadenze_bandi_documenti')
        .delete()
        .eq('id', docId)

      if (dbError) throw dbError

      // Aggiorna lista
      setDocumenti(prev => prev.filter(doc => doc.id !== docId))
    } catch (error: any) {
      console.error('Errore eliminazione:', error)
      alert(`Errore eliminando documento: ${error.message}`)
    }
  }

  const downloadDocument = async (urlFile: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('bandi-documenti')
        .download(urlFile)

      if (error) throw error

      // Crea URL temporaneo per download
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error: any) {
      console.error('Errore download:', error)
      alert(`Errore scaricando documento: ${error.message}`)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const loadTemplateDefault = () => {
    // Template predefiniti per nuovo bando
    setTemplateScadenze([
      {
        nome: 'Accettazione Esiti',
        descrizione: 'Accettazione formale degli esiti del bando',
        giorni_da_evento: 30,
        unita_tempo: 'giorni',
        evento_riferimento: 'pubblicazione_graduatoria',
        tipo_scadenza: 'accettazione',
        priorita: 'critica',
        obbligatoria: true,
        ordine_sequenza: 1,
        responsabile_suggerito: 'amministrazione@blmproject.it',
        note_template: 'Scadenza critica per non perdere il finanziamento'
      },
      {
        nome: 'Avvio Progetto',
        descrizione: 'Comunicazione ufficiale di avvio del progetto',
        giorni_da_evento: 2,
        unita_tempo: 'mesi',
        evento_riferimento: 'accettazione_esiti',
        tipo_scadenza: 'avvio',
        priorita: 'alta',
        obbligatoria: true,
        ordine_sequenza: 2,
        responsabile_suggerito: 'progetti@blmproject.it',
        note_template: 'Invio della comunicazione di avvio attività'
      },
      {
        nome: 'Primo SAL',
        descrizione: 'Rendicontazione del primo Stato Avanzamento Lavori',
        giorni_da_evento: 6,
        unita_tempo: 'mesi',
        evento_riferimento: 'avvio_progetto',
        tipo_scadenza: 'sal',
        priorita: 'alta',
        obbligatoria: true,
        ordine_sequenza: 3,
        responsabile_suggerito: 'rendicontazione@blmproject.it',
        note_template: 'Prima rendicontazione del 50% del progetto'
      },
      {
        nome: 'Saldo Finale',
        descrizione: 'Rendicontazione finale e richiesta saldo',
        giorni_da_evento: 12,
        unita_tempo: 'mesi',
        evento_riferimento: 'avvio_progetto',
        tipo_scadenza: 'saldo',
        priorita: 'critica',
        obbligatoria: true,
        ordine_sequenza: 4,
        responsabile_suggerito: 'rendicontazione@blmproject.it',
        note_template: 'Rendicontazione finale del 100% del progetto'
      },
      {
        nome: 'Richiesta Proroga',
        descrizione: 'Eventuale richiesta di proroga del progetto',
        giorni_da_evento: 10,
        unita_tempo: 'mesi',
        evento_riferimento: 'avvio_progetto',
        tipo_scadenza: 'proroga',
        priorita: 'media',
        obbligatoria: false,
        ordine_sequenza: 5,
        responsabile_suggerito: 'progetti@blmproject.it',
        note_template: 'Proroga da richiedere almeno 60 giorni prima della scadenza naturale'
      },
      {
        nome: 'Chiusura Progetto',
        descrizione: 'Chiusura amministrativa e tecnica del progetto',
        giorni_da_evento: 14,
        unita_tempo: 'mesi',
        evento_riferimento: 'avvio_progetto',
        tipo_scadenza: 'chiusura_progetto',
        priorita: 'critica',
        obbligatoria: true,
        ordine_sequenza: 6,
        responsabile_suggerito: 'amministrazione@blmproject.it',
        note_template: 'Chiusura completa del progetto con tutti i documenti finali'
      }
    ])
  }

  const handleSave = async () => {
    if (!formData.nome || !formData.codice_bando) {
      alert('Nome bando e codice sono obbligatori')
      return
    }

    setLoading(true)
    try {
      // Prepara dati per salvataggio - rimuovi campi date vuoti
      const dataToSave = { ...formData }

      // Gestisci date vuote
      if (!dataToSave.data_pubblicazione) delete dataToSave.data_pubblicazione
      if (!dataToSave.data_apertura_presentazione) delete dataToSave.data_apertura_presentazione
      if (!dataToSave.data_chiusura_presentazione) delete dataToSave.data_chiusura_presentazione
      if (!dataToSave.data_pubblicazione_graduatoria) delete dataToSave.data_pubblicazione_graduatoria

      // Gestisci campi numerici
      if (!dataToSave.contributo_massimo) dataToSave.contributo_massimo = 0
      if (!dataToSave.spesa_minima_ammessa) dataToSave.spesa_minima_ammessa = 5000
      if (!dataToSave.percentuale_contributo) dataToSave.percentuale_contributo = 0
      if (!dataToSave.tempo_valutazione_giorni) dataToSave.tempo_valutazione_giorni = 60

      // Gestisci enum
      if (!dataToSave.regime_aiuto) dataToSave.regime_aiuto = 'DE_MINIMIS'

      let bandoId: string

      if (bando?.id) {
        // Modifica esistente
        const { error } = await supabase
          .from('scadenze_bandi_bandi')
          .update(dataToSave)
          .eq('id', bando.id)

        if (error) throw error
        bandoId = bando.id
      } else {
        // Nuovo bando
        const { data, error } = await supabase
          .from('scadenze_bandi_bandi')
          .insert([dataToSave])
          .select()
          .single()

        if (error) throw error
        bandoId = data.id
      }

      // Salva template scadenze
      await saveTemplateScadenze(bandoId)

      onBandoCreated()
      onClose()
    } catch (error: any) {
      console.error('Errore nel salvataggio dettagliato:', {
        error,
        formData,
        bandoId: bando?.id,
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })
      alert(`Errore nel salvataggio del bando: ${error.message || 'Errore sconosciuto'}`)
    } finally {
      setLoading(false)
    }
  }

  const saveTemplateScadenze = async (bandoId: string) => {
    try {
      // Elimina template esistenti se è una modifica
      if (bando?.id) {
        await supabase
          .from('scadenze_bandi_template_scadenze')
          .delete()
          .eq('bando_id', bandoId)
      }

      // Inserisci i nuovi template
      if (templateScadenze.length > 0) {
        const templatesWithBandoId = templateScadenze.map(template => {
          // Mappa solo i campi che esistono nella tabella
          return {
            bando_id: bandoId,
            nome: template.nome,
            descrizione: template.descrizione,
            giorni_da_evento: template.unita_tempo === 'mesi'
              ? template.giorni_da_evento * 30
              : template.giorni_da_evento,
            evento_riferimento: template.evento_riferimento,
            tipo_scadenza: template.tipo_scadenza,
            priorita: template.priorita,
            obbligatoria: template.obbligatoria,
            ordine_sequenza: template.ordine_sequenza,
            dipende_da_template_id: template.dipende_da_template_id,
            responsabile_suggerito: template.responsabile_suggerito,
            note_template: template.note_template
          }
        })

        const { error } = await supabase
          .from('scadenze_bandi_template_scadenze')
          .insert(templatesWithBandoId)

        if (error) throw error
      }
    } catch (error: any) {
      console.error('Errore salvataggio template dettagliato:', {
        error,
        bandoId,
        templateCount: templateScadenze.length,
        message: error.message,
        details: error.details,
        hint: error.hint
      })
      throw error
    }
  }

  const addTemplateScadenza = () => {
    const newTemplate: TemplateScadenza = {
      nome: '',
      descrizione: '',
      giorni_da_evento: 30,
      unita_tempo: 'giorni',
      evento_riferimento: 'pubblicazione_graduatoria',
      tipo_scadenza: 'comunicazione',
      priorita: 'media',
      obbligatoria: true,
      ordine_sequenza: templateScadenze.length + 1
    }
    setTemplateScadenze([...templateScadenze, newTemplate])
    setShowAddTemplate(false)
  }

  const removeTemplateScadenza = (index: number) => {
    setTemplateScadenze(templateScadenze.filter((_, i) => i !== index))
  }

  const updateTemplateScadenza = (index: number, field: string, value: any) => {
    const updated = [...templateScadenze]
    updated[index] = { ...updated[index], [field]: value }
    setTemplateScadenze(updated)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0
    }).format(amount)
  }

  const tabs = [
    { id: 'generale', label: 'Dati Bando', icon: Building2 },
    { id: 'scadenze', label: 'Template Scadenze', icon: Clock },
    { id: 'documenti', label: 'Documenti', icon: FileText }
  ]

  const eventiRiferimento = [
    { value: 'pubblicazione_bando', label: 'Pubblicazione Bando' },
    { value: 'pubblicazione_graduatoria', label: 'Pubblicazione Graduatoria' },
    { value: 'accettazione_esiti', label: 'Accettazione Esiti' },
    { value: 'avvio_progetto', label: 'Avvio Progetto' },
    { value: 'conclusione_progetto', label: 'Conclusione Progetto' }
  ]

  const tipiScadenza = [
    { value: 'accettazione', label: 'Accettazione' },
    { value: 'avvio', label: 'Avvio' },
    { value: 'sal', label: 'SAL' },
    { value: 'saldo', label: 'Saldo' },
    { value: 'rendicontazione', label: 'Rendicontazione' },
    { value: 'comunicazione', label: 'Comunicazione' },
    { value: 'proroga', label: 'Proroga' },
    { value: 'chiusura_progetto', label: 'Chiusura Progetto' }
  ]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full h-full max-h-[95vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {bando ? 'Modifica Bando' : 'Nuovo Bando'}
            </h2>
            <p className="text-gray-600">
              {bando ? 'Modifica i dati del bando esistente' : 'Crea un nuovo bando con template scadenze'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b">
          <div className="flex">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`px-6 py-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-primary-600 bg-blue-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {/* Tab Generale */}
          {activeTab === 'generale' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Informazioni Base */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Building2 className="w-5 h-5" />
                    Informazioni Base
                  </h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Codice Bando *
                    </label>
                    {bando ? (
                      <div className="w-full px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-700">
                        {formData.codice_bando}
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={formData.codice_bando}
                        onChange={(e) => setFormData({...formData, codice_bando: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                        placeholder="es. INN-2024-001"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nome Bando *
                    </label>
                    <input
                      type="text"
                      value={formData.nome}
                      onChange={(e) => setFormData({...formData, nome: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                      placeholder="es. Bando Innovazione Digitale 2024"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ente Erogatore
                    </label>
                    <input
                      type="text"
                      value={formData.ente_erogatore}
                      onChange={(e) => setFormData({...formData, ente_erogatore: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                      placeholder="es. Regione Lombardia"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Tipologia Bando
                    </label>
                    <select
                      value={formData.tipologia_bando}
                      onChange={(e) => setFormData({...formData, tipologia_bando: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Seleziona tipologia</option>
                      <option value="Innovazione">Innovazione</option>
                      <option value="Digitalizzazione">Digitalizzazione</option>
                      <option value="Sostenibilità">Sostenibilità</option>
                      <option value="Ricerca e Sviluppo">Ricerca e Sviluppo</option>
                      <option value="Internazionalizzazione">Internazionalizzazione</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Stato Bando
                    </label>
                    <div className="px-3 py-2 border border-gray-200 rounded-md bg-gray-50 text-gray-600">
                      Calcolato automaticamente dalle date
                    </div>
                  </div>
                </div>

                {/* Aspetti Economici */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Euro className="w-5 h-5" />
                    Aspetti Economici
                  </h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contributo Massimo (€)
                    </label>
                    <input
                      type="number"
                      value={formData.contributo_massimo}
                      onChange={(e) => setFormData({...formData, contributo_massimo: Number(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                      placeholder="50000"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Spesa Minima Ammessa (€)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.spesa_minima_ammessa}
                      onChange={(e) => setFormData({...formData, spesa_minima_ammessa: Number(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                      placeholder="5000"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Percentuale Contributo (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.percentuale_contributo}
                      onChange={(e) => setFormData({...formData, percentuale_contributo: Number(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                      placeholder="50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Regime di Aiuto
                    </label>
                    <select
                      value={formData.regime_aiuto}
                      onChange={(e) => setFormData({...formData, regime_aiuto: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="DE_MINIMIS">De Minimis</option>
                      <option value="ESENZIONE">Esenzione</option>
                      <option value="NO_AIUTO_STATO">No Aiuto di Stato</option>
                      <option value="ALTRO">Altro</option>
                    </select>
                  </div>

                  <div className="bg-blue-50 p-3 rounded-md">
                    <p className="text-sm text-primary-700">
                      <strong>Contributo Max:</strong> {formatCurrency(formData.contributo_massimo)} |
                      <strong>Spesa Min:</strong> {formatCurrency(formData.spesa_minima_ammessa)} |
                      <strong>Regime:</strong> {formData.regime_aiuto.replace('_', ' ')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Scadenze Temporali */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Date del Bando
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data Pubblicazione
                  </label>
                  <input
                    type="date"
                    value={formData.data_pubblicazione}
                    onChange={(e) => setFormData({...formData, data_pubblicazione: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Apertura Presentazione
                  </label>
                  <input
                    type="date"
                    value={formData.data_apertura_presentazione}
                    onChange={(e) => setFormData({...formData, data_apertura_presentazione: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Chiusura Presentazione
                  </label>
                  <input
                    type="date"
                    value={formData.data_chiusura_presentazione}
                    onChange={(e) => setFormData({...formData, data_chiusura_presentazione: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo Valutazione
                  </label>
                  <select
                    value={formData.tipo_valutazione}
                    onChange={(e) => setFormData({...formData, tipo_valutazione: e.target.value as 'A_PUNTEGGIO' | 'JUST_IN_TIME'})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="A_PUNTEGGIO">A Punteggio</option>
                    <option value="JUST_IN_TIME">Just in Time</option>
                  </select>
                </div>
              </div>

              {/* Date Eventi Critici */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data Pubblicazione Graduatoria ⭐
                  </label>
                  <input
                    type="date"
                    value={formData.data_pubblicazione_graduatoria}
                    onChange={(e) => setFormData({...formData, data_pubblicazione_graduatoria: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                  />
                  <p className="text-xs text-primary-600 mt-1">
                    Trigger principale per scadenze progetti
                  </p>
                </div>

                {/* Placeholder per future date critiche */}
                <div className="col-span-2 bg-primary-50 p-4 rounded-lg border border-primary-200">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-primary-600" />
                    <h4 className="font-medium text-primary-900">Date Eventi Trigger</h4>
                  </div>
                  <p className="text-sm text-primary-700">
                    La <strong>Data Pubblicazione Graduatoria</strong> è fondamentale per calcolare automaticamente
                    le scadenze dei progetti collegati a questo bando. Inseriscila quando il bando è concluso
                    e puoi creare i progetti.
                  </p>
                  {formData.data_pubblicazione_graduatoria && (
                    <div className="mt-2 text-sm text-green-700">
                      ✅ Data impostata: {new Date(formData.data_pubblicazione_graduatoria).toLocaleDateString('it-IT')}
                    </div>
                  )}
                </div>
              </div>
            </div>

              {/* Descrizione e Note */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrizione
                  </label>
                  <textarea
                    value={formData.descrizione}
                    onChange={(e) => setFormData({...formData, descrizione: e.target.value})}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                    placeholder="Descrizione dettagliata del bando..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Note Interne
                  </label>
                  <textarea
                    value={formData.note_interne}
                    onChange={(e) => setFormData({...formData, note_interne: e.target.value})}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                    placeholder="Note interne per il team..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tab Template Scadenze */}
          {activeTab === 'scadenze' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Template Scadenze</h3>
                  <p className="text-sm text-gray-600">
                    Definisci le scadenze tipo che verranno applicate ai progetti derivanti da questo bando
                  </p>
                </div>
                <button
                  onClick={addTemplateScadenza}
                  className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Aggiungi Scadenza
                </button>
              </div>

              <div className="space-y-4">
                {templateScadenze.map((template, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Nome Scadenza
                          </label>
                          <input
                            type="text"
                            value={template.nome}
                            onChange={(e) => updateTemplateScadenza(index, 'nome', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                            placeholder="es. Accettazione Esiti"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Tipo Scadenza
                          </label>
                          <select
                            value={template.tipo_scadenza}
                            onChange={(e) => updateTemplateScadenza(index, 'tipo_scadenza', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          >
                            {tipiScadenza.map(tipo => (
                              <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Tempo dall'evento
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              value={template.giorni_da_evento}
                              onChange={(e) => updateTemplateScadenza(index, 'giorni_da_evento', Number(e.target.value))}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                              placeholder="30"
                            />
                            <select
                              value={template.unita_tempo}
                              onChange={(e) => updateTemplateScadenza(index, 'unita_tempo', e.target.value)}
                              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                            >
                              <option value="giorni">giorni</option>
                              <option value="mesi">mesi</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Evento di riferimento
                          </label>
                          <select
                            value={template.evento_riferimento}
                            onChange={(e) => updateTemplateScadenza(index, 'evento_riferimento', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          >
                            {eventiRiferimento.map(evento => (
                              <option key={evento.value} value={evento.value}>{evento.label}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Priorità
                          </label>
                          <select
                            value={template.priorita}
                            onChange={(e) => updateTemplateScadenza(index, 'priorita', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          >
                            <option value="bassa">Bassa</option>
                            <option value="media">Media</option>
                            <option value="alta">Alta</option>
                            <option value="critica">Critica</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Responsabile
                          </label>
                          <input
                            type="email"
                            value={template.responsabile_suggerito || ''}
                            onChange={(e) => updateTemplateScadenza(index, 'responsabile_suggerito', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                            placeholder="email@blmproject.it"
                          />
                        </div>
                      </div>

                      <button
                        onClick={() => removeTemplateScadenza(index)}
                        className="text-red-600 hover:text-red-800 ml-4"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Descrizione
                      </label>
                      <textarea
                        value={template.descrizione}
                        onChange={(e) => updateTemplateScadenza(index, 'descrizione', e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        placeholder="Descrizione della scadenza..."
                      />
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={template.obbligatoria}
                          onChange={(e) => updateTemplateScadenza(index, 'obbligatoria', e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <label>Obbligatoria</label>
                      </div>

                      <div className="text-gray-500">
                        Ordine: {template.ordine_sequenza}
                      </div>

                      <div className="text-primary-600 font-medium">
                        {template.giorni_da_evento} {template.unita_tempo} da {eventiRiferimento.find(e => e.value === template.evento_riferimento)?.label}
                      </div>
                    </div>

                    {template.note_template && (
                      <div className="bg-yellow-50 p-2 rounded text-sm">
                        <strong>Note:</strong> {template.note_template}
                      </div>
                    )}
                  </div>
                ))}

                {templateScadenze.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Clock className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">Nessuna scadenza template</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Aggiungi delle scadenze template per automatizzare i progetti
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab Documenti */}
          {activeTab === 'documenti' && (
            <div className="space-y-6">
              {/* Link Bando Ufficiale */}
              <div className="bg-primary-50 p-4 rounded-lg border border-primary-200">
                <div className="flex items-center gap-3 mb-3">
                  <ExternalLink className="w-5 h-5 text-primary-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Link Bando Ufficiale</h3>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Inserisci l'URL della pagina ufficiale del bando sul sito dell'ente erogatore
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    URL Bando Ufficiale
                  </label>
                  <input
                    type="url"
                    value={formData.link_bando_ufficiale}
                    onChange={(e) => setFormData({...formData, link_bando_ufficiale: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500"
                    placeholder="https://www.ente.gov.it/bando-innovazione-2024"
                  />
                  {formData.link_bando_ufficiale && (
                    <div className="mt-2 flex items-center gap-2 text-sm">
                      <span className="text-green-600">✓ Link inserito</span>
                      <span className="text-gray-500">|</span>
                      <a
                        href={formData.link_bando_ufficiale}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Anteprima link
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Upload Documenti - NORMATIVA */}
              <div className="space-y-6">
                {/* Sezione Normativa */}
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-600" />
                        Normativa
                      </h3>
                      <p className="text-sm text-gray-600">
                        Documenti ufficiali del bando (decreto, avviso pubblico, disciplinare)
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!bando?.id && (
                        <div className="flex items-center gap-1 text-sm text-amber-600">
                          <AlertCircle className="w-4 h-4" />
                          Salva prima il bando
                        </div>
                      )}
                      <label className={`${bando?.id ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-400'} text-white px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer transition-colors`}>
                        <Upload className="w-4 h-4" />
                        {uploading ? 'Caricando...' : 'Carica Normativa'}
                        <input
                          type="file"
                          multiple
                          accept=".pdf,.doc,.docx"
                          onChange={(e) => e.target.files && handleFileUpload(e.target.files, 'normativa')}
                          disabled={!bando?.id || uploading}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Area Drop per normativa */}
                  <div
                    className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                      bando?.id ? 'border-blue-300 hover:border-blue-400' : 'border-gray-200'
                    }`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      if (bando?.id && e.dataTransfer.files) {
                        handleFileUpload(e.dataTransfer.files, 'normativa')
                      }
                    }}
                  >
                    <FileText className={`mx-auto h-8 w-8 ${bando?.id ? 'text-blue-400' : 'text-gray-300'}`} />
                    <h4 className="mt-2 text-sm font-medium text-gray-900">
                      {bando?.id ? 'Trascina documenti normativi qui' : 'Salva il bando per caricare documenti'}
                    </h4>
                    <p className="mt-1 text-sm text-gray-500">
                      Supportati: PDF, DOC, DOCX (max 10MB)
                    </p>
                  </div>

                  {/* Lista documenti normativa */}
                  {documenti.filter(doc => doc.categoria === 'normativa').length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-gray-700">Documenti caricati:</h4>
                      <div className="grid gap-2">
                        {documenti.filter(doc => doc.categoria === 'normativa').map((documento) => (
                          <div key={documento.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                            <div className="flex items-center space-x-3">
                              <FileText className="w-4 h-4 text-blue-500" />
                              <div>
                                <p className="text-sm font-medium text-gray-900">{documento.nome_file}</p>
                                <p className="text-xs text-gray-500">
                                  {documento.dimensione_bytes && `${Math.round(documento.dimensione_bytes / 1024)} KB`} •
                                  {new Date(documento.created_at).toLocaleString('it-IT')}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              {documento.url_file && (
                                <button
                                  onClick={() => downloadDocument(documento.url_file, documento.nome_file)}
                                  className="p-1 text-gray-400 hover:text-blue-500 transition-colors"
                                  title="Visualizza"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  if (window.confirm(`Sei sicuro di voler eliminare "${documento.nome_file}"?`)) {
                                    deleteDocument(documento.id, documento.url_file)
                                  }
                                }}
                                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                title="Elimina"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Sezione Allegati */}
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <Upload className="w-5 h-5 text-green-600" />
                        Allegati da Compilare
                      </h3>
                      <p className="text-sm text-gray-600">
                        Moduli e allegati che i clienti dovranno compilare (domanda di partecipazione, etc.)
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!bando?.id && (
                        <div className="flex items-center gap-1 text-sm text-amber-600">
                          <AlertCircle className="w-4 h-4" />
                          Salva prima il bando
                        </div>
                      )}
                      <label className={`${bando?.id ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-400'} text-white px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer transition-colors`}>
                        <Upload className="w-4 h-4" />
                        {uploading ? 'Caricando...' : 'Carica Allegato'}
                        <input
                          type="file"
                          multiple
                          accept=".pdf,.doc,.docx,.xls,.xlsx"
                          onChange={(e) => e.target.files && handleFileUpload(e.target.files, 'allegato')}
                          disabled={!bando?.id || uploading}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                  {/* Area Drop per allegati */}
                  <div
                    className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                      bando?.id ? 'border-green-300 hover:border-green-400' : 'border-gray-200'
                    }`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      if (bando?.id && e.dataTransfer.files) {
                        handleFileUpload(e.dataTransfer.files, 'allegato')
                      }
                    }}
                  >
                    <Upload className={`mx-auto h-8 w-8 ${bando?.id ? 'text-green-400' : 'text-gray-300'}`} />
                    <h4 className="mt-2 text-sm font-medium text-gray-900">
                      {bando?.id ? 'Trascina allegati da compilare qui' : 'Salva il bando per caricare documenti'}
                    </h4>
                    <p className="mt-1 text-sm text-gray-500">
                      Supportati: PDF, DOC, DOCX, XLS, XLSX (max 10MB)
                    </p>
                  </div>

                  {/* Lista documenti allegati */}
                  {documenti.filter(doc => doc.categoria === 'allegato').length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-gray-700">Allegati caricati:</h4>
                      <div className="grid gap-2">
                        {documenti.filter(doc => doc.categoria === 'allegato').map((documento) => (
                          <div key={documento.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                            <div className="flex items-center space-x-3">
                              <Upload className="w-4 h-4 text-green-500" />
                              <div>
                                <p className="text-sm font-medium text-gray-900">{documento.nome_file}</p>
                                <p className="text-xs text-gray-500">
                                  {documento.dimensione_bytes && `${Math.round(documento.dimensione_bytes / 1024)} KB`} •
                                  {new Date(documento.created_at).toLocaleString('it-IT')}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              {documento.url_file && (
                                <button
                                  onClick={() => downloadDocument(documento.url_file, documento.nome_file)}
                                  className="p-1 text-gray-400 hover:text-green-500 transition-colors"
                                  title="Visualizza"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  if (window.confirm(`Sei sicuro di voler eliminare "${documento.nome_file}"?`)) {
                                    deleteDocument(documento.id, documento.url_file)
                                  }
                                }}
                                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                title="Elimina"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Progress upload */}
                {Object.keys(uploadProgress).length > 0 && (
                  <div className="space-y-2">
                    {Object.entries(uploadProgress).map(([fileName, progress]) => (
                      <div key={fileName} className="bg-blue-50 p-3 rounded-lg">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium">{fileName}</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="w-full bg-blue-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t bg-gray-50 flex-shrink-0">
          <div className="text-sm text-gray-500">
            {activeTab === 'scadenze' && templateScadenze.length > 0 && (
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                {templateScadenze.length} template scadenze configurati
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Annulla
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Salvataggio...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {bando ? 'Aggiorna Bando' : 'Crea Bando'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}