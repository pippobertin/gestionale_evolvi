'use client'

import { useState, useEffect } from 'react'
import {
  X,
  Save,
  Calendar,
  Building2,
  Euro,
  User,
  FileText,
  Clock,
  AlertTriangle,
  CheckCircle,
  Upload,
  Eye,
  Trash2,
  Download,
  AlertCircle
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useSession, signIn, signOut } from 'next-auth/react'
import DocumentiProgettoPreview from './DocumentiProgettoPreview'
import DocumentPreviewModal from './DocumentPreviewModal'

interface ProgettoFormData {
  bando_id: string
  cliente_id: string
  codice_progetto: string
  titolo_progetto: string
  descrizione_progetto: string
  stato: 'DECRETO_ATTESO' | 'DECRETO_RICEVUTO' | 'ACCETTATO' | 'IN_CORSO' | 'COMPLETATO'
  importo_totale_progetto: number
  contributo_ammesso: number
  percentuale_contributo: number
  data_base_calcolo: string | null
  evento_base_id: string | null
  // Campi dinamici per eventi progetto (saranno popolati dinamicamente)
  eventi_progetto: { [eventoId: string]: string | null } // date degli eventi specifici del progetto
  anticipo_richiedibile: boolean
  percentuale_anticipo: number
  numero_sal: 'UNICO' | 'DUE' | 'TRE'
  proroga_richiedibile: boolean
  referente_interno: string
  email_referente_interno: string
  note_progetto: string
}

interface Bando {
  id: string
  nome: string
  codice_bando: string
  contributo_massimo: number
  percentuale_contributo: number
  tipologia_bando: string
}

interface Cliente {
  id: string
  denominazione: string
  partita_iva: string
  codice_fiscale: string
}

interface ProgettoFormProps {
  onClose: () => void
  onProgettoCreated: () => void
  onDelete?: (progettoId: string) => void
  bando?: Bando
  cliente?: Cliente
  progetto?: any // Per modifica esistente
}

type TabType = 'generale' | 'importi' | 'scadenze' | 'documenti' | 'avanzate'

export default function ProgettoForm({ onClose, onProgettoCreated, onDelete, bando, cliente, progetto }: ProgettoFormProps) {
  const [activeTab, setActiveTab] = useState<TabType>('generale')
  const [loading, setLoading] = useState(false)

  // Google Drive session
  const { data: session, status } = useSession()

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [])
  const [bandi, setBandi] = useState<Bando[]>([])
  const [clienti, setClienti] = useState<Cliente[]>([])
  const [templateScadenze, setTemplateScadenze] = useState<any[]>([])
  const [scadenzeSalvate, setScadenzeSalvate] = useState<any[]>([])
  const [dateEffettiveScadenze, setDateEffettiveScadenze] = useState<{[scadenzaId: string]: string}>({})
  const [bandoSelezionato, setBandoSelezionato] = useState<any>(null)

  // Stati per gestione eventi dinamici
  const [eventiCatalogo, setEventiCatalogo] = useState<any[]>([])
  const [eventiDelBando, setEventiDelBando] = useState<any[]>([]) // eventi usati nei template del bando
  const [dateCalcolateBando, setDateCalcolateBando] = useState<{ [eventoId: string]: string }>({}) // date calcolate dal bando

  // Stati per documenti
  const [documenti, setDocumenti] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({})
  const [previewModal, setPreviewModal] = useState<{
    isOpen: boolean
    documento: { nome_file: string; google_drive_id: string } | null
  }>({ isOpen: false, documento: null })

  // Stati per modal di visualizzazione documento
  const [documentModal, setDocumentModal] = useState<{
    open: boolean;
    title: string;
    url: string;
    type: string;
  }>({
    open: false,
    title: '',
    url: '',
    type: ''
  })

  const [formData, setFormData] = useState<ProgettoFormData>({
    bando_id: bando?.id || '',
    cliente_id: cliente?.id || '',
    codice_progetto: '',
    titolo_progetto: '',
    descrizione_progetto: '',
    stato: 'DECRETO_ATTESO',
    importo_totale_progetto: 0,
    contributo_ammesso: 0,
    percentuale_contributo: bando?.percentuale_contributo || 0,
    data_base_calcolo: '',
    evento_base_id: '',
    eventi_progetto: {},
    anticipo_richiedibile: true,
    percentuale_anticipo: 30,
    numero_sal: 'DUE',
    proroga_richiedibile: true,
    referente_interno: '',
    email_referente_interno: '',
    note_progetto: ''
  })

  useEffect(() => {
    const initializeForm = async () => {
      await loadBandi()
      await loadClienti()

      if (progetto) {
        // Modifica progetto esistente - pre-popola tutti i campi
        setFormData({
          bando_id: progetto.bando_id || '',
          cliente_id: progetto.cliente_id || '',
          codice_progetto: progetto.codice_progetto || '',
          titolo_progetto: progetto.titolo_progetto || '',
          descrizione_progetto: progetto.descrizione_progetto || '',
          stato: progetto.stato || 'DECRETO_ATTESO',
          importo_totale_progetto: progetto.importo_totale_progetto || 0,
          contributo_ammesso: progetto.contributo_ammesso || 0,
          percentuale_contributo: progetto.percentuale_contributo || 0,
          data_base_calcolo: progetto.data_base_calcolo ? progetto.data_base_calcolo.split('T')[0] : '',
          evento_base_id: progetto.evento_base_id || '',
          eventi_progetto: {},
          anticipo_richiedibile: progetto.anticipo_richiedibile || true,
          percentuale_anticipo: progetto.percentuale_anticipo || 30,
          numero_sal: progetto.numero_sal || 'DUE',
          proroga_richiedibile: progetto.proroga_richiedibile !== false,
          referente_interno: progetto.referente_interno || '',
          email_referente_interno: progetto.email_referente_interno || '',
          note_progetto: progetto.note_progetto || ''
        })

        // Carica documenti per progetto esistente
        loadDocumenti(progetto.id)
        // Carica scadenze per progetto esistente
        loadScadenze(progetto.id)
    } else {
      // Nuovo progetto
      await generateCodiceProgetto()

      // Se passato un bando, pre-popola i campi
      if (bando) {
        const dataEreditata = bando.data_base_calcolo ?
          bando.data_base_calcolo.split('T')[0] : ''

        setFormData(prev => ({
          ...prev,
          contributo_ammesso: bando.contributo_massimo,
          percentuale_contributo: bando.percentuale_contributo,
          data_base_calcolo: dataEreditata,
          evento_base_id: bando.evento_base_id || ''
        }))

        loadDocumenti('')  // Per nuovo progetto
      }
    }
    }

    initializeForm()
  }, [bando, progetto])

  // Funzione per aggiornare il titolo progetto
  const updateTitoloProgetto = () => {
    const selectedBando = bando || bandi.find(b => b.id === formData.bando_id)
    const selectedCliente = cliente || clienti.find(c => c.id === formData.cliente_id)

    if (selectedBando) {
      let nuovoTitolo = `Progetto ${selectedBando.nome}`
      if (selectedCliente) {
        nuovoTitolo += ` ${selectedCliente.denominazione}`
      }
      setFormData(prev => ({ ...prev, titolo_progetto: nuovoTitolo }))
    }
  }

  // Aggiorna il titolo quando cambiano bando o cliente
  useEffect(() => {
    updateTitoloProgetto()
  }, [formData.bando_id, formData.cliente_id, bandi, clienti])

  // Carica template scadenze quando cambia il bando selezionato
  useEffect(() => {
    if (formData.bando_id) {
      loadBandoConTemplate(formData.bando_id)
    }
  }, [formData.bando_id])

  // Carica anche il bando pre-selezionato se passato come prop
  useEffect(() => {
    if (bando && bando.id && !bandoSelezionato) {
      loadBandoConTemplate(bando.id)
    }
  }, [bando, bandoSelezionato])

  // Effetto aggiuntivo per mostrare scadenze calcolate quando cambiano i dati rilevanti
  useEffect(() => {
    if (formData.bando_id && (formData.data_base_calcolo || bandoSelezionato?.data_base_calcolo)) {
      // Le scadenze vengono calcolate automaticamente quando viene renderizzato il tab "scadenze"
    }
  }, [formData.bando_id, formData.data_base_calcolo,
      bandoSelezionato, templateScadenze])

  // Effetto separato per caricare documenti quando il bando è disponibile (per nuovi progetti)
  useEffect(() => {
    if (!progetto && formData.bando_id) {
      loadDocumenti('')
    }
  }, [formData.bando_id, progetto])

  // Effetto per ricalcolare le scadenze quando cambiano le date degli eventi del progetto
  useEffect(() => {
    if (templateScadenze.length > 0 && formData.bando_id && Object.keys(formData.eventi_progetto).length > 0) {
      ricalcolaScadenzeProgetto()
    }
  }, [formData.eventi_progetto, templateScadenze, formData.bando_id])

  // Effetto per ricalcolare le scadenze quando cambiano le date effettive
  useEffect(() => {
    if (Object.keys(dateEffettiveScadenze).length > 0 && scadenzeSalvate.length > 0) {
      ricalcolaScadenzeConDateEffettive()
    }
  }, [dateEffettiveScadenze])

  const loadBandi = async () => {
    try {
      const { data, error } = await supabase
        .from('scadenze_bandi_bandi')
        .select('id, nome, codice_bando, contributo_massimo, percentuale_contributo, tipologia_bando, data_base_calcolo, evento_base_id')
        .order('nome')

      if (error) throw error
      setBandi(data || [])
    } catch (error) {
      console.error('❌ Errore caricamento bandi:', error.message)
    }
  }

  const loadBandoConTemplate = async (bandoId: string) => {
    try {
      // Carica bando con tutti i dati necessari
      const { data: bandoData, error: bandoError } = await supabase
        .from('scadenze_bandi_bandi')
        .select('id, nome, data_base_calcolo, evento_base_id, contributo_massimo, percentuale_contributo')
        .eq('id', bandoId)
        .single()

      if (bandoError) {
        console.error('❌ Errore caricamento bando:', bandoError.message)
        throw bandoError
      }

      setBandoSelezionato(bandoData)

      // Se il bando ha una data_base_calcolo e il form non l'ha ancora, ereditala
      if (bandoData.data_base_calcolo && !formData.data_base_calcolo) {
        setFormData(prev => ({
          ...prev,
          data_base_calcolo: bandoData.data_base_calcolo.split('T')[0],
          evento_base_id: bandoData.evento_base_id || ''
        }))
      }

      // Carica template scadenze del bando
      const { data: templates, error: templatesError } = await supabase
        .from('scadenze_bandi_template_scadenze')
        .select('*')
        .eq('bando_id', bandoId)
        .order('ordine_sequenza')

      if (templatesError) {
        console.error('Errore caricamento template scadenze (non bloccante):', templatesError)
      }

      setTemplateScadenze(templates || [])

      // Carica eventi del bando e calcola le date
      await loadEventiDelBando(bandoId, bandoData, templates || [])
    } catch (error) {
      console.error('Errore caricamento bando e template:', error)
    }
  }

  // Carica eventi del bando e calcola le date dal template
  const loadEventiDelBando = async (bandoId: string, bandoData: any, templates: any[]) => {
    try {
      // Carica tutti gli eventi del catalogo
      const { data: catalogo, error: catalogoError } = await supabase
        .from('scadenze_bandi_eventi_catalogo')
        .select('*')

      if (catalogoError) {
        console.error('Errore caricamento catalogo eventi:', catalogoError)
        return
      }

      setEventiCatalogo(catalogo || [])

      // Estrai tutti gli eventi unici usati nei template del bando
      const eventiUsati = new Set<string>()
      const dateCalcolate: { [eventoId: string]: string } = {}

      // Aggiungi l'evento base del bando
      if (bandoData.evento_base_id) {
        eventiUsati.add(bandoData.evento_base_id)
        // La data dell'evento base è quella inserita nel bando
        if (bandoData.data_base_calcolo) {
          dateCalcolate[bandoData.evento_base_id] = bandoData.data_base_calcolo.split('T')[0]
        }
      }

      // Simula il calcolo delle scadenze per determinare le date degli eventi successivi
      if (templates && templates.length > 0 && bandoData.data_base_calcolo) {
        const scadenzeSimulate = new Map<string, Date>()
        const dataBase = new Date(bandoData.data_base_calcolo)

        for (let i = 0; i < templates.length; i++) {
          const template = templates[i]
          let dataRiferimento = null

          if (template.evento_riferimento?.startsWith('evento_base_')) {
            dataRiferimento = dataBase
          } else if (template.evento_riferimento?.startsWith('scadenza_')) {
            const scadenzaIndex = parseInt(template.evento_riferimento.replace('scadenza_', ''))
            if (scadenzeSimulate.has(`scadenza_${scadenzaIndex}`)) {
              dataRiferimento = scadenzeSimulate.get(`scadenza_${scadenzaIndex}`)
            } else {
              dataRiferimento = dataBase
            }
          } else {
            dataRiferimento = dataBase
          }

          if (dataRiferimento) {
            const dataScadenza = new Date(dataRiferimento)
            dataScadenza.setDate(dataScadenza.getDate() + (template.giorni_da_evento || 0))
            scadenzeSimulate.set(`scadenza_${i}`, dataScadenza)

            // Se questo template rappresenta un evento (non solo una scadenza),
            // aggiungi la sua data come possibile riferimento futuro
            if (template.tipo_scadenza && !template.tipo_scadenza.includes('generico')) {
              const eventoNome = `template_${i}_${template.tipo_scadenza}`
              dateCalcolate[eventoNome] = dataScadenza.toISOString().split('T')[0]
            }
          }
        }
      }

      // Trova gli eventi del catalogo corrispondenti
      const eventiDelBandoArray = (catalogo || []).filter(evento =>
        eventiUsati.has(evento.id)
      )

      setEventiDelBando(eventiDelBandoArray)
      setDateCalcolateBando(dateCalcolate)

      console.log('📅 Eventi del bando caricati:', eventiDelBandoArray)
      console.log('📊 Date calcolate:', dateCalcolate)

    } catch (error) {
      console.error('Errore caricamento eventi del bando:', error)
    }
  }

  // Ricalcola scadenze quando cambia una data effettiva
  const ricalcolaScadenzeConDateEffettive = () => {
    if (!templateScadenze.length || !scadenzeSalvate.length) return

    try {
      const nuoveScadenze = [...scadenzeSalvate]

      // Per ogni scadenza, verifica se deve essere ricalcolata
      nuoveScadenze.forEach((scadenza, index) => {
        const template = templateScadenze[index]
        if (!template) return

        // Se c'è una data effettiva per questa specifica scadenza, non ricalcolarla
        if (dateEffettiveScadenze[scadenza.id]) {
          return // Mantiene la sua data effettiva
        }

        // Altrimenti, calcola la data basandosi sulla catena delle scadenze
        let dataRiferimento = null

        // Trova la data di riferimento dall'evento base o dalla scadenza precedente
        if (index === 0) {
          // Prima scadenza: usa l'evento base
          if (formData.eventi_progetto && bandoSelezionato?.evento_base_id) {
            const dataEventoBase = formData.eventi_progetto[bandoSelezionato.evento_base_id]
            if (dataEventoBase) {
              dataRiferimento = new Date(dataEventoBase)
            }
          }

          // Fallback alla data del bando
          if (!dataRiferimento && bandoSelezionato?.data_base_calcolo) {
            dataRiferimento = new Date(bandoSelezionato.data_base_calcolo)
          }
        } else {
          // Scadenze successive: usa la scadenza precedente
          const scadenzaPrecedente = nuoveScadenze[index - 1]

          // Prima controlla se la scadenza precedente ha una data effettiva
          if (dateEffettiveScadenze[scadenzaPrecedente.id]) {
            dataRiferimento = new Date(dateEffettiveScadenze[scadenzaPrecedente.id])
          } else if (scadenzaPrecedente.data_scadenza && !isNaN(new Date(scadenzaPrecedente.data_scadenza).getTime())) {
            dataRiferimento = new Date(scadenzaPrecedente.data_scadenza)
          }
        }

        // Calcola la nuova data se abbiamo un riferimento
        if (dataRiferimento && template.giorni_da_evento !== undefined) {
          const nuovaData = new Date(dataRiferimento)
          nuovaData.setDate(nuovaData.getDate() + template.giorni_da_evento)
          scadenza.data_scadenza = nuovaData.toISOString()
        }
      })

      setScadenzeSalvate(nuoveScadenze)
    } catch (error) {
      console.error('❌ Errore nel ricalcolo scadenze con date effettive:', error)
    }
  }

  // Ricalcola le scadenze del progetto basandosi sulle date degli eventi specifici
  const ricalcolaScadenzeProgetto = () => {
    if (!templateScadenze.length || !formData.bando_id) return

    try {
      const nuoveScadenze = []
      const scadenzeGenerate = new Map<string, Date>()

      // Determina la data base da usare (progetto-specifica o da bando)
      const getDataEventoProgetto = (eventoId: string): Date | null => {
        // Prima controlla se c'è una data specifica per il progetto
        if (formData.eventi_progetto[eventoId]) {
          return new Date(formData.eventi_progetto[eventoId])
        }
        // Altrimenti usa la data calcolata dal bando
        if (dateCalcolateBando[eventoId]) {
          return new Date(dateCalcolateBando[eventoId])
        }
        return null
      }

      console.log('🔄 Ricalcolando scadenze del progetto...')
      console.log('📊 Eventi progetto:', formData.eventi_progetto)
      console.log('📊 Date bando:', dateCalcolateBando)

      for (let i = 0; i < templateScadenze.length; i++) {
        const template = templateScadenze[i]
        let dataRiferimento = null

        console.log(`   Template ${i + 1}: ${template.nome}`)
        console.log(`   Evento riferimento: ${template.evento_riferimento}`)

        // Determina la data di riferimento basandosi sui nuovi eventi dinamici
        if (template.evento_riferimento?.startsWith('evento_base_')) {
          const eventoId = template.evento_riferimento.replace('evento_base_', '')
          dataRiferimento = getDataEventoProgetto(eventoId)
          console.log(`   ✅ Usando evento base ${eventoId}:`, dataRiferimento?.toISOString().split('T')[0])
        } else if (template.evento_riferimento?.startsWith('scadenza_')) {
          const scadenzaIndex = parseInt(template.evento_riferimento.replace('scadenza_', ''))
          if (scadenzeGenerate.has(`scadenza_${scadenzaIndex}`)) {
            dataRiferimento = scadenzeGenerate.get(`scadenza_${scadenzaIndex}`)
            console.log(`   ✅ Usando scadenza precedente ${scadenzaIndex}:`, dataRiferimento?.toISOString().split('T')[0])
          } else {
            console.log(`   ⚠️ Scadenza precedente ${scadenzaIndex} non trovata`)
          }
        }

        // Fallback: usa la data base calcolo
        if (!dataRiferimento && formData.data_base_calcolo) {
          dataRiferimento = new Date(formData.data_base_calcolo)
          console.log(`   ⚠️ Fallback a data base calcolo:`, dataRiferimento.toISOString().split('T')[0])
        }

        if (dataRiferimento) {
          const dataScadenza = new Date(dataRiferimento)
          dataScadenza.setDate(dataScadenza.getDate() + (template.giorni_da_evento || 0))

          // Memorizza per i prossimi template
          scadenzeGenerate.set(`scadenza_${i}`, dataScadenza)

          nuoveScadenze.push({
            id: `scadenza_${i}_${Date.now()}`,
            titolo: template.nome,
            descrizione: template.descrizione,
            data_scadenza: dataScadenza.toISOString().split('T')[0],
            priorita: template.priorita,
            obbligatoria: template.obbligatoria,
            responsabile: template.responsabile_suggerito,
            note: template.note_template
          })

          console.log(`   📅 Data scadenza: ${dataScadenza.toISOString().split('T')[0]}`)
        } else {
          console.error(`   ❌ Impossibile calcolare scadenza per: ${template.nome}`)
        }
      }

      // Aggiorna le scadenze calcolate per la visualizzazione
      setScadenzeSalvate(nuoveScadenze)
      console.log('✅ Scadenze ricalcolate:', nuoveScadenze)

    } catch (error) {
      console.error('❌ Errore nel ricalcolo scadenze progetto:', error)
    }
  }


  const loadClienti = async () => {
    try {
      const { data, error } = await supabase
        .from('scadenze_bandi_clienti')
        .select('id, denominazione, partita_iva, codice_fiscale')
        .order('denominazione')

      if (error) throw error
      setClienti(data || [])
    } catch (error) {
      console.error('Errore caricamento clienti:', error)
    }
  }

  const loadScadenze = async (progettoId: string) => {
    try {
      const { data, error } = await supabase
        .from('scadenze_bandi_scadenze')
        .select('*')
        .eq('progetto_id', progettoId)
        .order('data_scadenza')

      if (error) throw error
      setScadenzeSalvate(data || [])
    } catch (error) {
      console.error('Errore caricamento scadenze:', error)
    }
  }

  const loadDocumenti = async (progettoId: string) => {
    try {
      const documentiCaricati: any[] = []

      if (progettoId) {
        // Carica documenti dal database per progetto esistente
        const { data: dbDocumenti, error: docError } = await supabase
          .from('scadenze_bandi_documenti_progetto')
          .select('*')
          .eq('progetto_id', progettoId)
          .order('created_at', { ascending: false })

        if (docError) {
          console.error('Errore caricamento documenti database:', docError)
        } else {
          documentiCaricati.push(...(dbDocumenti || []))
        }
      } else if (formData.bando_id) {
        // Per nuovi progetti: eredita e copia fisicamente gli "Allegati da Compilare" dal bando
        console.log('🔄 Caricamento e copia allegati da bando per nuovo progetto...')

        // Prima verifichiamo tutti i documenti del bando per debug
        console.log('🔍 Debug: Verificando TUTTI i documenti del bando...')
        const { data: tuttiDocumentiBando, error: debugError } = await supabase
          .from('scadenze_bandi_documenti')
          .select('id, nome_file, categoria, tipo_documento, bando_id')
          .eq('bando_id', formData.bando_id)

        if (debugError) {
          console.error('❌ Errore debug documenti bando:', debugError)
        } else {
          console.log('📋 TUTTI i documenti del bando:', tuttiDocumentiBando)
          console.log(`📊 Categorie presenti:`, tuttiDocumentiBando?.map(d => d.categoria))
        }

        const { data: bandoAllegati, error: allegatiError } = await supabase
          .from('scadenze_bandi_documenti')
          .select('*')
          .eq('bando_id', formData.bando_id)
          .eq('categoria', 'allegati') // Solo allegati, non normativa
          .order('created_at', { ascending: false })

        if (allegatiError) {
          console.error('Errore caricamento allegati dal bando:', allegatiError)
        } else {
          console.log(`✅ Trovati ${bandoAllegati?.length || 0} allegati da ereditare dal bando`)
          if (bandoAllegati?.length > 0) {
            console.log('📎 Allegati da copiare:', bandoAllegati.map(a => `${a.nome_file} (${a.categoria})`))
          }
        }

        const progettoId = 'temp_' + Date.now()

        // Il bucket progetti-documenti dovrebbe già esistere (gestito in Supabase)
        console.log('🔍 Verificando bucket progetti-documenti...')
        const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()

        if (bucketsError) {
          console.warn('⚠️ Non posso verificare buckets (permessi limitati), procedo comunque')
        } else {
          const progettiDocumentiBucket = buckets.find(b => b.name === 'progetti-documenti')
          if (progettiDocumentiBucket) {
            console.log('✅ Bucket progetti-documenti trovato')
          } else {
            console.warn('⚠️ Bucket progetti-documenti non trovato nella lista, ma procedo comunque')
          }
        }

        // Copia fisicamente ogni allegato dal bando al progetto
        for (const allegato of bandoAllegati || []) {
            try {
              console.log(`📁 Copiando allegato: ${allegato.nome_file}`)

              // 1. Scarica il file dal bucket bandi
              const { data: fileData, error: downloadError } = await supabase.storage
                .from('bandi-documenti')
                .download(allegato.url_file)

              if (downloadError) {
                console.error(`❌ Errore download allegato ${allegato.nome_file}:`, downloadError)
                continue
              }

              // 2. Genera nuovo nome file per il progetto
              const nuovoNomeFile = `template_${Date.now()}_${allegato.nome_file}`
              const nuovoPercorso = `${progettoId}/${nuovoNomeFile}`

              // 3. Carica il file nel bucket progetti
              console.log(`⬆️ Tentativo upload: ${nuovoPercorso} (${fileData.size} bytes)`)
              const { data: uploadData, error: uploadError } = await supabase.storage
                .from('progetti-documenti')
                .upload(nuovoPercorso, fileData)

              if (uploadError) {
                console.error(`❌ Errore upload allegato ${allegato.nome_file}:`, uploadError)
                console.error(`❌ Dettagli upload error:`, JSON.stringify(uploadError, null, 2))
                continue
              }

              console.log(`✅ Upload completato:`, uploadData)

              // 4. Crea record del documento copiato
              const documentoCopia = {
                ...allegato,
                id: `template_${allegato.id}_${Date.now()}`, // Nuovo ID
                progetto_id: null, // Sarà impostato quando si salva il progetto
                url_file: nuovoPercorso, // Nuovo percorso nel bucket progetti
                inherited_from_bando: true,
                status: 'to_compile',
                nome_file: allegato.nome_file, // Mantiene il nome originale per l'utente
                descrizione: `Template da compilare: ${allegato.descrizione || allegato.nome_file}`
              }

              documentiCaricati.push(documentoCopia)
              console.log(`✅ Allegato copiato: ${allegato.nome_file} -> ${nuovoPercorso}`)

            } catch (error) {
              console.error(`❌ Errore generico copia allegato ${allegato.nome_file}:`, error)
            }
          }
        }

      setDocumenti(documentiCaricati);
    } catch (error) {
      console.error('Errore generale caricamento documenti:', error);
    }
  }

  const generateCodiceProgetto = async () => {
    const anno = new Date().getFullYear()
    let tentativo = 0
    let codiceGenerato = ''

    do {
      tentativo++
      const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
      codiceGenerato = `PROG-${anno}-${randomNum}`

      // Verifica se il codice esiste già nel database
      const { data: existing } = await supabase
        .from('scadenze_bandi_progetti')
        .select('id')
        .eq('codice_progetto', codiceGenerato)
        .single()

      // Se non esiste (errore nel .single()), il codice è disponibile
      if (!existing) {
        break
      }

      console.log(`⚠️ Codice ${codiceGenerato} già esistente, nuovo tentativo...`)
    } while (tentativo < 10) // Massimo 10 tentativi

    if (tentativo >= 10) {
      // Fallback con timestamp se dopo 10 tentativi non trova un codice unico
      const timestamp = Date.now().toString().slice(-4)
      codiceGenerato = `PROG-${anno}-${timestamp}`
      console.log(`🔄 Usando fallback con timestamp: ${codiceGenerato}`)
    }

    setFormData(prev => ({ ...prev, codice_progetto: codiceGenerato }))
    console.log(`✅ Codice progetto generato: ${codiceGenerato}`)
  }

  const generateScadenzeFromTemplate = async (progettoId: string, bandoId: string, formData: ProgettoFormData) => {
    try {
      // Carica i template di scadenze del bando
      const { data: templates, error: templatesError } = await supabase
        .from('scadenze_bandi_template_scadenze')
        .select('*')
        .eq('bando_id', bandoId)
        .order('ordine_sequenza')

      if (templatesError) {
        console.error('❌ Errore caricamento template scadenze:', templatesError)
        throw templatesError
      }

      if (!templates || templates.length === 0) {
        console.log('📋 Nessun template di scadenze trovato per il bando')
        return
      }

      // Carica dati completi del bando
      const { data: bandoData, error: bandoDataError } = await supabase
        .from('scadenze_bandi_bandi')
        .select('data_base_calcolo, evento_base_id')
        .eq('id', bandoId)
        .single()

      if (bandoDataError) {
        console.error('❌ Errore caricamento dati bando:', bandoDataError)
        return
      }

      // Carica il catalogo eventi
      const { data: eventiCatalogo, error: eventiError } = await supabase
        .from('scadenze_bandi_eventi_catalogo')
        .select('*')

      if (eventiError) {
        console.error('❌ Errore caricamento eventi catalogo:', eventiError)
        return
      }

      const scadenzeToInsert = []
      const scadenzeGenerate = new Map<string, Date>() // Mappa per tenere traccia delle scadenze generate

      // Usa sempre la data_base_calcolo come data di riferimento iniziale
      const dataBaseCalcolo = formData.data_base_calcolo || bandoData?.data_base_calcolo

      if (!dataBaseCalcolo) {
        console.error('❌ Data base calcolo non disponibile')
        return
      }

      console.log('📅 Data base calcolo:', dataBaseCalcolo)
      console.log('📋 Template scadenze trovati:', templates.length)

      for (let i = 0; i < templates.length; i++) {
        const template = templates[i]
        let dataRiferimento = null

        console.log(`🔄 Elaborando template ${i + 1}: ${template.nome}`)
        console.log(`   Evento riferimento: ${template.evento_riferimento}`)

        // Logica per determinare la data di riferimento basata sui nuovi eventi dinamici
        if (template.evento_riferimento?.startsWith('evento_base_')) {
          const eventoId = template.evento_riferimento.replace('evento_base_', '')

          // Prima controlla se c'è una data specifica per il progetto
          if (formData.eventi_progetto && formData.eventi_progetto[eventoId]) {
            dataRiferimento = formData.eventi_progetto[eventoId]
            console.log(`   ✅ Usando data progetto per evento ${eventoId}: ${dataRiferimento}`)
          } else {
            // Altrimenti usa la data base calcolo del bando
            dataRiferimento = dataBaseCalcolo
            console.log(`   ✅ Usando data bando per evento base: ${dataRiferimento}`)
          }
        } else if (template.evento_riferimento?.startsWith('scadenza_')) {
          // È un riferimento a una scadenza precedente
          const scadenzaIndex = parseInt(template.evento_riferimento.replace('scadenza_', ''))
          const scadenzaPrecedente = templates[scadenzaIndex]

          if (scadenzaPrecedente && scadenzeGenerate.has(`scadenza_${scadenzaIndex}`)) {
            dataRiferimento = scadenzeGenerate.get(`scadenza_${scadenzaIndex}`)?.toISOString().split('T')[0]
            console.log(`   ✅ Usando scadenza precedente ${scadenzaIndex}: ${dataRiferimento}`)
          } else {
            console.log(`   ⚠️ Scadenza precedente ${scadenzaIndex} non trovata, uso evento base`)
            // Fallback all'evento base (con priorità al progetto)
            if (formData.eventi_progetto && bandoData.evento_base_id && formData.eventi_progetto[bandoData.evento_base_id]) {
              dataRiferimento = formData.eventi_progetto[bandoData.evento_base_id]
            } else {
              dataRiferimento = dataBaseCalcolo
            }
          }
        } else {
          // Fallback: usa sempre la data base calcolo (con priorità al progetto)
          if (formData.eventi_progetto && bandoData.evento_base_id && formData.eventi_progetto[bandoData.evento_base_id]) {
            dataRiferimento = formData.eventi_progetto[bandoData.evento_base_id]
            console.log(`   ⚠️ Evento non riconosciuto, uso data progetto: ${dataRiferimento}`)
          } else {
            dataRiferimento = dataBaseCalcolo
            console.log(`   ⚠️ Evento non riconosciuto, uso data base bando: ${dataRiferimento}`)
          }
        }

        if (dataRiferimento) {
          const dataRif = new Date(dataRiferimento)
          const dataScadenza = new Date(dataRif)
          dataScadenza.setDate(dataScadenza.getDate() + (template.giorni_da_evento || 0))

          // Memorizza la scadenza generata per i prossimi template
          scadenzeGenerate.set(`scadenza_${i}`, dataScadenza)

          console.log(`   📅 Data scadenza calcolata: ${dataScadenza.toISOString().split('T')[0]}`)

          scadenzeToInsert.push({
            progetto_id: progettoId,
            bando_id: bandoId,
            cliente_id: formData.cliente_id,
            titolo: template.nome,
            data_scadenza: dataScadenza.toISOString(),
            stato: 'non_iniziata',
            priorita: template.priorita || 'media',
            responsabile_email: template.responsabile_suggerito || 'amministrazione@blmproject.it',
            note: `${template.descrizione || ''} - Generata automaticamente da template`,
            giorni_preavviso: [30, 15, 7, 1],
            obbligatoria: template.obbligatoria || false,
            tipo_scadenza: template.tipo_scadenza || 'generico'
          })
        } else {
          console.error(`   ❌ Impossibile determinare data di riferimento per template: ${template.nome}`)
        }
      }

      // Inserisci le scadenze generate
      if (scadenzeToInsert.length > 0) {
        console.log(`💾 Inserendo ${scadenzeToInsert.length} scadenze generate`)

        const { error: insertError } = await supabase
          .from('scadenze_bandi_scadenze')
          .insert(scadenzeToInsert)

        if (insertError) {
          console.error('❌ Errore inserimento scadenze generate:', insertError)
          throw insertError
        }

        console.log('✅ Scadenze generate con successo!')
      } else {
        console.log('⚠️ Nessuna scadenza da inserire')
      }

    } catch (error) {
      console.error('❌ Errore nella generazione scadenze da template:', error)
      throw error
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    setUploading(true)

    try {
      const progettoId = progetto?.id || 'temp_' + Date.now()

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const fileName = `${Date.now()}_${file.name}`

        setUploadProgress(prev => ({ ...prev, [fileName]: 0 }))

        // Upload su Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('progetti-documenti')
          .upload(`${progettoId}/${fileName}`, file)

        if (uploadError) throw uploadError

        // Se è un progetto esistente, salva nel database
        if (progetto?.id) {
          const { error: dbError } = await supabase
            .from('scadenze_bandi_documenti_progetto')
            .insert([{
              progetto_id: progetto.id,
              nome_file: file.name,
              categoria: 'allegato_caricato',
              formato_file: file.type,
              dimensione_bytes: file.size,
              url_file: `${progettoId}/${fileName}`,
              descrizione: `Documento caricato manualmente: ${file.name}`,
              caricato_da: 'UTENTE'
            }])

          if (dbError) throw dbError
        }

        setUploadProgress(prev => ({ ...prev, [fileName]: 100 }))
      }

      // Ricarica documenti
      if (progetto?.id) {
        loadDocumenti(progetto.id)
      }
    } catch (error) {
      console.error('Errore upload:', error)
      alert('Errore durante l\'upload dei file')
    } finally {
      setUploading(false)
      setUploadProgress({})
    }
  }

  const handleDeleteDocument = async (docId: string) => {
    try {
      const { error } = await supabase
        .from('scadenze_bandi_documenti_progetto')
        .delete()
        .eq('id', docId)

      if (error) throw error

      setDocumenti(prev => prev.filter(doc => doc.id !== docId))
    } catch (error) {
      console.error('Errore eliminazione documento:', error)
      alert('Errore durante l\'eliminazione del documento')
    }
  }

  // Salva i documenti ereditati nel database quando viene creato un progetto
  const saveDocumentiEreditati = async (progettoId: string) => {
    try {
      const documentiDaSalvare = documenti
        .filter(doc => doc.inherited_from_bando && doc.progetto_id === null)
        .map(doc => ({
          progetto_id: progettoId,
          nome_file: doc.nome_file,
          categoria: doc.categoria,
          formato_file: doc.formato_file,
          dimensione_bytes: doc.dimensione_bytes,
          url_file: doc.url_file, // Ora punta al bucket progetti-documenti
          descrizione: doc.descrizione,
          tipo_documento: doc.tipo_documento || 'template',
          caricato_da: 'SISTEMA_EREDITA'
        }))

      if (documentiDaSalvare.length > 0) {
        console.log(`💾 Salvando ${documentiDaSalvare.length} documenti ereditati nel database...`)

        const { error } = await supabase
          .from('scadenze_bandi_documenti_progetto')
          .insert(documentiDaSalvare)

        if (error) throw error

        console.log(`✅ Documenti ereditati salvati nel database per progetto ${progettoId}`)
      }
    } catch (error) {
      console.error('❌ Errore salvataggio documenti ereditati:', error)
      throw error
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Prepara i dati per il salvataggio, convertendo stringhe vuote a null per le date
      const dataToSave = { ...formData }

      // Rimuovi il campo eventi_progetto che non esiste nel database
      delete (dataToSave as any).eventi_progetto

      // Campi data che devono essere null se vuoti
      const dateFields = [
        'data_base_calcolo',
        'evento_base_id'
      ]

      dateFields.forEach(field => {
        if (dataToSave[field as keyof ProgettoFormData] === '') {
          (dataToSave as any)[field] = null
        }
      })

      if (progetto) {
        // Modifica progetto esistente
        const { error } = await supabase
          .from('scadenze_bandi_progetti')
          .update(dataToSave)
          .eq('id', progetto.id)

        if (error) throw error
      } else {
        // Crea nuovo progetto
        const { data: newProgetto, error } = await supabase
          .from('scadenze_bandi_progetti')
          .insert([dataToSave])
          .select()
          .single()

        if (error) throw error

        // Salva i documenti ereditati nel database del progetto
        await saveDocumentiEreditati(newProgetto.id)

        // Genera scadenze automatiche dal template del bando (solo per nuovi progetti)
        if (!progetto?.id) {
          await generateScadenzeFromTemplate(newProgetto.id, formData.bando_id, formData)
        }

        // Crea struttura Google Drive se connesso
        if (session?.accessToken) {
          try {
            console.log('📁 Creazione struttura Google Drive...')

            // 1. Prima crea/verifica la struttura del bando
            const bandoData = bando || bandi.find(b => b.id === formData.bando_id)
            if (bandoData) {
              const bandoResponse = await fetch('/api/drive/create-bando', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  bandoName: bandoData.nome
                })
              })

              if (!bandoResponse.ok) {
                console.warn('⚠️ Errore creazione struttura bando Google Drive (non bloccante)')
              } else {
                console.log('✅ Struttura bando Google Drive verificata')
              }
            }

            // 2. Poi crea la struttura del progetto
            const progettoResponse = await fetch('/api/drive/create-progetto', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                bandoName: bandoData?.nome || 'Bando Sconosciuto',
                progettoName: formData.titolo_progetto
              })
            })

            if (!progettoResponse.ok) {
              console.warn('⚠️ Errore creazione struttura progetto Google Drive (non bloccante)')
            } else {
              const progettoData = await progettoResponse.json()
              console.log('✅ Struttura progetto Google Drive creata:', progettoData)

              // Copia allegati da bando a progetto
              try {
                const copyResponse = await fetch('/api/drive/copy-bando-files', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    bandoName: bandoData?.nome || 'Bando Sconosciuto',
                    progettoName: formData.titolo_progetto
                  })
                })

                if (copyResponse.ok) {
                  const copyResult = await copyResponse.json()
                  console.log('📋 Allegati copiati da bando a progetto:', copyResult)
                } else {
                  console.warn('⚠️ Errore copia allegati (non bloccante):', await copyResponse.text())
                }
              } catch (copyError) {
                console.warn('⚠️ Errore copia allegati (non bloccante):', copyError)
              }
            }

          } catch (driveError) {
            console.warn('⚠️ Errore Google Drive (non bloccante):', driveError)
            // Non blocchiamo la creazione del progetto per errori Google Drive
          }
        } else {
          console.log('ℹ️ Google Drive non connesso, struttura non creata')
        }
      }

      onProgettoCreated()
      onClose()
    } catch (error: any) {
      console.error('Errore salvataggio progetto:', error)
      alert(`Errore: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    { id: 'generale', label: 'Informazioni Generali', icon: Building2 },
    { id: 'importi', label: 'Importi e Contributi', icon: Euro },
    { id: 'scadenze', label: 'Scadenze e Date', icon: Calendar },
    { id: 'documenti', label: 'Documenti', icon: FileText },
    { id: 'avanzate', label: 'Impostazioni Avanzate', icon: User }
  ]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full h-[95vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">
                {progetto ? 'Modifica Progetto' : 'Nuovo Progetto'}
              </h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Tabs */}
            <div className="mt-6 flex space-x-1 overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as TabType)}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6">
              {activeTab === 'generale' && (
                <div className="space-y-6">
                  {/* Selezione Bando e Cliente */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Bando *
                      </label>
                      <select
                        value={formData.bando_id}
                        onChange={(e) => setFormData({ ...formData, bando_id: e.target.value })}
                        required
                        disabled={!!bando}
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                      >
                        <option value="">Seleziona un bando</option>
                        {bandi.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.nome} - {b.codice_bando}
                          </option>
                        ))}
                      </select>
                      {bando && (
                        <p className="mt-1 text-sm text-gray-600">
                          Bando pre-selezionato: {bando.nome}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Cliente *
                      </label>
                      <select
                        value={formData.cliente_id}
                        onChange={(e) => setFormData({ ...formData, cliente_id: e.target.value })}
                        required
                        disabled={!!cliente}
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                      >
                        <option value="">Seleziona un cliente</option>
                        {clienti.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.denominazione} - {c.partita_iva}
                          </option>
                        ))}
                      </select>
                      {cliente && (
                        <p className="mt-1 text-sm text-gray-600">
                          Cliente pre-selezionato: {cliente.denominazione}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Codice e Titolo Progetto */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Codice Progetto *
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={formData.codice_progetto}
                          onChange={(e) => setFormData({ ...formData, codice_progetto: e.target.value })}
                          required
                          className="flex-1 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <button
                          type="button"
                          onClick={generateCodiceProgetto}
                          className="px-3 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                        >
                          Genera
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Titolo Progetto *
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={formData.titolo_progetto}
                          onChange={(e) => setFormData({ ...formData, titolo_progetto: e.target.value })}
                          required
                          className="flex-1 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <button
                          type="button"
                          onClick={updateTitoloProgetto}
                          className="px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                        >
                          Auto
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Descrizione */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Descrizione Progetto
                    </label>
                    <textarea
                      value={formData.descrizione_progetto}
                      onChange={(e) => setFormData({ ...formData, descrizione_progetto: e.target.value })}
                      rows={4}
                      className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {/* Stato */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Stato Progetto *
                    </label>
                    <select
                      value={formData.stato}
                      onChange={(e) => setFormData({ ...formData, stato: e.target.value as any })}
                      className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="DECRETO_ATTESO">Decreto Atteso</option>
                      <option value="DECRETO_RICEVUTO">Decreto Ricevuto</option>
                      <option value="ACCETTATO">Accettato</option>
                      <option value="IN_CORSO">In Corso</option>
                      <option value="COMPLETATO">Completato</option>
                    </select>
                  </div>
                </div>
              )}

              {activeTab === 'importi' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Importo Totale Progetto (€) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.importo_totale_progetto}
                        onChange={(e) => setFormData({ ...formData, importo_totale_progetto: parseFloat(e.target.value) || 0 })}
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Contributo Ammesso (€) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.contributo_ammesso}
                        onChange={(e) => setFormData({ ...formData, contributo_ammesso: parseFloat(e.target.value) || 0 })}
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Percentuale Contributo (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={formData.percentuale_contributo}
                        onChange={(e) => setFormData({ ...formData, percentuale_contributo: parseFloat(e.target.value) || 0 })}
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Numero SAL
                      </label>
                      <select
                        value={formData.numero_sal}
                        onChange={(e) => setFormData({ ...formData, numero_sal: e.target.value as any })}
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="UNICO">Unico SAL</option>
                        <option value="DUE">Due SAL</option>
                        <option value="TRE">Tre SAL</option>
                      </select>
                    </div>
                  </div>

                  {/* Anticipo */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={formData.anticipo_richiedibile}
                        onChange={(e) => setFormData({ ...formData, anticipo_richiedibile: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="font-medium text-gray-900">Anticipo Richiedibile</span>
                    </label>

                    {formData.anticipo_richiedibile && (
                      <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Percentuale Anticipo (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={formData.percentuale_anticipo}
                          onChange={(e) => setFormData({ ...formData, percentuale_anticipo: parseInt(e.target.value) || 0 })}
                          className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'scadenze' && (
                <div className="space-y-6">
                  {/* Date Principali */}

                  {/* Sezione Eventi Dinamici del Bando */}
                  {eventiDelBando.length > 0 && (
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-blue-600" />
                        Eventi del Bando
                      </h3>
                      <p className="text-sm text-gray-600 mb-4">
                        Per ogni evento del bando, puoi specificare la data di avvenimento effettiva per questo progetto.
                        Le scadenze concatenate verranno ricalcolate automaticamente in base a queste date reali,
                        permettendo di identificare eventuali ritardi rispetto alle tempistiche previste.
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {eventiDelBando.map((evento) => (
                          <div key={evento.id} className="space-y-3">
                            <div className="bg-white p-3 rounded border">
                              <h4 className="font-medium text-gray-900 mb-2">{evento.nome}</h4>
                              {evento.descrizione && (
                                <p className="text-xs text-gray-500 mb-3">{evento.descrizione}</p>
                              )}

                              {/* Data calcolata dal bando (read-only) */}
                              <div className="mb-3">
                                <label className="block text-xs font-medium text-gray-600 mb-1">
                                  Data dal Bando (calcolata)
                                </label>
                                <input
                                  type="date"
                                  value={dateCalcolateBando[evento.id] || ''}
                                  readOnly
                                  className="w-full p-2 text-sm border border-gray-200 rounded bg-gray-50 text-gray-600"
                                />
                              </div>

                              {/* Data specifica del progetto (editabile) - solo se non è l'evento base fisso */}
                              {evento.nome !== 'Avvio Progetto' && evento.tipo !== 'base_progetto' && (
                                <div>
                                  <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Data Effettiva
                                    <span className="text-blue-600 ml-1">*</span>
                                  </label>
                                  <input
                                    type="date"
                                    value={formData.eventi_progetto[evento.id] || ''}
                                    onChange={(e) => {
                                      const nuoviEventi = {
                                        ...formData.eventi_progetto,
                                        [evento.id]: e.target.value
                                      }
                                      setFormData(prev => ({
                                        ...prev,
                                        eventi_progetto: nuoviEventi
                                      }))
                                    }}
                                    className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                  />
                                  <p className="text-xs text-gray-500 mt-1">
                                    Se lasciato vuoto, verrà usata la data dal bando
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {eventiDelBando.length === 0 && (
                        <div className="text-center py-4 text-gray-500">
                          <Calendar className="mx-auto h-8 w-8 text-gray-400" />
                          <p className="mt-2 text-sm">Nessun evento configurato per questo bando</p>
                        </div>
                      )}
                    </div>
                  )}



                  {/* Scadenze Esistenti */}
                  {scadenzeSalvate.length > 0 && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-2">Scadenze calcolate dal template</h4>
                      <div className="space-y-4">
                        {scadenzeSalvate.map((scadenza) => (
                          <div key={scadenza.id} className="bg-white border border-gray-200 rounded-lg p-4">
                            {/* Header della scadenza */}
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <h5 className="font-medium text-gray-900">{scadenza.titolo}</h5>
                                {scadenza.note && (
                                  <p className="text-xs text-gray-600 mt-1">{scadenza.note}</p>
                                )}
                              </div>
                              <span className="text-sm text-gray-500">
                                {scadenza.data_scadenza && !isNaN(new Date(scadenza.data_scadenza).getTime())
                                  ? new Date(scadenza.data_scadenza).toLocaleDateString('it-IT')
                                  : 'Data non valida'
                                }
                              </span>
                            </div>

                            {/* Campo Data Effettiva */}
                            <div className="border-t border-gray-100 pt-3">
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Data Effettiva *
                              </label>
                              <div className="flex gap-2 items-center">
                                <input
                                  type="date"
                                  value={dateEffettiveScadenze[scadenza.id] || ''}
                                  onChange={(e) => {
                                    setDateEffettiveScadenze(prev => ({
                                      ...prev,
                                      [scadenza.id]: e.target.value
                                    }))
                                  }}
                                  className={`flex-1 p-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                                    dateEffettiveScadenze[scadenza.id] &&
                                    scadenza.data_scadenza &&
                                    !isNaN(new Date(scadenza.data_scadenza).getTime()) &&
                                    new Date(dateEffettiveScadenze[scadenza.id]) > new Date(scadenza.data_scadenza)
                                      ? 'bg-red-50 border-red-300 text-red-900 focus:ring-red-500 focus:border-red-500'
                                      : 'border-gray-300'
                                  }`}
                                  placeholder="Inserisci la data di avvenimento effettiva"
                                />
                                {dateEffettiveScadenze[scadenza.id] &&
                                  scadenza.data_scadenza &&
                                  !isNaN(new Date(scadenza.data_scadenza).getTime()) &&
                                  new Date(dateEffettiveScadenze[scadenza.id]) > new Date(scadenza.data_scadenza) && (
                                  <div className="text-red-500" title="Scadenza sforata">
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                  </div>
                                )}
                                {dateEffettiveScadenze[scadenza.id] && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDateEffettiveScadenze(prev => {
                                        const updated = { ...prev }
                                        delete updated[scadenza.id]
                                        return updated
                                      })
                                    }}
                                    className="text-gray-400 hover:text-red-500"
                                    title="Rimuovi data effettiva"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 mt-1">
                                Se lasciato vuoto, verrà usata la data calcolata dal bando.
                                Inserendo una data effettiva, le scadenze successive verranno ricalcolate automaticamente.
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'documenti' && (
                <div className="space-y-6">
                  {/* Google Drive Status */}
                  {(
                    <div className={`border rounded-lg p-4 ${
                      session?.accessToken
                        ? 'bg-green-50 border-green-200'
                        : 'bg-yellow-50 border-yellow-200'
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full ${
                          session?.accessToken ? 'bg-green-500' : 'bg-yellow-500'
                        }`}></div>
                        <div>
                          <h4 className="text-sm font-medium">
                            {session?.accessToken
                              ? `✅ Google Drive connesso come ${session.user?.email}`
                              : '⚠️ Google Drive non connesso'}
                          </h4>
                          <p className="text-xs text-gray-600 mt-1">
                            {session?.accessToken
                              ? 'La struttura cartelle verrà creata automaticamente nei Drive Condivisi.'
                              : 'Connetti Google Drive per creare automaticamente la struttura cartelle.'}
                          </p>
                        </div>
                      </div>
                      {!session?.accessToken && (
                        <button
                          type="button"
                          onClick={() => signIn('google')}
                          className="mt-3 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm"
                        >
                          🔑 Connetti Google Drive
                        </button>
                      )}
                    </div>
                  )}

                  {/* Info Section per allegati ereditati */}
                  {!progetto && documenti.some(doc => doc.inherited_from_bando) && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <div>
                          <h4 className="text-sm font-medium text-blue-900 mb-1">
                            Allegati da Compilare Ereditati dal Bando
                          </h4>
                          <p className="text-sm text-blue-700">
                            Questo progetto ha ereditato automaticamente gli allegati da compilare dal bando selezionato.
                            Questi template dovranno essere scaricati, compilati e ricaricati come documenti del progetto.
                            I documenti di normativa del bando non vengono ereditati.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Preview Documenti - Solo per progetti esistenti */}
                  {progetto?.id && (
                    <DocumentiProgettoPreview
                      progettoId={progetto.id}
                      className="mb-6"
                    />
                  )}

                  {/* Upload Section */}
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                    <div className="text-center">
                      <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Carica Documenti</h3>
                      <p className="text-gray-600 mb-4">
                        Seleziona i file da caricare per questo progetto
                      </p>
                      <input
                        type="file"
                        multiple
                        onChange={handleFileUpload}
                        disabled={uploading}
                        className="hidden"
                        id="file-upload"
                      />
                      <label
                        htmlFor="file-upload"
                        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg cursor-pointer inline-block disabled:opacity-50"
                      >
                        {uploading ? 'Caricamento...' : 'Seleziona File'}
                      </label>
                    </div>

                    {/* Progress */}
                    {Object.keys(uploadProgress).length > 0 && (
                      <div className="mt-4 space-y-2">
                        {Object.entries(uploadProgress).map(([fileName, progress]) => (
                          <div key={fileName} className="bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full transition-all"
                              style={{ width: `${progress}%` }}
                            />
                            <p className="text-xs text-gray-600 mt-1">{fileName}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>


                  {/* Documenti Esistenti */}
                  {documenti.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-medium text-gray-900">Documenti Caricati</h4>
                      </div>
                      <div className="space-y-2">
                        {documenti.map((doc) => (
                          <div key={doc.id} className={`flex items-center justify-between p-3 border rounded-lg ${
                            doc.inherited_from_bando ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
                          }`}>
                            <div className="flex items-center gap-3">
                              <FileText className={`w-5 h-5 ${doc.inherited_from_bando ? 'text-blue-500' : 'text-gray-400'}`} />
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-gray-900">{doc.nome_file}</p>
                                  {doc.inherited_from_bando && (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                      Da Compilare
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-600">
                                  {doc.categoria} • {doc.formato_file}
                                  {doc.dimensione_bytes && ` • ${(doc.dimensione_bytes / 1024).toFixed(1)} KB`}
                                  {doc.inherited_from_bando && ' • Template dal bando'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {/* Bottone per visualizzare (occhio) */}
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    console.log(`👁️ Visualizzazione documento: ${doc.nome_file}`)

                                    // Se il documento ha un google_drive_id, usa il modal per la preview
                                    if (doc.google_drive_id) {
                                      console.log('📄 Aprendo documento nel modal...')
                                      setPreviewModal({
                                        isOpen: true,
                                        documento: {
                                          nome_file: doc.nome_file,
                                          google_drive_id: doc.google_drive_id
                                        }
                                      })
                                      return
                                    }

                                    // Fallback per documenti in Supabase Storage
                                    const fileType = doc.nome_file.split('.').pop()?.toLowerCase() || ''
                                    console.log('📄 Tentativo visualizzazione da Supabase Storage...')

                                    // Per DOCX/DOC, crea URL pubblico temporaneo per i viewer
                                    if (fileType === 'docx' || fileType === 'doc') {
                                      console.log('📄 Creando URL pubblico temporaneo per viewer...')

                                      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
                                        .from('progetti-documenti')
                                        .createSignedUrl(doc.url_file, 3600) // 1 ora

                                      if (signedUrlError) {
                                        console.error('❌ Errore URL firmato:', signedUrlError)
                                        // Se fallisce Supabase, prova Google Drive come fallback
                                        if (doc.google_drive_url) {
                                          console.log('📄 Fallback: aprendo da Google Drive...')
                                          window.open(doc.google_drive_url, '_blank')
                                          return
                                        }
                                        throw signedUrlError
                                      }

                                      console.log('✅ URL pubblico temporaneo creato:', signedUrlData.signedUrl)

                                      setDocumentModal({
                                        open: true,
                                        title: doc.nome_file,
                                        url: signedUrlData.signedUrl,
                                        type: fileType
                                      })

                                    } else {
                                      // Per altri file, usa blob come prima
                                      const { data, error } = await supabase.storage
                                        .from('progetti-documenti')
                                        .download(doc.url_file)

                                      if (error) {
                                        console.error('❌ Errore storage download:', error)
                                        // Se fallisce Supabase, prova Google Drive come fallback
                                        if (doc.google_drive_url) {
                                          console.log('📄 Fallback: aprendo da Google Drive...')
                                          window.open(doc.google_drive_url, '_blank')
                                          return
                                        }
                                        throw error
                                      }

                                      const url = URL.createObjectURL(data)

                                      setDocumentModal({
                                        open: true,
                                        title: doc.nome_file,
                                        url: url,
                                        type: fileType
                                      })
                                    }

                                  } catch (error) {
                                    console.error('❌ Errore visualizzazione documento:', error)
                                    alert(`Errore nella visualizzazione: ${error.message || 'Errore sconosciuto'}. Il documento potrebbe essere disponibile solo su Google Drive.`)
                                  }
                                }}
                                className="text-blue-600 hover:text-blue-800"
                                title="Visualizza documento"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              {/* Bottone per scaricare (download) */}
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    console.log(`💾 Download documento: ${doc.nome_file}`)

                                    const { data, error } = await supabase.storage
                                      .from('progetti-documenti')
                                      .download(doc.url_file)

                                    if (error) {
                                      console.error('❌ Errore storage download:', error)
                                      throw error
                                    }

                                    // Download automatico
                                    const url = URL.createObjectURL(data)
                                    const a = document.createElement('a')
                                    a.href = url
                                    a.download = doc.nome_file
                                    document.body.appendChild(a)
                                    a.click()
                                    document.body.removeChild(a)
                                    URL.revokeObjectURL(url)

                                    console.log(`✅ Download completato: ${doc.nome_file}`)

                                  } catch (error) {
                                    console.error('❌ Errore download documento:', error)
                                    alert(`Errore nel download: ${error.message || 'Errore sconosciuto'}`)
                                  }
                                }}
                                className="text-green-600 hover:text-green-800"
                                title="Scarica documento"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              {!doc.inherited_from_bando && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteDocument(doc.id)}
                                  className="text-red-600 hover:text-red-800"
                                  title="Elimina documento"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                              {doc.inherited_from_bando && (
                                <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                                  Template
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Info */}
                  {documenti.length === 0 && (
                    <div className="text-center py-8">
                      <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">Nessun documento</h3>
                      <p className="text-gray-600">
                        I documenti caricati appariranno qui
                      </p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'avanzate' && (
                <div className="space-y-6">
                  {/* Referente Interno */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Referente Interno
                      </label>
                      <input
                        type="text"
                        value={formData.referente_interno}
                        onChange={(e) => setFormData({ ...formData, referente_interno: e.target.value })}
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email Referente Interno
                      </label>
                      <input
                        type="email"
                        value={formData.email_referente_interno}
                        onChange={(e) => setFormData({ ...formData, email_referente_interno: e.target.value })}
                        className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Opzioni */}
                  <div className="space-y-4">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={formData.proroga_richiedibile}
                        onChange={(e) => setFormData({ ...formData, proroga_richiedibile: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="font-medium text-gray-900">Proroga Richiedibile</span>
                    </label>
                  </div>

                  {/* Note */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Note Progetto
                    </label>
                    <textarea
                      value={formData.note_progetto}
                      onChange={(e) => setFormData({ ...formData, note_progetto: e.target.value })}
                      rows={4}
                      className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-between items-center">
                {/* Pulsante Elimina (solo nel tab avanzate per progetti esistenti) */}
                <div>
                  {activeTab === 'avanzate' && progetto && onDelete ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (onDelete && progetto) {
                          onDelete(progetto.id)
                        }
                      }}
                      className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors"
                      disabled={loading}
                    >
                      <Trash2 className="w-4 h-4" />
                      Elimina Progetto
                    </button>
                  ) : (
                    <div></div>
                  )}
                </div>

                {/* Pulsanti standard */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    disabled={loading}
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        {progetto ? 'Salva Modifiche' : 'Crea Progetto'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </form>
      </div>

      {/* Modal per visualizzazione documento */}
      {documentModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full h-[90vh] flex flex-col overflow-hidden">
            {/* Header Modal */}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">{documentModal.title}</h3>
              <button
                onClick={() => {
                  URL.revokeObjectURL(documentModal.url)
                  setDocumentModal({ open: false, title: '', url: '', type: '' })
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Contenuto Modal */}
            <div className="flex-1 flex items-center justify-center p-4 bg-gray-50">
              {documentModal.type === 'pdf' ? (
                <iframe
                  src={documentModal.url}
                  className="w-full h-full border-0"
                  title={documentModal.title}
                />
              ) : ['jpg', 'jpeg', 'png', 'gif'].includes(documentModal.type) ? (
                <img
                  src={documentModal.url}
                  alt={documentModal.title}
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <div className="text-center">
                  <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />

                  {documentModal.type === 'docx' || documentModal.type === 'doc' ? (
                    <div className="w-full h-full">
                      <p className="text-gray-800 mb-4 text-center font-medium">
                        📄 Anteprima documento Word
                      </p>

                      {/* Google Docs Viewer con URL pubblico temporaneo */}
                      <div className="space-y-3">
                        <iframe
                          src={`https://docs.google.com/gview?url=${encodeURIComponent(documentModal.url)}&embedded=true`}
                          className="w-full border border-gray-300 rounded"
                          title={documentModal.title}
                          style={{ height: '500px' }}
                        />

                        {/* Info e fallback */}
                        <div className="text-center p-3 bg-gray-50 rounded border text-sm">
                          <p className="text-gray-600 mb-2">
                            🔗 URL temporaneo per anteprima (valido 1 ora)
                          </p>
                          {documentModal.title.includes('TEMPLATE') && (
                            <span className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                              Template da compilare
                            </span>
                          )}
                          {documentModal.title.includes('COMPILATO') && (
                            <span className="inline-block bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                              ✅ Documento compilato
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : documentModal.type === 'txt' ? (
                    <div>
                      <p className="text-gray-800 mb-2 text-lg font-medium">
                        📝 File di testo
                      </p>
                      <iframe
                        src={documentModal.url}
                        className="w-full h-96 border border-gray-300 rounded"
                        title={documentModal.title}
                      />
                    </div>
                  ) : (
                    <div>
                      <p className="text-gray-600 mb-4">
                        Anteprima non disponibile per questo tipo di file
                      </p>
                      <p className="text-sm text-gray-500 mb-6">
                        Tipo file: {documentModal.type?.toUpperCase() || 'Sconosciuto'}
                      </p>
                      <button
                        onClick={() => window.open(documentModal.url, '_blank')}
                        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                      >
                        Apri in nuova scheda
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="flex items-center justify-between p-4 border-t bg-gray-50">
              <span className="text-sm text-gray-600">
                Usa i controlli del browser per zoom e navigazione
              </span>
              <button
                onClick={() => window.open(documentModal.url, '_blank')}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 flex items-center gap-2"
              >
                <Eye className="w-4 h-4" />
                Apri in nuova scheda
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Preview */}
      <DocumentPreviewModal
        isOpen={previewModal.isOpen}
        onClose={() => setPreviewModal({ isOpen: false, documento: null })}
        title={previewModal.documento?.nome_file || ''}
        googleDriveId={previewModal.documento?.google_drive_id || ''}
      />
    </div>
  )
}