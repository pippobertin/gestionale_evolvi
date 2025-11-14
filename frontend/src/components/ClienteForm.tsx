'use client'

import { useState, useEffect } from 'react'
import {
  X,
  Save,
  Building2,
  Mail,
  Phone,
  MapPin,
  Calendar,
  User,
  FileText,
  Euro,
  Users,
  Hash,
  Plus,
  Edit,
  Trash2
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import NuovaAziendaCollegataModal from './NuovaAziendaCollegataModal'
import NuovoCollegamentoModal from './NuovoCollegamentoModal'

interface Cliente {
  id?: string
  denominazione: string
  numero_azienda?: string // Auto-generato dal database
  partita_iva?: string
  rea?: string
  codice_fiscale?: string
  ateco_2025?: string // Codice ATECO 2025 con punti
  ateco_descrizione?: string // Descrizione attività automatica
  data_costituzione?: string
  email?: string
  pec?: string
  telefono?: string
  sito_web?: string
  coordinate_bancarie?: string
  sdi?: string
  indirizzo_fatturazione?: string
  cap_fatturazione?: string
  citta_fatturazione?: string
  provincia_fatturazione?: string
  stato_fatturazione?: string
  ula?: number
  ultimo_fatturato?: number
  attivo_bilancio?: number
  dimensione?: 'MICRO' | 'PICCOLA' | 'MEDIA' | 'GRANDE' // Campo calcolato automaticamente
  matricola_inps?: string
  pat_inail?: string
  numero_dipendenti?: number
  numero_volontari?: number
  numero_collaboratori?: number
  // Rapporti di collegamento/controllo (UE 2003/361/CE)
  tipo_collegamento?: 'AUTONOMA' | 'ASSOCIATA' | 'COLLEGATA'
  impresa_collegata_id?: string
  percentuale_partecipazione?: number
  diritti_voto?: number
  influenza_dominante?: boolean
  note_collegamento?: string
  categoria_evolvi?: 'BASE' | 'PREMIUM' | 'BUSINESS' | 'ENTERPRISE'
  durata_evolvi?: string
  scadenza_evolvi?: string
  assegnato_a?: string
  target?: string
  membro_di?: string
  proprietario?: string
  rating?: number
  descrizione?: string
  note?: string
  // Legale rappresentante
  legale_rappresentante_nome?: string
  legale_rappresentante_cognome?: string
  legale_rappresentante_codice_fiscale?: string
  legale_rappresentante_data_nascita?: string
  legale_rappresentante_luogo_nascita?: string
  legale_rappresentante_provincia_nascita?: string
  legale_rappresentante_nazionalita?: string
  legale_rappresentante_indirizzo?: string
  legale_rappresentante_cap?: string
  legale_rappresentante_citta?: string
  legale_rappresentante_provincia?: string
  legale_rappresentante_email?: string
  legale_rappresentante_telefono?: string
  legale_rappresentante_note?: string
}

interface AtecoCode {
  codice: string
  descrizione: string
  livello: number
  codice_padre?: string
}

interface SezioneAteco {
  codice: string
  descrizione: string
}

interface CollegamentoAziendale {
  id?: string
  azienda_collegata_id: string
  tipo_collegamento: 'COLLEGATA' | 'ASSOCIATA'
  percentuale_partecipazione: number
  diritti_voto?: number
  influenza_dominante?: boolean
  note_collegamento?: string
  // Dati azienda per display
  denominazione_collegata?: string
  ula_collegata?: number
  fatturato_collegato?: number
  attivo_collegato?: number
}

interface ClienteFormProps {
  cliente?: Cliente
  isOpen: boolean
  onClose: () => void
  onSave: () => void
}

export default function ClienteForm({ cliente, isOpen, onClose, onSave }: ClienteFormProps) {
  const [formData, setFormData] = useState<Cliente>({
    denominazione: '',
    stato_fatturazione: 'Italia',
    numero_dipendenti: 0,
    numero_volontari: 0,
    numero_collaboratori: 0,
    tipo_collegamento: 'AUTONOMA',
    influenza_dominante: false
  })
  const [loading, setSaving] = useState(false)
  const [currentTab, setCurrentTab] = useState('anagrafica')
  const [atecoCodes, setAtecoCodes] = useState<AtecoCode[]>([])
  const [clientiCollegabili, setClientiCollegabili] = useState<Cliente[]>([])
  const [dimensioneCalcolata, setDimensioneCalcolata] = useState<string>('')

  // Nuovi stati per la selezione a cascata ATECO
  const [sezioniAteco, setSezioniAteco] = useState<SezioneAteco[]>([])
  const [sezioneSelezionata, setSezioneSelezionata] = useState<string>('')
  const [atecoFiltrati, setAtecoFiltrati] = useState<AtecoCode[]>([])
  const [mappaturaDivisioni, setMappaturaDivisioni] = useState<{ [key: string]: string[] }>({})

  // Stati per il modal nuova azienda collegata
  const [showNuovaAziendaModal, setShowNuovaAziendaModal] = useState(false)

  useEffect(() => {
    if (cliente) {
      setFormData({
        ...cliente,
        data_costituzione: cliente.data_costituzione ? cliente.data_costituzione.split('T')[0] : '',
        scadenza_evolvi: cliente.scadenza_evolvi ? cliente.scadenza_evolvi.split('T')[0] : '',
        legale_rappresentante_data_nascita: cliente.legale_rappresentante_data_nascita ? cliente.legale_rappresentante_data_nascita.split('T')[0] : ''
      })
    } else {
      setFormData({
        denominazione: '',
        stato_fatturazione: 'Italia',
        numero_dipendenti: 0,
        numero_volontari: 0,
        numero_collaboratori: 0,
        tipo_collegamento: 'AUTONOMA',
        influenza_dominante: false,
        legale_rappresentante_nazionalita: 'Italia'
      })
    }
  }, [cliente])

  // Carica codici ATECO all'apertura del form
  useEffect(() => {
    if (isOpen) {
      loadAtecoCodes()
      loadClientiCollegabili()
    }
  }, [isOpen])

  // Calcola automaticamente la dimensione quando cambiano ULA, fatturato o attivo
  useEffect(() => {
    if (formData.ula !== undefined || formData.ultimo_fatturato !== undefined || formData.attivo_bilancio !== undefined) {
      const dimensione = calcolaDimensione(formData.ula, formData.ultimo_fatturato, formData.attivo_bilancio)
      setDimensioneCalcolata(dimensione)
    }
  }, [formData.ula, formData.ultimo_fatturato, formData.attivo_bilancio])

  // Pre-seleziona la sezione quando viene caricato un cliente con codice ATECO (solo al caricamento iniziale)
  useEffect(() => {
    if (formData.ateco_2025 && atecoCodes.length > 0 && Object.keys(mappaturaDivisioni).length > 0 && !sezioneSelezionata) {
      const divisione = formData.ateco_2025.split('.')[0]

      // Trova la sezione corrispondente
      for (const [sezione, divisioni] of Object.entries(mappaturaDivisioni)) {
        if (divisioni.includes(divisione)) {
          setSezioneSelezionata(sezione)

          // Filtra i codici senza resettare il valore selezionato
          const codiciFiltrati = atecoCodes.filter(code => {
            if (!/^\d+/.test(code.codice)) return false
            const div = code.codice.split('.')[0]
            const divisioni = mappaturaDivisioni[sezione] || []
            return divisioni.includes(div)
          })
          setAtecoFiltrati(codiciFiltrati)
          break
        }
      }
    }
  }, [formData.ateco_2025, atecoCodes, mappaturaDivisioni, sezioneSelezionata])

  const loadAtecoCodes = async () => {
    try {
      // Carica il CSV ATECO 2025 strutturato
      const response = await fetch('/data/ATECO-2025-clean.csv')
      const csvText = await response.text()

      const lines = csvText.split('\n')
      const processedCodes: AtecoCode[] = []
      const sezioni: SezioneAteco[] = []
      const mappaturaDiv: { [key: string]: string[] } = {}

      // Skip header
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue

        const [type, code, description, section] = line.split('|')

        if (type === 'SECTION') {
          sezioni.push({
            codice: code,
            descrizione: description.toUpperCase()
          })
          mappaturaDiv[code] = []
        }
        else if (type === 'DIVISION') {
          // Aggiungi alla mappatura divisioni
          if (section && mappaturaDiv[section]) {
            mappaturaDiv[section].push(code)
          }

          processedCodes.push({
            codice: code,
            descrizione: description,
            livello: 2,
          })
        }
        else if (type === 'GROUP' || type === 'CLASS' || type === 'CATEGORY' || type === 'SUBCATEGORY') {
          const levelMap = {
            'GROUP': 3,
            'CLASS': 4,
            'CATEGORY': 5,
            'SUBCATEGORY': 6
          }

          processedCodes.push({
            codice: code,
            descrizione: description,
            livello: levelMap[type as keyof typeof levelMap],
          })
        }
      }

      setSezioniAteco(sezioni)
      setAtecoCodes(processedCodes)
      setMappaturaDivisioni(mappaturaDiv)

    } catch (error) {
      console.error('Errore caricamento codici ATECO dal CSV:', error)
    }
  }

  // Filtra i codici ATECO in base alla sezione selezionata
  const handleSezioneChange = (sezione: string) => {
    setSezioneSelezionata(sezione)
    setFormData(prev => ({ ...prev, ateco_2025: '', ateco_descrizione: '' }))

    if (!sezione) {
      setAtecoFiltrati([])
      return
    }

    // Trova tutti i codici numerici di quella sezione
    const codiciFiltrati = atecoCodes.filter(code => {
      // Solo codici numerici (non le sezioni A, B, C)
      if (!/^\d+/.test(code.codice)) return false

      // Trova la sezione di appartenenza guardando le divisioni (01, 02, etc.)
      const divisione = code.codice.split('.')[0]
      const divisioni = mappaturaDivisioni[sezione] || []
      return divisioni.includes(divisione)
    })

    setAtecoFiltrati(codiciFiltrati)
  }


  const loadClientiCollegabili = async () => {
    try {
      const { data, error } = await supabase
        .from('scadenze_bandi_clienti')
        .select('id, denominazione, numero_azienda')
        .order('denominazione')

      if (error) throw error
      setClientiCollegabili(data || [])
    } catch (error) {
      console.error('Errore caricamento clienti collegabili:', error)
    }
  }

  const [datiAziendaCollegata, setDatiAziendaCollegata] = useState<any>(null)
  const [dimensioneCalcolataCorrente, setDimensioneCalcolataCorrente] = useState<string>('')

  // State per collegamenti multipli
  const [collegamenti, setCollegamenti] = useState<CollegamentoAziendale[]>([])
  const [showNuovoCollegamentoModal, setShowNuovoCollegamentoModal] = useState(false)
  const [collegamentoInModifica, setCollegamentoInModifica] = useState<CollegamentoAziendale | null>(null)

  // Carica i collegamenti esistenti per l'azienda
  const loadCollegamenti = async (clienteId: string) => {
    if (!clienteId) return

    try {
      const { data, error } = await supabase
        .from('scadenze_bandi_collegamenti_aziendali')
        .select(`
          *,
          azienda_collegata:scadenze_bandi_clienti!azienda_collegata_id(
            id,
            denominazione,
            ula,
            ultimo_fatturato,
            attivo_bilancio
          )
        `)
        .eq('azienda_madre_id', clienteId)

      if (error) throw error

      const collegamentiFormattati = (data || []).map(collegamento => ({
        ...collegamento,
        denominazione_collegata: collegamento.azienda_collegata?.denominazione,
        ula_collegata: collegamento.azienda_collegata?.ula,
        fatturato_collegato: collegamento.azienda_collegata?.ultimo_fatturato,
        attivo_collegato: collegamento.azienda_collegata?.attivo_bilancio
      }))

      setCollegamenti(collegamentiFormattati)
    } catch (error) {
      console.error('Errore caricamento collegamenti:', error)
    }
  }

  // Carica i dati dell'azienda collegata quando viene selezionata
  const loadDatiAziendaCollegata = async (impresaId: string) => {
    console.log('🔍 loadDatiAziendaCollegata chiamata con ID:', impresaId)

    if (!impresaId) {
      console.log('❌ ID vuoto, impostando dati a null')
      setDatiAziendaCollegata(null)
      return
    }

    try {
      console.log('📡 Eseguendo query Supabase...')
      const { data, error } = await supabase
        .from('scadenze_bandi_clienti')
        .select('ula, ultimo_fatturato, attivo_bilancio')
        .eq('id', impresaId)
        .single()

      console.log('📊 Risultato query:', { data, error })

      if (error) throw error

      console.log('✅ Dati caricati con successo:', data)
      setDatiAziendaCollegata(data)
    } catch (error) {
      console.error('❌ Errore caricamento dati azienda collegata:', error)
      setDatiAziendaCollegata(null)
    }
  }

  // Carica i dati dell'azienda collegata all'apertura del form se presente
  useEffect(() => {
    if (isOpen && cliente?.impresa_collegata_id) {
      console.log('Caricando dati azienda collegata:', cliente.impresa_collegata_id)
      loadDatiAziendaCollegata(cliente.impresa_collegata_id)
    }

    // Carica i collegamenti multipli se il cliente esiste
    if (isOpen && cliente?.id) {
      loadCollegamenti(cliente.id)
    }
  }, [isOpen, cliente?.impresa_collegata_id, cliente?.id])

  // Ricalcola la dimensione quando cambiano i dati rilevanti
  useEffect(() => {
    const nuovaDimensione = calcolaDimensioneAggregata(
      formData.ula,
      formData.ultimo_fatturato,
      formData.attivo_bilancio
    )
    console.log('🔄 Dimensione aggiornata da useEffect:', nuovaDimensione)
    setDimensioneCalcolataCorrente(nuovaDimensione)
  }, [formData.ula, formData.ultimo_fatturato, formData.attivo_bilancio, formData.tipo_collegamento, formData.percentuale_partecipazione, datiAziendaCollegata])

  // Calcola dimensione considerando aziende collegate secondo UE 2003/361/CE
  const calcolaDimensioneAggregata = (ula?: number, fatturato?: number, attivo?: number): string => {
    if (!ula && !fatturato && !attivo) return ''

    let ulaTotal = ula || 0
    let fatturatoTotal = fatturato || 0
    let attivoTotal = attivo || 0

    console.log('=== CALCOLO DIMENSIONE AGGREGATA ===')
    console.log('Valori base:', { ula, fatturato, attivo })
    console.log('Tipo collegamento:', formData.tipo_collegamento)
    console.log('Percentuale:', formData.percentuale_partecipazione)
    console.log('Dati azienda collegata:', datiAziendaCollegata)

    // Somma tutti i collegamenti aziendali
    collegamenti.forEach(collegamento => {
      if (collegamento.tipo_collegamento === 'COLLEGATA') {
        // Per aziende collegate (25-49.99%): somma proporzionale alla partecipazione
        const percentuale = (collegamento.percentuale_partecipazione || 0) / 100
        ulaTotal += (collegamento.ula_collegata || 0) * percentuale
        fatturatoTotal += (collegamento.fatturato_collegato || 0) * percentuale
        attivoTotal += (collegamento.attivo_collegato || 0) * percentuale
      } else if (collegamento.tipo_collegamento === 'ASSOCIATA') {
        // Per aziende associate (≥50%): somma il 100%
        ulaTotal += collegamento.ula_collegata || 0
        fatturatoTotal += collegamento.fatturato_collegato || 0
        attivoTotal += collegamento.attivo_collegato || 0
      }
    })

    // Compatibilità con il vecchio sistema (se esiste ancora un collegamento singolo)
    if (formData.tipo_collegamento !== 'AUTONOMA' && datiAziendaCollegata && collegamenti.length === 0) {
      if (formData.tipo_collegamento === 'COLLEGATA') {
        const percentuale = (formData.percentuale_partecipazione || 0) / 100
        ulaTotal += (datiAziendaCollegata.ula || 0) * percentuale
        fatturatoTotal += (datiAziendaCollegata.ultimo_fatturato || 0) * percentuale
        attivoTotal += (datiAziendaCollegata.attivo_bilancio || 0) * percentuale
      } else if (formData.tipo_collegamento === 'ASSOCIATA') {
        ulaTotal += datiAziendaCollegata.ula || 0
        fatturatoTotal += datiAziendaCollegata.ultimo_fatturato || 0
        attivoTotal += datiAziendaCollegata.attivo_bilancio || 0
      }
    }

    console.log('Totali finali:', { ulaTotal, fatturatoTotal, attivoTotal })

    // Applica i limiti UE 2003/361/CE
    let dimensioneCalcolata = ''
    if (ulaTotal < 10 && (fatturatoTotal <= 2000000 || attivoTotal <= 2000000)) dimensioneCalcolata = 'MICRO'
    else if (ulaTotal < 50 && (fatturatoTotal <= 10000000 || attivoTotal <= 10000000)) dimensioneCalcolata = 'PICCOLA'
    else if (ulaTotal < 250 && (fatturatoTotal <= 50000000 || attivoTotal <= 43000000)) dimensioneCalcolata = 'MEDIA'
    else dimensioneCalcolata = 'GRANDE'

    console.log('Dimensione calcolata:', dimensioneCalcolata)
    console.log('=====================================')

    return dimensioneCalcolata
  }

  const calcolaDimensione = (ula?: number, fatturato?: number, attivo?: number): string => {
    return calcolaDimensioneAggregata(ula, fatturato, attivo)
  }

  const handleInputChange = (field: keyof Cliente, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))

    // Se cambia il tipo di collegamento e c'è un'impresa collegata, ricarica i dati per il calcolo
    if (field === 'tipo_collegamento' && formData.impresa_collegata_id) {
      loadDatiAziendaCollegata(formData.impresa_collegata_id)
    }
  }

  // Gestione creazione nuova azienda collegata
  const handleNuovaAziendaCreata = (nuovaAzienda: { id: string; denominazione: string; numero_azienda: string }) => {
    // Aggiorna la lista dei clienti collegabili
    setClientiCollegabili(prev => [...prev, nuovaAzienda])

    // Seleziona automaticamente la nuova azienda creata
    handleInputChange('impresa_collegata_id', nuovaAzienda.id)

    setShowNuovaAziendaModal(false)
  }

  const handleImpresaCollegataChange = (value: string) => {
    if (value === 'NUOVA_AZIENDA') {
      setShowNuovaAziendaModal(true)
    } else {
      handleInputChange('impresa_collegata_id', value)
      // Carica i dati dell'azienda collegata per il calcolo aggregato
      if (value) {
        loadDatiAziendaCollegata(value)
      } else {
        setDatiAziendaCollegata(null)
      }
    }
  }

  // Funzione per salvare un collegamento
  const salvaCollegamento = async (collegamento: CollegamentoAziendale) => {
    try {
      console.log('💾 Tentativo di salvataggio collegamento:', collegamento)
      console.log('🆔 Cliente ID:', cliente?.id)

      if (!cliente?.id) {
        throw new Error('ID cliente mancante - salvare prima il cliente')
      }

      if (collegamento.id) {
        // Update existing
        console.log('✏️ Aggiornamento collegamento esistente ID:', collegamento.id)
        const { data, error } = await supabase
          .from('scadenze_bandi_collegamenti_aziendali')
          .update({
            azienda_collegata_id: collegamento.azienda_collegata_id,
            tipo_collegamento: collegamento.tipo_collegamento,
            percentuale_partecipazione: collegamento.percentuale_partecipazione || null,
            diritti_voto: collegamento.diritti_voto || null,
            influenza_dominante: collegamento.influenza_dominante || false,
            note_collegamento: collegamento.note_collegamento || null
          })
          .eq('id', collegamento.id)
          .select()

        if (error) {
          console.error('❌ Errore update:', error)
          throw error
        }
        console.log('✅ Update riuscito:', data)
      } else {
        // Create new
        console.log('➕ Creazione nuovo collegamento')
        const insertData = {
          azienda_madre_id: cliente.id,
          azienda_collegata_id: collegamento.azienda_collegata_id,
          tipo_collegamento: collegamento.tipo_collegamento,
          percentuale_partecipazione: collegamento.percentuale_partecipazione || null,
          diritti_voto: collegamento.diritti_voto || null,
          influenza_dominante: collegamento.influenza_dominante || false,
          note_collegamento: collegamento.note_collegamento || null
        }

        console.log('📋 Dati da inserire:', insertData)

        const { data, error } = await supabase
          .from('scadenze_bandi_collegamenti_aziendali')
          .insert([insertData])
          .select()

        if (error) {
          console.error('❌ Errore insert:', error)
          throw error
        }
        console.log('✅ Insert riuscito:', data)
      }

      // Ricarica i collegamenti
      console.log('🔄 Ricaricando collegamenti...')
      await loadCollegamenti(cliente.id)
      console.log('✅ Collegamento salvato con successo')
    } catch (error) {
      console.error('❌ Errore nel salvataggio del collegamento:', error)

      // Gestisci errore di collegamento duplicato
      if (error.code === '23505' && error.message.includes('unique_collegamento_per_azienda')) {
        alert('Esiste già un collegamento con questa azienda. Non è possibile creare collegamenti duplicati.')
      } else {
        alert(`Errore nel salvataggio del collegamento: ${error.message}`)
      }
    }
  }

  // Funzione per rimuovere un collegamento
  const rimuoviCollegamento = async (collegamentoId: string) => {
    if (!confirm('Sei sicuro di voler rimuovere questo collegamento?')) return

    try {
      const { error } = await supabase
        .from('scadenze_bandi_collegamenti_aziendali')
        .delete()
        .eq('id', collegamentoId)

      if (error) throw error

      // Ricarica i collegamenti
      if (cliente?.id) {
        await loadCollegamenti(cliente.id)
      }
    } catch (error) {
      console.error('Errore nella rimozione del collegamento:', error)
      alert('Errore nella rimozione del collegamento')
    }
  }

  const handleSave = async () => {
    if (!formData.denominazione.trim()) {
      alert('La denominazione è obbligatoria')
      return
    }

    setSaving(true)
    try {
      // Prepara i dati per il salvataggio escludendo campi potenzialmente problematici
      const dataToSave = { ...formData }

      // Rimuovi campi calcolati/derivati che non devono essere salvati
      delete dataToSave.numero_progetti
      delete dataToSave.created_at
      delete dataToSave.updated_at
      delete dataToSave.dimensione
      delete dataToSave.dimensione_aggregata
      delete dataToSave.numero_collegamenti
      delete dataToSave.legale_rappresentante_completo
      delete dataToSave.legale_rappresentante_eta

      // Se il campo ATECO è vuoto, rimuovilo per evitare problemi di foreign key
      if (!dataToSave.ateco_2025 || dataToSave.ateco_2025.trim() === '') {
        delete dataToSave.ateco_2025
        delete dataToSave.ateco_descrizione
      }

      // Gestisci tutti i campi data vuoti convertendoli a null
      const dateFields = ['scadenza_evolvi', 'data_bilancio_consolidato', 'data_costituzione', 'legale_rappresentante_data_nascita']
      dateFields.forEach(field => {
        if (dataToSave[field] === '' || dataToSave[field] === undefined) {
          dataToSave[field] = null
        }
      })

      if (cliente?.id) {
        // Update existing client
        const { error } = await supabase
          .from('scadenze_bandi_clienti')
          .update(dataToSave)
          .eq('id', cliente.id)

        if (error) throw error
      } else {
        // Create new client
        const { error } = await supabase
          .from('scadenze_bandi_clienti')
          .insert([dataToSave])

        if (error) throw error
      }

      onSave()
      onClose()
    } catch (error) {
      console.error('Errore nel salvataggio:', error)
      alert('Errore nel salvataggio del cliente')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const tabs = [
    { id: 'anagrafica', label: 'Dati Anagrafici', icon: Building2 },
    { id: 'contatti', label: 'Contatti', icon: Mail },
    { id: 'legale', label: 'Legale Rappresentante', icon: User },
    { id: 'dimensionamento', label: 'Dimensionamento', icon: Users },
    { id: 'collegamenti', label: 'Rapporti Aziendali', icon: Hash },
    { id: 'gestione', label: 'Gestione', icon: FileText }
  ]

  const renderTabContent = () => {
    switch (currentTab) {
      case 'anagrafica':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Denominazione *
                </label>
                <input
                  type="text"
                  value={formData.denominazione}
                  onChange={(e) => handleInputChange('denominazione', e.target.value)}
                  className="input"
                  placeholder="Ragione sociale completa"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Numero Azienda (Auto-generato)
                </label>
                <input
                  type="text"
                  value={formData.numero_azienda || 'Sarà generato automaticamente'}
                  readOnly
                  className="input bg-gray-50 cursor-not-allowed"
                  placeholder="AZ2025000001"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Il numero viene assegnato automaticamente alla creazione
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Partita IVA
                </label>
                <input
                  type="text"
                  value={formData.partita_iva || ''}
                  onChange={(e) => handleInputChange('partita_iva', e.target.value)}
                  className="input"
                  placeholder="12345678901"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Codice Fiscale
                </label>
                <input
                  type="text"
                  value={formData.codice_fiscale || ''}
                  onChange={(e) => handleInputChange('codice_fiscale', e.target.value)}
                  className="input"
                  placeholder="RSSMRA80A01H501Z"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  REA
                </label>
                <input
                  type="text"
                  value={formData.rea || ''}
                  onChange={(e) => handleInputChange('rea', e.target.value)}
                  className="input"
                  placeholder="RM-123456"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Selezione Sezione ATECO */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sezione Attività ATECO 2025
                </label>
                <select
                  value={sezioneSelezionata}
                  onChange={(e) => handleSezioneChange(e.target.value)}
                  className="input"
                >
                  <option value="">Prima seleziona la sezione</option>
                  {sezioniAteco.map((sezione) => (
                    <option key={sezione.codice} value={sezione.codice}>
                      {sezione.codice} - {sezione.descrizione}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selezione Codice ATECO specifico */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Codice ATECO specifico
                </label>
                <select
                  value={formData.ateco_2025 || ''}
                  onChange={(e) => {
                    const selectedValue = e.target.value
                    const selectedCode = atecoFiltrati.find(code => code.codice === selectedValue)

                    handleInputChange('ateco_2025', selectedValue)
                    if (selectedCode) {
                      handleInputChange('ateco_descrizione', selectedCode.descrizione)
                    }
                  }}
                  className="input"
                  disabled={!sezioneSelezionata}
                >
                  <option value="">
                    {sezioneSelezionata ? 'Seleziona il codice specifico' : 'Prima seleziona una sezione'}
                  </option>
                  {atecoFiltrati.map((code) => (
                    <option key={code.codice} value={code.codice}>
                      {'  '.repeat(code.livello - 2)}{code.codice} - {code.descrizione}
                    </option>
                  ))}
                </select>
                {formData.ateco_descrizione && (
                  <p className="text-xs text-gray-600 mt-1">
                    <strong>Attività selezionata:</strong> {formData.ateco_descrizione}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data Costituzione
                </label>
                <input
                  type="date"
                  value={formData.data_costituzione || ''}
                  onChange={(e) => handleInputChange('data_costituzione', e.target.value)}
                  className="input"
                />
              </div>
            </div>

            {/* Indirizzo */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <MapPin className="w-5 h-5 mr-2" />
                Indirizzo di Fatturazione
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Indirizzo
                  </label>
                  <input
                    type="text"
                    value={formData.indirizzo_fatturazione || ''}
                    onChange={(e) => handleInputChange('indirizzo_fatturazione', e.target.value)}
                    className="input"
                    placeholder="Via Roma, 123"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CAP
                  </label>
                  <input
                    type="text"
                    value={formData.cap_fatturazione || ''}
                    onChange={(e) => handleInputChange('cap_fatturazione', e.target.value)}
                    className="input"
                    placeholder="00100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Città
                  </label>
                  <input
                    type="text"
                    value={formData.citta_fatturazione || ''}
                    onChange={(e) => handleInputChange('citta_fatturazione', e.target.value)}
                    className="input"
                    placeholder="Roma"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Provincia
                  </label>
                  <input
                    type="text"
                    value={formData.provincia_fatturazione || ''}
                    onChange={(e) => handleInputChange('provincia_fatturazione', e.target.value)}
                    className="input"
                    placeholder="RM"
                    maxLength={2}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stato
                  </label>
                  <input
                    type="text"
                    value={formData.stato_fatturazione || 'Italia'}
                    onChange={(e) => handleInputChange('stato_fatturazione', e.target.value)}
                    className="input"
                  />
                </div>
              </div>
            </div>
          </div>
        )

      case 'contatti':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="input"
                  placeholder="info@azienda.it"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  PEC
                </label>
                <input
                  type="email"
                  value={formData.pec || ''}
                  onChange={(e) => handleInputChange('pec', e.target.value)}
                  className="input"
                  placeholder="pec@azienda.pec.it"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Telefono
                </label>
                <input
                  type="tel"
                  value={formData.telefono || ''}
                  onChange={(e) => handleInputChange('telefono', e.target.value)}
                  className="input"
                  placeholder="+39 06 12345678"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sito Web
                </label>
                <input
                  type="url"
                  value={formData.sito_web || ''}
                  onChange={(e) => handleInputChange('sito_web', e.target.value)}
                  className="input"
                  placeholder="https://www.azienda.it"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Coordinate Bancarie (IBAN)
                </label>
                <input
                  type="text"
                  value={formData.coordinate_bancarie || ''}
                  onChange={(e) => handleInputChange('coordinate_bancarie', e.target.value)}
                  className="input"
                  placeholder="IT60 X054 2811 1010 0000 0123 456"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Codice SDI
                </label>
                <input
                  type="text"
                  value={formData.sdi || ''}
                  onChange={(e) => handleInputChange('sdi', e.target.value)}
                  className="input"
                  placeholder="ABCDEF1"
                />
              </div>
            </div>
          </div>
        )

      case 'legale':
        return (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <User className="w-5 h-5 text-blue-600 mr-2" />
                <h3 className="text-lg font-semibold text-blue-900">Dati Legale Rappresentante</h3>
              </div>
              <p className="text-blue-700 mt-2 text-sm">
                Inserisci i dati del legale rappresentante dell'azienda
              </p>
            </div>

            {/* Dati Anagrafici */}
            <div>
              <h4 className="text-md font-semibold text-gray-900 mb-4 flex items-center">
                <User className="w-4 h-4 mr-2" />
                Dati Anagrafici
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome *
                  </label>
                  <input
                    type="text"
                    value={formData.legale_rappresentante_nome || ''}
                    onChange={(e) => handleInputChange('legale_rappresentante_nome', e.target.value)}
                    className="input"
                    placeholder="Nome del legale rappresentante"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cognome *
                  </label>
                  <input
                    type="text"
                    value={formData.legale_rappresentante_cognome || ''}
                    onChange={(e) => handleInputChange('legale_rappresentante_cognome', e.target.value)}
                    className="input"
                    placeholder="Cognome del legale rappresentante"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Codice Fiscale
                  </label>
                  <input
                    type="text"
                    value={formData.legale_rappresentante_codice_fiscale || ''}
                    onChange={(e) => handleInputChange('legale_rappresentante_codice_fiscale', e.target.value.toUpperCase())}
                    className="input"
                    placeholder="RSSMRA80A01H501X"
                    maxLength={16}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Data di Nascita
                  </label>
                  <input
                    type="date"
                    value={formData.legale_rappresentante_data_nascita || ''}
                    onChange={(e) => handleInputChange('legale_rappresentante_data_nascita', e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Luogo di Nascita
                  </label>
                  <input
                    type="text"
                    value={formData.legale_rappresentante_luogo_nascita || ''}
                    onChange={(e) => handleInputChange('legale_rappresentante_luogo_nascita', e.target.value)}
                    className="input"
                    placeholder="Milano"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Provincia di Nascita
                  </label>
                  <input
                    type="text"
                    value={formData.legale_rappresentante_provincia_nascita || ''}
                    onChange={(e) => handleInputChange('legale_rappresentante_provincia_nascita', e.target.value.toUpperCase())}
                    className="input"
                    placeholder="MI"
                    maxLength={2}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nazionalità
                  </label>
                  <input
                    type="text"
                    value={formData.legale_rappresentante_nazionalita || ''}
                    onChange={(e) => handleInputChange('legale_rappresentante_nazionalita', e.target.value)}
                    className="input"
                    placeholder="Italia"
                  />
                </div>
              </div>
            </div>

            {/* Indirizzo */}
            <div>
              <h4 className="text-md font-semibold text-gray-900 mb-4 flex items-center">
                <MapPin className="w-4 h-4 mr-2" />
                Indirizzo di Residenza
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Indirizzo
                  </label>
                  <input
                    type="text"
                    value={formData.legale_rappresentante_indirizzo || ''}
                    onChange={(e) => handleInputChange('legale_rappresentante_indirizzo', e.target.value)}
                    className="input"
                    placeholder="Via Roma, 123"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CAP
                  </label>
                  <input
                    type="text"
                    value={formData.legale_rappresentante_cap || ''}
                    onChange={(e) => handleInputChange('legale_rappresentante_cap', e.target.value)}
                    className="input"
                    placeholder="20100"
                    maxLength={5}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Città
                  </label>
                  <input
                    type="text"
                    value={formData.legale_rappresentante_citta || ''}
                    onChange={(e) => handleInputChange('legale_rappresentante_citta', e.target.value)}
                    className="input"
                    placeholder="Milano"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Provincia
                  </label>
                  <input
                    type="text"
                    value={formData.legale_rappresentante_provincia || ''}
                    onChange={(e) => handleInputChange('legale_rappresentante_provincia', e.target.value.toUpperCase())}
                    className="input"
                    placeholder="MI"
                    maxLength={2}
                  />
                </div>
              </div>
            </div>

            {/* Contatti */}
            <div>
              <h4 className="text-md font-semibold text-gray-900 mb-4 flex items-center">
                <Mail className="w-4 h-4 mr-2" />
                Contatti
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.legale_rappresentante_email || ''}
                    onChange={(e) => handleInputChange('legale_rappresentante_email', e.target.value)}
                    className="input"
                    placeholder="mario.rossi@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Telefono
                  </label>
                  <input
                    type="tel"
                    value={formData.legale_rappresentante_telefono || ''}
                    onChange={(e) => handleInputChange('legale_rappresentante_telefono', e.target.value)}
                    className="input"
                    placeholder="+39 333 1234567"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Note
                  </label>
                  <textarea
                    value={formData.legale_rappresentante_note || ''}
                    onChange={(e) => handleInputChange('legale_rappresentante_note', e.target.value)}
                    className="input"
                    rows={3}
                    placeholder="Note aggiuntive sul legale rappresentante..."
                  />
                </div>
              </div>
            </div>
          </div>
        )

      case 'dimensionamento':
        // Usa la dimensione calcolata dal useEffect che considera i collegamenti
        const dimensioneCalcolata = dimensioneCalcolataCorrente

        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ULA (Unità Lavorative Annue)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.ula || ''}
                  onChange={(e) => handleInputChange('ula', parseFloat(e.target.value) || 0)}
                  className="input"
                  placeholder="2.5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ultimo Fatturato (€)
                </label>
                <input
                  type="number"
                  value={formData.ultimo_fatturato || ''}
                  onChange={(e) => handleInputChange('ultimo_fatturato', parseFloat(e.target.value) || 0)}
                  className="input"
                  placeholder="325000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Attivo di Bilancio (€)
                </label>
                <input
                  type="number"
                  value={formData.attivo_bilancio || ''}
                  onChange={(e) => handleInputChange('attivo_bilancio', parseFloat(e.target.value) || 0)}
                  className="input"
                  placeholder="140000"
                />
              </div>
            </div>

            {/* Dimensione calcolata automaticamente */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-800 mb-2">
                📊 Dimensione Aziendale (Calcolata automaticamente secondo UE 2003/361/CE)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <span className="text-lg font-bold text-blue-600">
                    {dimensioneCalcolata || 'Non calcolabile'}
                  </span>
                  {dimensioneCalcolata && (
                    <p className="text-xs text-blue-600 mt-1">
                      {formData.tipo_collegamento !== 'AUTONOMA' && datiAziendaCollegata ? (
                        <>
                          📊 <strong>Calcolo aggregato</strong> secondo UE 2003/361/CE<br/>
                          Include dati dell'azienda {formData.tipo_collegamento?.toLowerCase()}
                        </>
                      ) : (
                        'Basata su ULA, fatturato e attivo di bilancio inseriti'
                      )}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rating (1-5)
                  </label>
                  <select
                    value={formData.rating || ''}
                    onChange={(e) => handleInputChange('rating', parseInt(e.target.value) || undefined)}
                    className="input"
                  >
                    <option value="">Nessun rating</option>
                    <option value={1}>⭐ 1 stella</option>
                    <option value={2}>⭐⭐ 2 stelle</option>
                    <option value={3}>⭐⭐⭐ 3 stelle</option>
                    <option value={4}>⭐⭐⭐⭐ 4 stelle</option>
                    <option value={5}>⭐⭐⭐⭐⭐ 5 stelle</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Numero Dipendenti
                </label>
                <input
                  type="number"
                  value={formData.numero_dipendenti || 0}
                  onChange={(e) => handleInputChange('numero_dipendenti', parseInt(e.target.value) || 0)}
                  className="input"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Numero Volontari
                </label>
                <input
                  type="number"
                  value={formData.numero_volontari || 0}
                  onChange={(e) => handleInputChange('numero_volontari', parseInt(e.target.value) || 0)}
                  className="input"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Numero Collaboratori
                </label>
                <input
                  type="number"
                  value={formData.numero_collaboratori || 0}
                  onChange={(e) => handleInputChange('numero_collaboratori', parseInt(e.target.value) || 0)}
                  className="input"
                  min="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Matricola INPS
                </label>
                <input
                  type="text"
                  value={formData.matricola_inps || ''}
                  onChange={(e) => handleInputChange('matricola_inps', e.target.value)}
                  className="input"
                  placeholder="12345678"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  PAT INAIL
                </label>
                <input
                  type="text"
                  value={formData.pat_inail || ''}
                  onChange={(e) => handleInputChange('pat_inail', e.target.value)}
                  className="input"
                  placeholder="12345678901"
                />
              </div>
            </div>
          </div>
        )

      case 'collegamenti':
        return (
          <div className="space-y-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-yellow-800 mb-2">
                ⚖️ Rapporti di Collegamento/Controllo (UE 2003/361/CE)
              </h4>
              <p className="text-xs text-yellow-700">
                Questi rapporti sono fondamentali per determinare la dimensione aziendale ai fini dei bandi europei.
                Un'azienda può avere più rapporti di collegamento con aziende diverse.
              </p>
            </div>

            {/* Lista collegamenti esistenti */}
            <div className="border rounded-lg">
              <div className="px-4 py-3 border-b flex items-center justify-between bg-gray-50">
                <h4 className="font-medium text-gray-900">Rapporti di Collegamento Attivi</h4>
                <button
                  type="button"
                  onClick={() => setShowNuovoCollegamentoModal(true)}
                  className="btn-primary text-sm py-2 px-3"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Aggiungi Collegamento
                </button>
              </div>

              <div className="p-4">
                {collegamenti.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nessun collegamento aziendale configurato</p>
                    <p className="text-xs mt-1">Aggiungi collegamenti per calcolare la dimensione aggregata</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {collegamenti.map((collegamento, index) => (
                      <div key={collegamento.id || index} className="border rounded-lg p-4 bg-white">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h5 className="font-medium text-gray-900">
                                {collegamento.denominazione_collegata || 'Azienda collegata'}
                              </h5>
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                collegamento.tipo_collegamento === 'ASSOCIATA'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}>
                                {collegamento.tipo_collegamento}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <span className="text-gray-500">Partecipazione:</span>
                                <span className="ml-1 font-medium">
                                  {collegamento.percentuale_partecipazione}%
                                </span>
                              </div>
                              {collegamento.ula_collegata && (
                                <div>
                                  <span className="text-gray-500">ULA:</span>
                                  <span className="ml-1 font-medium">{collegamento.ula_collegata}</span>
                                </div>
                              )}
                              {collegamento.fatturato_collegato && (
                                <div>
                                  <span className="text-gray-500">Fatturato:</span>
                                  <span className="ml-1 font-medium">
                                    €{collegamento.fatturato_collegato.toLocaleString()}
                                  </span>
                                </div>
                              )}
                              {collegamento.attivo_collegato && (
                                <div>
                                  <span className="text-gray-500">Attivo:</span>
                                  <span className="ml-1 font-medium">
                                    €{collegamento.attivo_collegato.toLocaleString()}
                                  </span>
                                </div>
                              )}
                            </div>

                            {collegamento.note_collegamento && (
                              <div className="mt-2 text-sm text-gray-600">
                                <span className="text-gray-500">Note:</span> {collegamento.note_collegamento}
                              </div>
                            )}
                          </div>

                          <div className="flex gap-2 ml-4">
                            <button
                              type="button"
                              onClick={() => {
                                setCollegamentoInModifica(collegamento)
                                setShowNuovoCollegamentoModal(true)
                              }}
                              className="btn-secondary text-xs py-1 px-2"
                            >
                              <Edit className="w-3 h-3 mr-1" />
                              Modifica
                            </button>
                            <button
                              type="button"
                              onClick={() => rimuoviCollegamento(collegamento.id!)}
                              className="btn-danger text-xs py-1 px-2"
                            >
                              <Trash2 className="w-3 h-3 mr-1" />
                              Rimuovi
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Calcolo dimensione aggregata */}
            {collegamenti.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-800 mb-2">
                  📊 Calcolo Dimensione Aggregata
                </h4>
                <div className="text-sm text-blue-700">
                  <p>La dimensione viene calcolata aggregando:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Azienda principale: {formData.ula || 0} ULA, €{(formData.ultimo_fatturato || 0).toLocaleString()}</li>
                    {collegamenti.map((col, idx) => (
                      <li key={idx}>
                        {col.denominazione_collegata}: {col.tipo_collegamento === 'ASSOCIATA' ? '100%' : `${col.percentuale_partecipazione}%`}
                        {' '}({col.ula_collegata || 0} ULA, €{(col.fatturato_collegato || 0).toLocaleString()})
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 p-2 bg-blue-100 rounded">
                    <strong>Dimensione aggregata calcolata: {calcolaDimensioneAggregata(formData.ula, formData.ultimo_fatturato, formData.attivo_bilancio)}</strong>
                  </div>
                </div>
              </div>
            )}

            {showNuovoCollegamentoModal && (
              <NuovoCollegamentoModal
                isOpen={showNuovoCollegamentoModal}
                onClose={() => {
                  setShowNuovoCollegamentoModal(false)
                  setCollegamentoInModifica(null)
                }}
                onSave={salvaCollegamento}
                clientiDisponibili={clientiCollegabili.filter(c => c.id !== cliente?.id)}
                collegamentoInModifica={collegamentoInModifica}
                onReloadClienti={loadClientiCollegabili}
                collegamentiEsistenti={collegamenti}
              />
            )}

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-800 mb-2">
                📖 Criteri di Collegamento UE 2003/361/CE
              </h4>
              <div className="text-xs text-gray-600 space-y-1">
                <p><strong>Associata (≥50%):</strong> Somma il 100% dei valori dell'azienda associata</p>
                <p><strong>Collegata (25-49.99%):</strong> Somma proporzionalmente in base alla percentuale di partecipazione</p>
              </div>
            </div>
          </div>
        )

      case 'gestione':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Categoria Evolvi
                </label>
                <select
                  value={formData.categoria_evolvi || ''}
                  onChange={(e) => handleInputChange('categoria_evolvi', e.target.value)}
                  className="input"
                >
                  <option value="">Seleziona categoria</option>
                  <option value="BASE">Base</option>
                  <option value="PREMIUM">Premium</option>
                  <option value="BUSINESS">Business</option>
                  <option value="ENTERPRISE">Enterprise</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Scadenza Evolvi
                </label>
                <input
                  type="date"
                  value={formData.scadenza_evolvi || ''}
                  onChange={(e) => handleInputChange('scadenza_evolvi', e.target.value)}
                  className="input"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Durata Evolvi
                </label>
                <input
                  type="text"
                  value={formData.durata_evolvi || ''}
                  onChange={(e) => handleInputChange('durata_evolvi', e.target.value)}
                  className="input"
                  placeholder="12 mesi"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assegnato a
                </label>
                <input
                  type="text"
                  value={formData.assegnato_a || ''}
                  onChange={(e) => handleInputChange('assegnato_a', e.target.value)}
                  className="input"
                  placeholder="Nome Consulente"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Target
                </label>
                <input
                  type="text"
                  value={formData.target || ''}
                  onChange={(e) => handleInputChange('target', e.target.value)}
                  className="input"
                  placeholder="PMI Innovativa"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Membro di
                </label>
                <input
                  type="text"
                  value={formData.membro_di || ''}
                  onChange={(e) => handleInputChange('membro_di', e.target.value)}
                  className="input"
                  placeholder="Gruppo Aziendale"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Proprietario
                </label>
                <input
                  type="text"
                  value={formData.proprietario || ''}
                  onChange={(e) => handleInputChange('proprietario', e.target.value)}
                  className="input"
                  placeholder="Nome Proprietario"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descrizione
              </label>
              <textarea
                value={formData.descrizione || ''}
                onChange={(e) => handleInputChange('descrizione', e.target.value)}
                className="input min-h-[80px]"
                placeholder="Descrizione dell'azienda e delle attività..."
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Note
              </label>
              <textarea
                value={formData.note || ''}
                onChange={(e) => handleInputChange('note', e.target.value)}
                className="input min-h-[80px]"
                placeholder="Note interne e promemoria..."
                rows={3}
              />
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-hard max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="gradient-primary text-white p-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Building2 className="w-6 h-6" />
            <h2 className="text-xl font-bold">
              {cliente ? 'Modifica Cliente' : 'Nuovo Cliente'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 px-6">
          <div className="flex space-x-6">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setCurrentTab(tab.id)}
                  className={`py-4 px-2 border-b-2 font-medium text-sm flex items-center space-x-2 transition-colors ${
                    currentTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {renderTabContent()}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            className="btn-secondary"
            disabled={loading}
          >
            Annulla
          </button>
          <button
            onClick={handleSave}
            className="btn-primary flex items-center space-x-2"
            disabled={loading || !formData.denominazione.trim()}
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{loading ? 'Salvando...' : 'Salva Cliente'}</span>
          </button>
        </div>
      </div>

      {/* Modal per nuova azienda collegata */}
      <NuovaAziendaCollegataModal
        isOpen={showNuovaAziendaModal}
        onClose={() => setShowNuovaAziendaModal(false)}
        onSave={handleNuovaAziendaCreata}
      />
    </div>
  )
}