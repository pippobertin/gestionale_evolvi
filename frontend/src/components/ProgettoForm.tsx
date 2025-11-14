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
import Docxtemplater from 'docxtemplater'
import PizZip from 'pizzip'
import * as mammoth from 'mammoth'
import { Document, Packer, Paragraph, TextRun, AlignmentType, convertInchesToTwip } from 'docx'
import { createReport } from 'docx-templates'

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
  data_pubblicazione_graduatoria: string
  data_decreto_concessione: string
  scadenza_accettazione_esiti: string
  data_avvio_progetto: string
  data_fine_progetto_prevista: string
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
  bando?: Bando
  cliente?: Cliente
  progetto?: any // Per modifica esistente
}

type TabType = 'generale' | 'importi' | 'scadenze' | 'documenti' | 'avanzate'

export default function ProgettoForm({ onClose, onProgettoCreated, bando, cliente, progetto }: ProgettoFormProps) {
  const [activeTab, setActiveTab] = useState<TabType>('generale')
  const [loading, setLoading] = useState(false)
  const [bandi, setBandi] = useState<Bando[]>([])
  const [clienti, setClienti] = useState<Cliente[]>([])
  const [templateScadenze, setTemplateScadenze] = useState<any[]>([])
  const [scadenzeSalvate, setScadenzeSalvate] = useState<any[]>([])
  const [bandoSelezionato, setBandoSelezionato] = useState<any>(null)

  // Stati per documenti
  const [documenti, setDocumenti] = useState<any[]>([])
  const [documentiEreditati, setDocumentiEreditati] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{[key: string]: number}>({})

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
    data_pubblicazione_graduatoria: '',
    data_decreto_concessione: '',
    scadenza_accettazione_esiti: '',
    data_avvio_progetto: '',
    data_fine_progetto_prevista: '',
    anticipo_richiedibile: true,
    percentuale_anticipo: 30,
    numero_sal: 'DUE',
    proroga_richiedibile: true,
    referente_interno: '',
    email_referente_interno: '',
    note_progetto: ''
  })

  useEffect(() => {
    loadBandi()
    loadClienti()

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
        data_pubblicazione_graduatoria: progetto.data_pubblicazione_graduatoria ? progetto.data_pubblicazione_graduatoria.split('T')[0] : '',
        data_decreto_concessione: progetto.data_decreto_concessione ? progetto.data_decreto_concessione.split('T')[0] : '',
        scadenza_accettazione_esiti: progetto.scadenza_accettazione_esiti ? progetto.scadenza_accettazione_esiti.split('T')[0] : '',
        data_avvio_progetto: progetto.data_avvio_progetto ? progetto.data_avvio_progetto.split('T')[0] : '',
        data_fine_progetto_prevista: progetto.data_fine_progetto_prevista ? progetto.data_fine_progetto_prevista.split('T')[0] : '',
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
      generateCodiceProgetto()

      // Se passato un bando, pre-popola i campi
      if (bando) {
        console.log('📋 Bando pre-selezionato trovato:', {
          id: bando.id,
          nome: bando.nome,
          data_pubblicazione_graduatoria: bando.data_pubblicazione_graduatoria
        })

        const dataEreditata = bando.data_pubblicazione_graduatoria ?
          bando.data_pubblicazione_graduatoria.split('T')[0] : ''

        console.log('📅 Ereditando data dal bando pre-selezionato:', dataEreditata)

        setFormData(prev => ({
          ...prev,
          contributo_ammesso: bando.contributo_massimo,
          percentuale_contributo: bando.percentuale_contributo,
          // Importa automaticamente la data pubblicazione graduatoria
          data_pubblicazione_graduatoria: dataEreditata
        }))

        // Carica template documents anche per nuovo progetto se c'è un bando
        console.log('🔄 Caricando documenti per nuovo progetto con bando pre-selezionato')
        loadDocumenti('')  // Passare stringa vuota come progettoId per nuovo progetto
      }
    }
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
      console.log('🔄 Loading bando con template per:', formData.bando_id)
      loadBandoConTemplate(formData.bando_id)
    }
  }, [formData.bando_id])

  // Carica anche il bando pre-selezionato se passato come prop
  useEffect(() => {
    if (bando && bando.id && !bandoSelezionato) {
      console.log('🔄 Loading bando pre-selezionato:', bando.id, bando.nome)
      loadBandoConTemplate(bando.id)
    }
  }, [bando, bandoSelezionato])

  // Effetto aggiuntivo per mostrare scadenze calcolate quando cambiano i dati relevanti
  useEffect(() => {
    if (formData.bando_id && (formData.data_pubblicazione_graduatoria || bandoSelezionato?.data_pubblicazione_graduatoria)) {
      console.log('📅 Ricalcolo scadenze per preview:', {
        bando_id: formData.bando_id,
        data_pubblicazione: formData.data_pubblicazione_graduatoria || bandoSelezionato?.data_pubblicazione_graduatoria,
        templates_count: templateScadenze?.length || 0
      })
      // Le scadenze vengono calcolate automaticamente quando viene renderizzato il tab "scadenze"
      // tramite la funzione calcolaScadenzeAnteprima()
    }
  }, [formData.bando_id, formData.data_pubblicazione_graduatoria, formData.data_decreto_concessione,
      formData.data_avvio_progetto, bandoSelezionato, templateScadenze])

  // Effetto separato per caricare documenti quando il bando è disponibile (per nuovi progetti)
  useEffect(() => {
    if (!progetto && formData.bando_id) {
      console.log('📋 Caricando documenti per bando:', formData.bando_id)
      loadDocumenti('')
    }
  }, [formData.bando_id, progetto])

  const loadBandi = async () => {
    try {
      const { data, error } = await supabase
        .from('scadenze_bandi_bandi_view')
        .select('id, nome, codice_bando, contributo_massimo, percentuale_contributo, tipologia_bando, data_pubblicazione_graduatoria')
        .order('nome')

      if (error) throw error
      setBandi(data || [])
    } catch (error) {
      console.error('❌ Errore caricamento bandi dettagliato:', error.message, error.details, error.hint)
    }
  }

  const loadBandoConTemplate = async (bandoId: string) => {
    try {
      console.log('📋 Caricando dati completi per bando:', bandoId)

      // Carica bando con tutti i dati necessari
      const { data: bandoData, error: bandoError } = await supabase
        .from('scadenze_bandi_bandi_view')
        .select('id, nome, data_pubblicazione_graduatoria, contributo_massimo, percentuale_contributo')
        .eq('id', bandoId)
        .single()

      if (bandoError) {
        console.error('❌ Errore caricamento bando dettagliato:', bandoError.message, bandoError.details, bandoError.hint)
        throw bandoError
      }

      console.log('📋 Dati bando caricati:', bandoData)
      setBandoSelezionato(bandoData)

      // Se il bando ha una data_pubblicazione_graduatoria e il form non l'ha ancora, ereditala
      if (bandoData.data_pubblicazione_graduatoria && !formData.data_pubblicazione_graduatoria) {
        console.log('📅 Ereditando data pubblicazione graduatoria dal bando:', bandoData.data_pubblicazione_graduatoria)
        setFormData(prev => ({
          ...prev,
          data_pubblicazione_graduatoria: bandoData.data_pubblicazione_graduatoria.split('T')[0]
        }))
      }

      // Carica template scadenze del bando
      const { data: templates, error: templatesError } = await supabase
        .from('scadenze_bandi_template_scadenze')
        .select('*')
        .eq('bando_id', bandoId)
        .order('ordine_sequenza')

      if (templatesError) {
        console.error('Errore caricamento template (non bloccante):', templatesError)
        // Non lanciamo l'errore perché i template potrebbero non esistere
      }

      console.log('📋 Template scadenze caricati:', templates?.length || 0, 'template')
      console.log('📋 Template completi:', templates)
      setTemplateScadenze(templates || [])
    } catch (error) {
      console.error('Errore caricamento bando e template:', error)
    }
  }

  // Calcola scadenze in anteprima basandosi sui template e date inserite
  const calcolaScadenzeAnteprima = () => {
    if (!bandoSelezionato || !templateScadenze || templateScadenze.length === 0) return []

    // Sistema universale basato sui template del bando
    const scadenzeCalcolate = []

    for (const template of templateScadenze) {
      let dataRiferimento = null
      let eventoNome = ''

      // Determina la data di riferimento
      if (template.evento_riferimento === 'pubblicazione_graduatoria') {
        dataRiferimento = formData.data_pubblicazione_graduatoria || bandoSelezionato.data_pubblicazione_graduatoria
        eventoNome = 'Pubblicazione Graduatoria'
      } else if (template.evento_riferimento === 'decreto_concessione') {
        dataRiferimento = formData.data_decreto_concessione
        eventoNome = 'Decreto Concessione'
      } else if (template.evento_riferimento === 'avvio_progetto') {
        dataRiferimento = formData.data_avvio_progetto
        eventoNome = 'Avvio Progetto'
      }

      // Se non abbiamo la data specifica, usa pubblicazione graduatoria come fallback
      if (!dataRiferimento) {
        dataRiferimento = formData.data_pubblicazione_graduatoria || bandoSelezionato.data_pubblicazione_graduatoria
        eventoNome = 'Pubblicazione Graduatoria (fallback)'
      }

      if (dataRiferimento) {
        const dataRif = new Date(dataRiferimento)
        const dataScadenza = new Date(dataRif)
        dataScadenza.setDate(dataScadenza.getDate() + (template.giorni_da_evento || 0))

        scadenzeCalcolate.push({
          nome: template.nome || template.nome_scadenza,
          dataScadenza: dataScadenza.toLocaleDateString('it-IT'),
          calcolabile: true,
          priorita: template.priorita || 'media',
          giorni_da_evento: `+${template.giorni_da_evento || 0}`,
          evento_riferimento: eventoNome,
          dataRiferimentoUsata: dataRif.toLocaleDateString('it-IT')
        })
      } else {
        scadenzeCalcolate.push({
          nome: template.nome || template.nome_scadenza,
          dataScadenza: '',
          calcolabile: false,
          priorita: template.priorita || 'media',
          giorni_da_evento: `+${template.giorni_da_evento || 0}`,
          evento_riferimento: template.evento_riferimento || 'N/D',
          dataRiferimentoUsata: ''
        })
      }
    }

    return scadenzeCalcolate
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

  const generateCodiceProgetto = async () => {
    try {
      const { data, error } = await supabase
        .from('scadenze_bandi_progetti')
        .select('codice_progetto')
        .order('created_at', { ascending: false })
        .limit(1)

      if (error) throw error

      let nuovoNumero = 1
      if (data && data.length > 0) {
        const ultimoCodice = data[0].codice_progetto
        const match = ultimoCodice?.match(/PRJ-(\d{4})-(\d{3})/)
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
      const nuovoCodice = `PRJ-${anno}-${numeroFormattato}`

      setFormData(prev => ({ ...prev, codice_progetto: nuovoCodice }))
    } catch (error) {
      console.error('Errore generazione codice:', error)
      const anno = new Date().getFullYear()
      const fallbackCodice = `PRJ-${anno}-001`
      setFormData(prev => ({ ...prev, codice_progetto: fallbackCodice }))
    }
  }

  // Funzione per caricare scadenze salvate
  const loadScadenze = async (progettoId: string) => {
    try {
      const { data, error } = await supabase
        .from('scadenze_bandi_scadenze')
        .select(`
          id,
          titolo,
          data_scadenza,
          stato,
          priorita,
          responsabile_email,
          note,
          progetto_id,
          bando_id,
          cliente_id
        `)
        .eq('progetto_id', progettoId)
        .order('data_scadenza')

      if (error) throw error
      console.log('📅 Scadenze salvate caricate:', data?.length || 0, 'per progetto:', progettoId)
      setScadenzeSalvate(data || [])
    } catch (error) {
      console.error('❌ Errore caricamento scadenze:', error)
    }
  }

  const handleBandoChange = (bandoId: string) => {
    const selectedBando = bandi.find(b => b.id === bandoId)
    console.log('DEBUG - handleBandoChange:', {
      bandoId,
      selectedBando,
      data_pubblicazione_graduatoria: selectedBando?.data_pubblicazione_graduatoria
    })

    if (selectedBando) {
      const dataEredirata = selectedBando.data_pubblicazione_graduatoria ?
        selectedBando.data_pubblicazione_graduatoria.split('T')[0] : ''

      console.log('DEBUG - Ereditando data pubblicazione:', dataEredirata)

      setFormData(prev => ({
        ...prev,
        bando_id: bandoId,
        titolo_progetto: `Progetto ${selectedBando.nome}`,
        contributo_ammesso: selectedBando.contributo_massimo,
        percentuale_contributo: selectedBando.percentuale_contributo,
        // Eredita la data pubblicazione graduatoria dal bando
        data_pubblicazione_graduatoria: dataEredirata
      }))
    }
  }

  const handleImportoChange = (importo: number) => {
    const contributo = Math.round(importo * (formData.percentuale_contributo / 100))
    setFormData(prev => ({
      ...prev,
      importo_totale_progetto: importo,
      contributo_ammesso: contributo
    }))
  }

  const handlePercentualeChange = (percentuale: number) => {
    const contributo = Math.round(formData.importo_totale_progetto * (percentuale / 100))
    setFormData(prev => ({
      ...prev,
      percentuale_contributo: percentuale,
      contributo_ammesso: contributo
    }))
  }

  const handleSave = async () => {
    if (!formData.bando_id || !formData.cliente_id || !formData.titolo_progetto) {
      alert('Bando, Cliente e Titolo progetto sono obbligatori')
      return
    }

    setLoading(true)
    try {
      // Prepara dati per salvataggio
      const dataToSave = { ...formData }

      // DEBUG: Verifica cosa stiamo salvando
      console.log('🔍 DEBUG - Form data prima del save:', {
        data_pubblicazione_graduatoria: formData.data_pubblicazione_graduatoria,
        bando_id: formData.bando_id,
        cliente_id: formData.cliente_id,
        bandoSelezionato: bandoSelezionato?.data_pubblicazione_graduatoria,
        bando_prop: bando?.data_pubblicazione_graduatoria
      })
      console.log('🔍 DEBUG - Data to save structure completa:', JSON.stringify(dataToSave, null, 2))

      // Gestisci date vuote - se non presenti, le rimuoviamo dal payload
      if (!dataToSave.data_pubblicazione_graduatoria) delete dataToSave.data_pubblicazione_graduatoria
      if (!dataToSave.data_decreto_concessione) delete dataToSave.data_decreto_concessione
      if (!dataToSave.scadenza_accettazione_esiti) delete dataToSave.scadenza_accettazione_esiti
      if (!dataToSave.data_avvio_progetto) delete dataToSave.data_avvio_progetto
      if (!dataToSave.data_fine_progetto_prevista) delete dataToSave.data_fine_progetto_prevista

      // Gestisci campi numerici
      if (!dataToSave.importo_totale_progetto) dataToSave.importo_totale_progetto = 0
      if (!dataToSave.contributo_ammesso) dataToSave.contributo_ammesso = 0
      if (!dataToSave.percentuale_contributo) dataToSave.percentuale_contributo = 0
      if (!dataToSave.percentuale_anticipo) dataToSave.percentuale_anticipo = 30

      let progettoId: string

      if (progetto?.id) {
        // Modifica progetto esistente
        console.log('Aggiornando progetto esistente con ID:', progetto.id)
        const { error: progettoError } = await supabase
          .from('scadenze_bandi_progetti')
          .update(dataToSave)
          .eq('id', progetto.id)

        if (progettoError) {
          console.error('Errore aggiornamento progetto:', progettoError)
          throw progettoError
        }
        progettoId = progetto.id
      } else {
        // Inserisci nuovo progetto
        console.log('Inserendo nuovo progetto...')
        const { data: progettoData, error: progettoError } = await supabase
          .from('scadenze_bandi_progetti')
          .insert([dataToSave])
          .select()
          .single()

        if (progettoError) {
          console.error('Errore inserimento progetto:', {
            message: progettoError.message,
            details: progettoError.details,
            hint: progettoError.hint,
            code: progettoError.code,
            dataToSave
          })
          throw progettoError
        }

        console.log('Progetto inserito con successo:', progettoData)
        progettoId = progettoData.id

        // NUOVO: Copia tutti i documenti dal bucket del bando al bucket del progetto
        try {
          console.log('📄 Copiando documenti dal bando al progetto...')

          // Lista tutti i file nel bucket del bando
          const { data: bandoFiles, error: listError } = await supabase.storage
            .from('bandi-documenti')
            .list(formData.bando_id)

          if (listError) {
            console.warn('⚠️ Errore nel listare documenti del bando:', listError)
          } else if (bandoFiles && bandoFiles.length > 0) {
            console.log(`📋 Trovati ${bandoFiles.length} documenti nel bando`)

            for (const file of bandoFiles) {
              try {
                // Scarica il file dal bucket del bando
                const { data: fileData, error: downloadError } = await supabase.storage
                  .from('bandi-documenti')
                  .download(`${formData.bando_id}/${file.name}`)

                if (downloadError) {
                  console.error(`❌ Errore download ${file.name}:`, downloadError)
                  continue
                }

                // Upload nel bucket del progetto
                const { error: uploadError } = await supabase.storage
                  .from('progetti-documenti')
                  .upload(`${progettoId}/${file.name}`, fileData, {
                    contentType: file.metadata?.mimetype || 'application/octet-stream',
                    cacheControl: '3600',
                    upsert: true
                  })

                if (uploadError) {
                  console.error(`❌ Errore upload ${file.name} nel progetto:`, uploadError)
                } else {
                  console.log(`✅ Copiato documento: ${file.name}`)
                }
              } catch (copyError) {
                console.error(`❌ Errore copia documento ${file.name}:`, copyError)
              }
            }

            console.log('✅ Copia documenti dal bando completata')
          } else {
            console.log('📋 Nessun documento trovato nel bando')
          }
        } catch (copyDocsError) {
          console.error('❌ Errore generale nella copia documenti:', copyDocsError)
          // Non bloccare la creazione del progetto se la copia fallisce
        }
      }

      // Genera scadenze automatiche dal template del bando (solo per nuovi progetti)
      if (!progetto?.id) {
        console.log('🔄 Verifica condizioni per generazione scadenze:', {
          isNewProject: !progetto?.id,
          hasDataPubblicazione: !!formData.data_pubblicazione_graduatoria,
          dataPubblicazione: formData.data_pubblicazione_graduatoria,
          bandoId: formData.bando_id
        })

        console.log('🔍 DEBUG - Controllo data per generazione scadenze:', {
          'formData.data_pubblicazione_graduatoria': formData.data_pubblicazione_graduatoria,
          'bandoSelezionato?.data_pubblicazione_graduatoria': bandoSelezionato?.data_pubblicazione_graduatoria,
          'entrambi presenti': !!(formData.data_pubblicazione_graduatoria || bandoSelezionato?.data_pubblicazione_graduatoria)
        })

        if (formData.data_pubblicazione_graduatoria || bandoSelezionato?.data_pubblicazione_graduatoria) {
          const dataToUse = formData.data_pubblicazione_graduatoria || bandoSelezionato?.data_pubblicazione_graduatoria
          console.log('✅ Generando scadenze per nuovo progetto con data pubblicazione:', dataToUse)
          await generateScadenzeFromTemplate(progettoId, formData.bando_id)
          // Carica le scadenze appena create per mostrarle subito
          await loadScadenze(progettoId)
        } else {
          console.log('⚠️ Nessuna data_pubblicazione_graduatoria trovata per generare scadenze automatiche')
        }
      } else {
        console.log('⏸️ Skip generazione scadenze - progetto esistente in modifica')
      }

      onProgettoCreated()
      onClose()
    } catch (error: any) {
      console.error('Errore salvataggio progetto:', error)
      alert(`Errore nel salvataggio: ${error.message || 'Errore sconosciuto'}`)
    } finally {
      setLoading(false)
    }
  }

  const generateScadenzeFromTemplate = async (progettoId: string, bandoId: string) => {
    try {
      console.log('🔄 Generando scadenze automatiche per progetto:', progettoId, 'da bando:', bandoId)

      // Carica i template di scadenze del bando
      const { data: templates, error: templatesError } = await supabase
        .from('scadenze_bandi_template_scadenze')
        .select('*')
        .eq('bando_id', bandoId)
        .order('ordine_sequenza')

      if (templatesError) {
        console.error('❌ Errore caricamento template nella generateScadenzeFromTemplate:', templatesError)
        throw templatesError
      }

      console.log('📋 Template trovati per generazione scadenze:', templates?.length || 0)
      console.log('📋 Template dettaglio:', templates)

      if (!templates || templates.length === 0) {
        console.log('⚠️ Nessun template di scadenze trovato per il bando:', bandoId)
        return
      }

      // Carica le informazioni del bando
      const { data: bandoData, error: bandoError } = await supabase
        .from('scadenze_bandi_bandi_view')
        .select('data_pubblicazione_graduatoria, nome')
        .eq('id', bandoId)
        .single()

      if (bandoError) throw bandoError

      // Debug delle date disponibili
      console.log('🔍 Debug date disponibili:')
      console.log('  - formData.data_pubblicazione_graduatoria:', formData.data_pubblicazione_graduatoria)
      console.log('  - bandoData.data_pubblicazione_graduatoria:', bandoData?.data_pubblicazione_graduatoria)
      console.log('  - bandoData completo:', bandoData)

      // Usa i template del bando se disponibili
      if (templates && templates.length > 0) {
        console.log(`📋 Usando ${templates.length} template del bando per generare scadenze`)
        const scadenzeToInsert = []

        for (const template of templates) {
          console.log('🔄 Processando template:', template)
          let dataScadenza = null

          // Calcola la data in base all'evento di riferimento del template
          let dataRiferimento = null

          // Determina la data di riferimento in base al tipo di evento
          if (template.evento_riferimento === 'pubblicazione_graduatoria') {
            dataRiferimento = formData.data_pubblicazione_graduatoria || bandoData?.data_pubblicazione_graduatoria
          } else if (template.evento_riferimento === 'decreto_concessione') {
            dataRiferimento = formData.data_decreto_concessione
          } else if (template.evento_riferimento === 'avvio_progetto') {
            dataRiferimento = formData.data_avvio_progetto
          }

          // Se non abbiamo trovato una data specifica, usa data_pubblicazione_graduatoria come fallback
          if (!dataRiferimento) {
            console.log(`⚠️ Evento "${template.evento_riferimento}" non disponibile per template "${template.nome}", uso data_pubblicazione_graduatoria come fallback`)
            dataRiferimento = formData.data_pubblicazione_graduatoria || bandoData?.data_pubblicazione_graduatoria
          }

          if (dataRiferimento) {
            const dataRif = new Date(dataRiferimento)
            console.log('📅 Data di riferimento trovata:', dataRif, 'per template:', template.nome)

            dataScadenza = new Date(dataRif)
            // Usa giorni_da_evento dalla struttura reale del template
            dataScadenza.setDate(dataScadenza.getDate() + (template.giorni_da_evento || 0))
            console.log('📅 Scadenza calcolata:', dataScadenza.toISOString().split('T')[0])
          } else {
            console.log(`⚠️ Nessuna data di riferimento disponibile per template "${template.nome}"`)
          }

          // Se abbiamo una data calcolata, aggiungi la scadenza
          if (dataScadenza) {
            scadenzeToInsert.push({
              progetto_id: progettoId,
              bando_id: bandoId,
              cliente_id: formData.cliente_id,
              titolo: template.nome || template.nome_scadenza,
              data_scadenza: dataScadenza.toISOString(),
              stato: 'non_iniziata',
              priorita: template.priorita || 'media',
              responsabile_email: template.responsabile_suggerito || 'amministrativo@blm.it',
              note: `${template.descrizione} - Generata automaticamente da template`,
              giorni_preavviso: [30, 15, 7, 1]
            })
            console.log(`✅ Scadenza "${template.nome || template.nome_scadenza}" calcolata per: ${dataScadenza.toISOString().split('T')[0]}`)
          } else {
            console.log(`⚠️ Impossibile calcolare scadenza "${template.nome || template.nome_scadenza}" - data di riferimento mancante per evento: ${template.evento_riferimento}`)
          }
        }

        // Inserisci le scadenze generate
        if (scadenzeToInsert.length > 0) {
          console.log('📝 Inserendo scadenze:', JSON.stringify(scadenzeToInsert, null, 2))

          const { error: insertError } = await supabase
            .from('scadenze_bandi_scadenze')
            .insert(scadenzeToInsert)

          if (insertError) {
            console.error('❌ Errore specifico inserimento scadenze:', insertError)
            throw insertError
          }
          console.log(`✅ Generate ${scadenzeToInsert.length} scadenze automatiche per progetto ${progettoId}`)
        } else {
          console.log('⚠️ Nessuna scadenza da inserire (nessun template applicabile con dati disponibili)')
        }
      } else {
        console.log('⚠️ Nessun template di scadenze configurato per questo bando')
      }
    } catch (error) {
      console.error('❌ Errore generazione scadenze:', error)
      console.error('❌ Dettagli errore:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        fullError: error
      })
      // Non bloccare il salvataggio del progetto se le scadenze falliscono
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0
    }).format(amount)
  }

  // Funzioni per gestione documenti
  const loadDocumenti = async (progettoId: string) => {
    try {
      let ereditati = []
      let propri = []

      // Solo per progetti esistenti, carica documenti dal database
      if (progettoId) {
        const { data, error } = await supabase
          .from('scadenze_bandi_documenti_progetto_view')
          .select('*')
          .eq('progetto_id', progettoId)
          .order('created_at', { ascending: false })

        if (error) throw error

        // Separa documenti ereditati da documenti propri
        ereditati = data?.filter(doc => doc.categoria === 'ereditato') || []
        propri = data?.filter(doc => doc.categoria !== 'ereditato') || []
      }

      // Aggiungi template documents multipli da localStorage se disponibili
      const bandoIdToCheck = progetto?.bando_id || formData.bando_id || bando?.id || bandoSelezionato?.id
      console.log('🔍 DEBUG: Controllo template multipli per bando ID:', bandoIdToCheck, {
        progetto_bando_id: progetto?.bando_id,
        formData_bando_id: formData.bando_id,
        bando_prop_id: bando?.id,
        bandoSelezionato_id: bandoSelezionato?.id
      })

      if (bandoIdToCheck) {
        // Carica lista template multipli
        const templatesListKey = `templates_list_${bandoIdToCheck}`
        const templatesListData = localStorage.getItem(templatesListKey)

        if (templatesListData) {
          try {
            const templatesList = JSON.parse(templatesListData)
            console.log('📋 Template multipli trovati per bando:', bandoIdToCheck, templatesList.length)

            // Carica ogni template dalla sua chiave specifica
            for (const templateRef of templatesList) {
              const templateData = localStorage.getItem(`template_${templateRef.template_id}`)
              if (templateData) {
                const parsedTemplate = JSON.parse(templateData)

                // Crea un documento virtuale per ogni template
                const templateDocument = {
                  id: templateRef.template_id,
                  nome_file: parsedTemplate.file_name,
                  categoria: 'template_ereditato',
                  formato_file: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                  descrizione: `Template salvato il ${new Date(parsedTemplate.saved_at).toLocaleDateString('it-IT')} - ${templateRef.placeholders_count} placeholder`,
                  caricato_da: 'TEMPLATE_EDITOR',
                  created_at: parsedTemplate.saved_at || new Date().toISOString(),
                  auto_compilazione_completata: false,
                  auto_compilazione_status: 'Template pronto per compilazione',
                  template_data: parsedTemplate // Include i dati completi per l'auto-compilazione
                }

                ereditati.push(templateDocument)
                console.log('📋 Template multiplo aggiunto:', templateDocument.nome_file)
              }
            }

            console.log('✅ Caricati', ereditati.length, 'template per bando:', bandoIdToCheck)
          } catch (parseError) {
            console.error('Errore parsing templates multipli:', parseError)
          }
        } else {
          // Fallback: usa sistema vecchio per compatibilità
          const templateKey = `template_${bandoIdToCheck}`
          const templateData = localStorage.getItem(templateKey)

          if (templateData) {
            try {
              const parsedTemplate = JSON.parse(templateData)
              console.log('📋 Template singolo (compatibilità) trovato per bando:', bandoIdToCheck, parsedTemplate.file_name)

              const templateDocument = {
                id: `template_${bandoIdToCheck}`,
                nome_file: parsedTemplate.file_name,
                categoria: 'template_ereditato',
                formato_file: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                descrizione: 'Template salvato nell\'editor del bando, pronto per auto-compilazione',
                caricato_da: 'TEMPLATE_EDITOR',
                created_at: parsedTemplate.saved_at || new Date().toISOString(),
                auto_compilazione_completata: false,
                auto_compilazione_status: 'Template pronto per compilazione',
                template_data: parsedTemplate
              }

              ereditati.push(templateDocument)
            } catch (parseError) {
              console.error('Errore parsing template compatibility:', parseError)
            }
          }
        }
      }

      console.log('📋 Setting documenti ereditati:', ereditati.length, 'documenti')
      console.log('📋 Documenti ereditati completi:', ereditati)
      setDocumentiEreditati(ereditati)
      setDocumenti(propri)
    } catch (error) {
      console.error('Errore caricamento documenti progetto:', error)
    }
  }

  const handleFileUpload = async (files: FileList, categoria: 'proprio' | 'compilato' = 'proprio') => {
    if (!files.length || !progetto?.id) {
      alert('Salva prima il progetto, poi potrai caricare i documenti')
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
        const filePath = `${progetto.id}/${fileKey}`

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('progetti-documenti')
          .upload(filePath, file)

        if (uploadError) throw uploadError

        setUploadProgress(prev => ({ ...prev, [fileName]: 50 }))

        // Determina tipo documento dal nome file
        let tipoDocumento = 'documento_generico'
        if (fileName.toLowerCase().includes('decreto')) tipoDocumento = 'decreto_concessione'
        else if (fileName.toLowerCase().includes('sal')) tipoDocumento = 'sal'
        else if (fileName.toLowerCase().includes('rendicont')) tipoDocumento = 'rendicontazione'
        else if (fileName.toLowerCase().includes('accettaz')) tipoDocumento = 'accettazione_esiti'

        // Salva record nel database
        const { data: docData, error: docError } = await supabase
          .from('scadenze_bandi_documenti_progetto')
          .insert({
            progetto_id: progetto.id,
            nome_file: fileName,
            nome_originale: fileName,
            tipo_documento: tipoDocumento,
            categoria: categoria,
            formato_file: file.type,
            dimensione_bytes: file.size,
            url_file: filePath,
            descrizione: `Documento caricato il ${new Date().toLocaleDateString('it-IT')}`,
            caricato_da: 'UTENTE'
          })
          .select()
          .single()

        if (docError) throw docError

        setUploadProgress(prev => ({ ...prev, [fileName]: 100 }))

        // Aggiorna lista documenti
        setDocumenti(prev => [docData, ...prev])

      } catch (error: any) {
        console.error('Errore upload documento progetto:', error)
        alert(`Errore caricando ${fileName}: ${error.message || 'Errore sconosciuto'}`)
      }
    }

    setUploading(false)
    setUploadProgress({})
  }

  const downloadDocument = async (urlPath: string, fileName: string) => {
    try {
      console.log('📥 Scaricamento documento:', fileName, 'da:', urlPath)

      // Ottieni URL firmato per il download
      const { data, error } = await supabase.storage
        .from('progetti-documenti')
        .download(urlPath)

      if (error) {
        console.error('❌ Errore download:', error)
        alert(`Errore durante il download: ${error.message}`)
        return
      }

      // Crea URL temporaneo per il download
      const blob = new Blob([data])
      const url = URL.createObjectURL(blob)

      // Crea link temporaneo e avvia download
      const link = document.createElement('a')
      link.href = url
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Pulisce URL temporaneo
      URL.revokeObjectURL(url)

      console.log('✅ Download completato:', fileName)

    } catch (error: any) {
      console.error('❌ Errore download documento:', error)
      alert(`Errore durante il download: ${error.message || 'Errore sconosciuto'}`)
    }
  }

  const autoCompileDocument = async (documentId: string) => {
    if (!progetto?.id) return

    // Previeni invocazioni multiple
    if (uploading) {
      console.log('⚠️ Auto-compilazione già in corso, ignorando richiesta per:', documentId)
      return
    }

    try {
      setUploading(true)

      console.log('🚀 Avvio autocompilazione per documento specifico:', documentId)
      console.log('📋 Documenti ereditati disponibili:', documentiEreditati.map(d => ({ id: d.id, nome: d.nome_file })))

      // STEP 1: Trova il documento dal bucket del progetto (contiene già i placeholder)
      const docToCompile = documentiEreditati.find(doc => doc.id === documentId)
      console.log('📄 Documento da compilare trovato:', docToCompile ? docToCompile.nome_file : 'NON TROVATO')

      if (!docToCompile) {
        alert('Documento non trovato nella lista ereditati.')
        return
      }

      // NUOVO: Scarica il documento Word dal bucket del progetto (contiene già i placeholder)
      let documentWordBuffer: Uint8Array

      try {
        console.log('📄 Scaricando documento Word dal bucket progetti-documenti...')

        // Il nome del file dovrebbe essere il template del bando
        const fileName = docToCompile.nome_file
        const filePath = `${progetto.id}/${fileName}`

        console.log('🔍 DEBUG: Tentativo download file:', {
          bucket: 'progetti-documenti',
          filePath: filePath,
          progettoId: progetto.id,
          fileName: fileName,
          docToCompile: docToCompile
        })

        const { data: fileData, error: downloadError } = await supabase.storage
          .from('progetti-documenti')
          .download(filePath)

        if (downloadError) {
          console.error('❌ Errore download documento dal bucket:', downloadError)
          console.error('❌ Dettagli errore:', {
            message: downloadError.message,
            details: downloadError.details,
            hint: downloadError.hint,
            code: downloadError.code
          })
          throw new Error('Documento non trovato nel bucket del progetto')
        }

        documentWordBuffer = new Uint8Array(await fileData.arrayBuffer())
        console.log('✅ Documento Word scaricato dal bucket:', documentWordBuffer.length, 'bytes')

      } catch (bucketError) {
        console.warn('⚠️ Fallback al metodo database:', bucketError)

        // Fallback: usa il metodo vecchio se il documento non è nel bucket
        if (!docToCompile.template_data?.original_docx_base64) {
          alert('⚠️ Documento non trovato né nel bucket né nel database. Ricrea il template nel BANDO.')
          return
        }

        // Converti da base64 a buffer
        documentWordBuffer = Uint8Array.from(atob(docToCompile.template_data.original_docx_base64), c => c.charCodeAt(0))
        console.log('📄 Usando documento dal database (fallback)')
      }

      // STEP 2: Carica dati completi del cliente
      const { data: clienteCompleto, error: clienteError } = await supabase
        .from('scadenze_bandi_clienti')
        .select('*')
        .eq('id', formData.cliente_id)
        .single()

      if (clienteError) throw clienteError

      console.log('👤 Dati cliente caricati:', clienteCompleto.denominazione)

      // STEP 3: Prepara dati progetto
      const progettoData = { ...formData }

      // STEP 4: Compila direttamente il documento Word (che ha già i placeholder dal bucket)
      console.log('📝 Compilazione documento Word mantenendo formattazione originale...')

      // Prepara tutti i dati disponibili (come nell'API)
      const allData = {
        // Dati sistema
        DATA_ODIERNA: new Date().toLocaleDateString('it-IT'),
        DATA_COMPILAZIONE: new Date().toLocaleString('it-IT'),

        // Dati cliente (normalizzati in maiuscolo)
        DENOMINAZIONE: clienteCompleto?.denominazione || clienteCompleto?.DENOMINAZIONE_AZIENDA || '',
        PARTITA_IVA: clienteCompleto?.partita_iva || clienteCompleto?.PARTITA_IVA || '',
        CODICE_FISCALE: clienteCompleto?.codice_fiscale || clienteCompleto?.CODICE_FISCALE || '',
        EMAIL: clienteCompleto?.email || clienteCompleto?.EMAIL_AZIENDA || '',
        PEC: clienteCompleto?.pec || clienteCompleto?.PEC_AZIENDA || '',
        TELEFONO: clienteCompleto?.telefono || clienteCompleto?.TELEFONO_AZIENDA || '',
        SITO_WEB: clienteCompleto?.sito_web || clienteCompleto?.SITO_WEB || 'www.blmproject.com',

        // Legale rappresentante
        LEGALE_RAPPRESENTANTE_NOME: clienteCompleto?.legale_rappresentante_nome || clienteCompleto?.LEGALE_RAPPRESENTANTE_NOME || '',
        LEGALE_RAPPRESENTANTE_COGNOME: clienteCompleto?.legale_rappresentante_cognome || clienteCompleto?.LEGALE_RAPPRESENTANTE_COGNOME || '',
        LEGALE_RAPPRESENTANTE_CF: clienteCompleto?.legale_rappresentante_codice_fiscale || clienteCompleto?.LEGALE_RAPPRESENTANTE_CF || '',

        // Dati progetto se disponibili
        TITOLO_PROGETTO: progettoData?.titolo_progetto || '',
        CODICE_PROGETTO: progettoData?.codice_progetto || '',
        CONTRIBUTO_AMMESSO: progettoData?.contributo_ammesso ? String(progettoData.contributo_ammesso) : '',

        // Include tutti i dati originali
        ...(clienteCompleto || {}),
        ...(progettoData || {})
      }

      // Usa il documento Word scaricato dal bucket (contiene già i placeholder)
      const originalDocxBuffer = documentWordBuffer

      // Carica il documento con PizZip
      const zip = new PizZip(originalDocxBuffer)

      // Crea istanza di Docxtemplater
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
      })

      // DEBUG: Verifica placeholder nel documento originale
      const originalText = doc.getFullText()
      console.log('📄 Contenuto documento ORIGINALE (primi 1000 caratteri):', originalText.substring(0, 1000))

      // Cerca placeholder nel formato {PLACEHOLDER}
      const foundPlaceholders = originalText.match(/\{[A-Z_]+\}/g)
      if (foundPlaceholders && foundPlaceholders.length > 0) {
        console.log('✅ Placeholder trovati nel documento originale:', foundPlaceholders)
        console.log('📊 Numero placeholder nel documento:', foundPlaceholders.length)
      } else {
        console.warn('⚠️ PROBLEMA: Nessun placeholder {PLACEHOLDER} trovato nel documento originale!')
        console.warn('🔍 Il documento deve contenere placeholder nel formato: {DENOMINAZIONE}, {PARTITA_IVA}, ecc.')

        // Cerca pattern alternativi
        const underscorePlaceholders = originalText.match(/_+/g)
        const squarePlaceholders = originalText.match(/\[[A-Z_\s]+\]/g)

        if (underscorePlaceholders) {
          console.log('🔍 Trovati underscore (possibili placeholder):', underscorePlaceholders.slice(0, 10))
        }
        if (squarePlaceholders) {
          console.log('🔍 Trovati placeholder con parentesi quadre:', squarePlaceholders.slice(0, 10))
        }
      }

      // DEBUG: Log dei dati disponibili
      console.log('📋 Dati cliente completi:', clienteCompleto)
      console.log('📋 Dati progetto:', progettoData)
      console.log('📋 AllData creato:', allData)

      // Prepara i dati per sostituire i placeholder nel formato {PLACEHOLDER}
      const docxData = {}
      for (const [key, value] of Object.entries(allData)) {
        if (value !== null && value !== undefined && value !== '') {
          // Docxtemplater usa {KEY} invece di [KEY]
          docxData[key.toUpperCase()] = String(value)
        }
      }

      console.log('🔄 Sostituendo placeholder nel documento Word originale...')
      console.log('📊 Dati per sostituzione:', Object.keys(docxData).length, 'chiavi')
      console.log('📊 Chiavi disponibili:', Object.keys(docxData))
      console.log('📊 Valori per sostituzione:', docxData)

      // Sostituisci i placeholder (API aggiornata)
      console.log('🔄 Prima di doc.render() - esempio dati:', {
        DENOMINAZIONE: docxData.DENOMINAZIONE,
        PARTITA_IVA: docxData.PARTITA_IVA,
        CODICE_PROGETTO: docxData.CODICE_PROGETTO
      })

      try {
        doc.render(docxData)
        console.log('✅ doc.render() completato senza errori')

        // Verifica se Docxtemplater ha trovato placeholder
        const info = doc.getFullText()
        console.log('📄 Contenuto documento dopo render (primi 500 caratteri):', info.substring(0, 500))

        // Cerca ancora placeholder non sostituiti
        const remainingPlaceholders = info.match(/\{[A-Z_]+\}/g)
        if (remainingPlaceholders) {
          console.warn('⚠️ Placeholder non sostituiti trovati nel documento:', remainingPlaceholders)
        } else {
          console.log('✅ Nessun placeholder residuo trovato')
        }
      } catch (renderError) {
        console.error('❌ Errore durante doc.render():', renderError)
        throw renderError
      }

      let buffer: Uint8Array

      try {
        // STEP 6: Genera il buffer del documento Word compilato (successo)
        buffer = doc.getZip().generate({
          type: 'uint8array',
          compression: 'DEFLATE',
        })

        console.log('✅ Documento compilato con formattazione originale preservata')

      } catch (error: any) {
        console.error('❌ Errore nella renderizzazione template:', error)

        // Se fallisce con Docxtemplater, usa il fallback
        console.log('⚠️ Fallback: usando creazione documento semplificato...')

        // Nel nuovo flusso non abbiamo più compiled_html, creiamo un documento semplice
        const simpleDoc = new Document({
          sections: [{
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Documento Compilato - ${docToCompile.nome_file}`,
                    font: 'Calibri',
                    size: 28,
                    bold: true,
                  })
                ],
                alignment: AlignmentType.CENTER,
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: htmlContent.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' '),
                    font: 'Calibri',
                    size: 22,
                  })
                ],
              }),
            ],
          }],
        })

        buffer = await Packer.toBuffer(simpleDoc)
        console.log('✅ Documento creato con fallback (formattazione semplificata)')
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const fileName = `COMPILATO_${docToCompile.nome_file.replace(/\.(docx|doc|html|txt)$/i, '')}_${timestamp}.docx`

      console.log('📤 Upload documento Word con formattazione originale...')

      // Crea blob Word (prova prima con MIME type Word specifico)
      let wordBlob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      })

      let uploadError = null
      let uploadResult = null

      // Prova prima con MIME type Word
      try {
        const result = await supabase.storage
          .from('progetti-documenti')
          .upload(`${progetto.id}/${fileName}`, wordBlob, {
            contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            cacheControl: '3600',
            upsert: true
          })
        uploadError = result.error
        uploadResult = result
      } catch (error) {
        console.log('⚠️ MIME type Word non supportato, provo con text/plain...')

        // Fallback: usa text/plain che sappiamo funziona
        wordBlob = new Blob([buffer], {
          type: 'text/plain'
        })

        const result = await supabase.storage
          .from('progetti-documenti')
          .upload(`${progetto.id}/${fileName}`, wordBlob, {
            contentType: 'text/plain',
            cacheControl: '3600',
            upsert: true
          })
        uploadError = result.error
        uploadResult = result
      }

      if (uploadError) {
        throw new Error(`Errore upload: ${uploadError.message}`)
      }

      console.log('✅ Documento caricato con successo!')

      // STEP 7: Aggiorna database con il nuovo documento
      const formatoFile = wordBlob.type === 'text/plain'
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : wordBlob.type

      const { data: docData, error: docError } = await supabase
        .from('scadenze_bandi_documenti_progetto')
        .insert([{
          progetto_id: progetto.id,
          nome_file: fileName,
          nome_originale: fileName,
          tipo_documento: 'documento_compilato',
          categoria: 'compilato',
          formato_file: formatoFile,
          dimensione_bytes: wordBlob.size,
          url_file: `${progetto.id}/${fileName}`,
          descrizione: `Documento compilato automaticamente da template: ${docToCompile.nome_file}`,
          caricato_da: 'SISTEMA_AUTOCOMPILAZIONE',
          auto_compilazione_completata: true,
          auto_compilazione_status: `✅ Compilato automaticamente dal bucket progetti-documenti`
        }])
        .select()
        .single()

      if (docError) throw docError

      console.log('✅ Database aggiornato con nuovo documento')

      // STEP 8: Ricarica documenti per mostrare il nuovo file
      await loadDocumenti(progetto.id)

      // STEP 9: Notifica utente
      let alertMessage = `🎉 Template compilato con successo!\n\n📄 File: ${fileName}\n📊 Documento compilato dal bucket progetti-documenti\n`

      if (foundPlaceholders && foundPlaceholders.length > 0) {
        alertMessage += `✅ Placeholder Word trovati: ${foundPlaceholders.length}\n`
        alertMessage += `✅ Documento compilato mantenendo formattazione originale\n`
      } else {
        alertMessage += `⚠️ PROBLEMA: Il documento Word non contiene placeholder {PLACEHOLDER}\n`
        alertMessage += `🔧 SOLUZIONE: Usa l'editor del bando per aggiungere placeholder:\n`
        alertMessage += `   1. Apri l'editor template del bando\n`
        alertMessage += `   2. Inserisci placeholder dal pannello laterale\n`
        alertMessage += `   3. Salva nuovamente il template\n`
      }

      alertMessage += `\nIl documento compilato è disponibile nella sezione documenti.`

      alert(alertMessage)

    } catch (error: any) {
      console.error('❌ Errore autocompilazione template:', error)
      alert(`❌ Errore: ${error.message}`)
    } finally {
      setUploading(false)
    }
  }

  const deleteDocument = async (docId: string, urlFile: string) => {
    try {
      // Rimuovi da storage
      const { error: storageError } = await supabase.storage
        .from('progetti-documenti')
        .remove([urlFile])

      if (storageError) throw storageError

      // Rimuovi dal database
      const { error: dbError } = await supabase
        .from('scadenze_bandi_documenti_progetto')
        .delete()
        .eq('id', docId)

      if (dbError) throw dbError

      // Aggiorna lista
      setDocumenti(prev => prev.filter(doc => doc.id !== docId))
    } catch (error: any) {
      console.error('Errore eliminazione documento:', error)
      alert(`Errore eliminando documento: ${error.message}`)
    }
  }
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full h-full max-h-[95vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {progetto ? 'Modifica Progetto' : 'Nuovo Progetto'}
            </h2>
            <p className="text-gray-600">
              {bando ? `Progetto per: ${bando.nome}` : 'Compila i dettagli del progetto'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('generale')}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'generale'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Generale
              </button>
              <button
                onClick={() => setActiveTab('importi')}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'importi'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Importi
              </button>
              <button
                onClick={() => setActiveTab('scadenze')}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'scadenze'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Scadenze
              </button>
              <button
                onClick={() => setActiveTab('documenti')}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'documenti'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Documenti
              </button>
              <button
                onClick={() => setActiveTab('avanzate')}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'avanzate'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Avanzate
              </button>
            </nav>
          </div>

          {/* Form Content */}
          <div className="mt-4">
            {activeTab === 'generale' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bando *
                    </label>
                    <select
                      value={formData.bando_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, bando_id: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                      disabled={!!bando}
                    >
                      <option value="">Seleziona bando</option>
                      {bandi.map(bandoItem => (
                        <option key={bandoItem.id} value={bandoItem.id}>
                          {bandoItem.nome}
                        </option>
                      ))}
                    </select>
                    {bando && (
                      <p className="text-sm text-blue-600 mt-1">
                        Bando preselezionato: {bando.nome}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cliente *
                    </label>
                    <select
                      value={formData.cliente_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, cliente_id: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    >
                      <option value="">Seleziona cliente</option>
                      {clienti.map(cliente => (
                        <option key={cliente.id} value={cliente.id}>
                          {cliente.denominazione}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Titolo Progetto *
                  </label>
                  <input
                    type="text"
                    value={formData.titolo_progetto}
                    onChange={(e) => setFormData(prev => ({ ...prev, titolo_progetto: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrizione Progetto
                  </label>
                  <textarea
                    value={formData.descrizione_progetto}
                    onChange={(e) => setFormData(prev => ({ ...prev, descrizione_progetto: e.target.value }))}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stato Progetto
                  </label>
                  <select
                    value={formData.stato}
                    onChange={(e) => setFormData(prev => ({ ...prev, stato: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
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
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Importo Totale Progetto (€)
                    </label>
                    <input
                      type="number"
                      value={formData.importo_totale_progetto}
                      onChange={(e) => setFormData(prev => ({ ...prev, importo_totale_progetto: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Contributo Ammesso (€)
                    </label>
                    <input
                      type="number"
                      value={formData.contributo_ammesso}
                      onChange={(e) => setFormData(prev => ({ ...prev, contributo_ammesso: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Percentuale Contributo (%)
                  </label>
                  <input
                    type="number"
                    value={formData.percentuale_contributo}
                    onChange={(e) => setFormData(prev => ({ ...prev, percentuale_contributo: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    min="0"
                    max="100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.anticipo_richiedibile}
                      onChange={(e) => setFormData(prev => ({ ...prev, anticipo_richiedibile: e.target.checked }))}
                      className="mr-2"
                    />
                    <label className="text-sm font-medium text-gray-700">
                      Anticipo Richiedibile
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Percentuale Anticipo (%)
                    </label>
                    <input
                      type="number"
                      value={formData.percentuale_anticipo}
                      onChange={(e) => setFormData(prev => ({ ...prev, percentuale_anticipo: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      min="0"
                      max="100"
                      disabled={!formData.anticipo_richiedibile}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Numero SAL
                  </label>
                  <select
                    value={formData.numero_sal}
                    onChange={(e) => setFormData(prev => ({ ...prev, numero_sal: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="UNICO">Unico</option>
                    <option value="DUE">Due SAL</option>
                    <option value="TRE">Tre SAL</option>
                  </select>
                </div>
              </div>
            )}

            {/* Placeholder per altre tabs */}
            {activeTab === 'scadenze' && (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">Scadenze generate da template</h4>
                  <p className="text-sm text-blue-700">
                    Le scadenze verranno generate automaticamente in base al bando selezionato e alle date del progetto.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data Pubblicazione Graduatoria
                    </label>
                    <input
                      type="date"
                      value={formData.data_pubblicazione_graduatoria}
                      onChange={(e) => setFormData(prev => ({ ...prev, data_pubblicazione_graduatoria: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data Decreto Concessione
                    </label>
                    <input
                      type="date"
                      value={formData.data_decreto_concessione}
                      onChange={(e) => setFormData(prev => ({ ...prev, data_decreto_concessione: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Scadenza Accettazione Esiti
                    </label>
                    <input
                      type="date"
                      value={formData.scadenza_accettazione_esiti}
                      onChange={(e) => setFormData(prev => ({ ...prev, scadenza_accettazione_esiti: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Data Avvio Progetto
                    </label>
                    <input
                      type="date"
                      value={formData.data_avvio_progetto}
                      onChange={(e) => setFormData(prev => ({ ...prev, data_avvio_progetto: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data Fine Progetto Prevista
                  </label>
                  <input
                    type="date"
                    value={formData.data_fine_progetto_prevista}
                    onChange={(e) => setFormData(prev => ({ ...prev, data_fine_progetto_prevista: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                {/* Anteprima Scadenze Calcolate */}
                {(() => {
                  const scadenzeCalcolate = calcolaScadenzeAnteprima()
                  return scadenzeCalcolate.length > 0 && (
                    <div className="mt-6">
                      <h5 className="font-medium text-gray-900 mb-3">
                        🗓️ Anteprima Scadenze Calcolate ({scadenzeCalcolate.length})
                      </h5>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="space-y-3">
                          {scadenzeCalcolate.map((scadenza, index) => (
                            <div
                              key={index}
                              className={`flex justify-between items-start p-3 rounded-lg border ${
                                scadenza.calcolabile
                                  ? 'bg-white border-green-300'
                                  : 'bg-yellow-50 border-yellow-300'
                              }`}
                            >
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">{scadenza.nome}</div>
                                <div className="text-sm text-gray-600 mt-1">
                                  Riferimento: {scadenza.evento_riferimento}
                                  {scadenza.dataRiferimentoUsata && ` (${scadenza.dataRiferimentoUsata})`}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {scadenza.giorni_da_evento} giorni dall'evento di riferimento
                                </div>
                              </div>
                              <div className="text-right">
                                {scadenza.calcolabile ? (
                                  <div className="text-lg font-bold text-green-700">
                                    {scadenza.dataScadenza}
                                  </div>
                                ) : (
                                  <div className="text-sm text-yellow-700 bg-yellow-100 px-2 py-1 rounded">
                                    Data non disponibile
                                  </div>
                                )}
                                <div className={`text-xs mt-1 px-2 py-1 rounded ${
                                  scadenza.priorita === 'alta'
                                    ? 'bg-red-100 text-red-700'
                                    : scadenza.priorita === 'media'
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-gray-100 text-gray-700'
                                }`}>
                                  {scadenza.priorita}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {scadenzeCalcolate.some(s => !s.calcolabile) && (
                          <div className="mt-4 p-3 bg-yellow-100 border border-yellow-300 rounded-lg">
                            <div className="text-sm text-yellow-800">
                              <strong>⚠️ Nota:</strong> Alcune scadenze non possono essere calcolate perché mancano le date di riferimento necessarie.
                              Compila le date richieste per visualizzare tutte le scadenze.
                            </div>
                          </div>
                        )}

                        <div className="mt-4 p-3 bg-blue-100 border border-blue-300 rounded-lg">
                          <div className="text-sm text-blue-800">
                            <strong>💡 Informazione:</strong> {progetto?.id ? 'Queste scadenze sono state generate automaticamente.' : 'Queste scadenze verranno generate automaticamente quando salvi il progetto.'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })()}


                {/* Template Information (solo se non ci sono scadenze calcolate) */}
                {templateScadenze.length > 0 && calcolaScadenzeAnteprima().length === 0 && (
                  <div className="mt-6">
                    <h5 className="font-medium text-gray-900 mb-3">Template Scadenze del Bando</h5>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="space-y-2">
                        {templateScadenze.map((template, index) => (
                          <div key={template.id || index} className="flex justify-between items-center text-sm">
                            <span className="font-medium">{template.nome}</span>
                            <span className="text-gray-500">
                              {template.giorni_da_evento} {template.unita_tempo || 'giorni'} da {template.evento_riferimento}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 p-3 bg-blue-100 border border-blue-200 rounded">
                        <div className="text-sm text-blue-800">
                          Inserisci almeno la "Data Pubblicazione Graduatoria" per vedere l'anteprima delle scadenze calcolate.
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'documenti' && (
              <div className="space-y-6">
                {/* Documenti Ereditati */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Documenti Ereditati dal Bando ({documentiEreditati.length})
                  </h4>
                  {console.log('🎨 RENDER: documentiEreditati.length =', documentiEreditati.length)}
                  {console.log('🎨 RENDER: documentiEreditati =', documentiEreditati)}

                  {documentiEreditati.length > 0 ? (
                    <div className="space-y-2">
                      {documentiEreditati.map((documento) => (
                        <div key={documento.id} className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-center gap-3">
                            <FileText className="w-4 h-4 text-blue-600" />
                            <span className="font-medium text-blue-900">{documento.nome_file}</span>
                            <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                              {documento.categoria}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {progetto?.id && (
                              <button
                                onClick={() => autoCompileDocument(documento.id)}
                                disabled={uploading}
                                className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-xs rounded-md hover:bg-green-700 disabled:opacity-50"
                                title="Auto-compilazione con sistema template"
                              >
                                🤖 Auto
                              </button>
                            )}
                            <button
                              onClick={() => downloadDocument(documento.url_file, documento.nome_file)}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              Scarica
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                      Nessun documento ereditato dal bando
                    </div>
                  )}
                </div>

                {/* Documenti Propri del Progetto */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Documenti del Progetto
                  </h4>

                  {documenti.length > 0 ? (
                    <div className="space-y-2">
                      {documenti.map((documento) => (
                        <div key={documento.id} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
                          <div className="flex items-center gap-3">
                            <FileText className="w-4 h-4 text-gray-600" />
                            <span className="font-medium">{documento.nome_file}</span>
                            <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                              {documento.categoria}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => downloadDocument(documento.url_file, documento.nome_file)}
                              className="text-blue-600 hover:text-blue-800 text-sm"
                            >
                              Scarica
                            </button>
                            <button
                              onClick={() => deleteDocument(documento.id, documento.url_file)}
                              className="text-red-600 hover:text-red-800 text-sm"
                            >
                              Elimina
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                      Nessun documento caricato per questo progetto
                    </div>
                  )}
                </div>

                {/* Upload Area */}
                {progetto?.id && (
                  <div>
                    <h5 className="font-medium text-gray-700 mb-3">Carica Nuovi Documenti</h5>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400">
                      <input
                        type="file"
                        multiple
                        onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                        className="hidden"
                        id="file-upload"
                      />
                      <label htmlFor="file-upload" className="cursor-pointer">
                        <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                        <div className="text-sm text-gray-600">
                          Clicca per selezionare i file da caricare
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                {/* Auto-Compilation Info */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h5 className="font-medium text-green-900 mb-2">🤖 Sistema Auto-Compilazione Template</h5>
                  <div className="text-sm text-green-700 space-y-1">
                    <p>• I documenti ereditati dal bando possono essere compilati automaticamente</p>
                    <p>• Il sistema usa i template configurati nella sezione BANDI</p>
                    <p>• Clicca "Auto" per avviare la compilazione con placeholder predefiniti</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'avanzate' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Referente Interno
                  </label>
                  <input
                    type="text"
                    value={formData.referente_interno}
                    onChange={(e) => setFormData(prev => ({ ...prev, referente_interno: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Referente Interno
                  </label>
                  <input
                    type="email"
                    value={formData.email_referente_interno}
                    onChange={(e) => setFormData(prev => ({ ...prev, email_referente_interno: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.proroga_richiedibile}
                    onChange={(e) => setFormData(prev => ({ ...prev, proroga_richiedibile: e.target.checked }))}
                    className="mr-2"
                  />
                  <label className="text-sm font-medium text-gray-700">
                    Proroga Richiedibile
                  </label>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4">
          <div className="text-sm text-gray-500">
            {formData.codice_progetto && (
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Codice: {formData.codice_progetto}
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
              className="px-4 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Salvataggio...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {progetto ? 'Aggiorna Progetto' : 'Crea Progetto'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
