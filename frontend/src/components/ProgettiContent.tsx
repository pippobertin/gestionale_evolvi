'use client'

import React, { useState, useEffect } from 'react'
import { Search, Plus, Filter, Calendar, Euro, Building, FileText, Clock, CheckCircle, AlertTriangle, Eye, Upload, Edit, Trash2, CheckSquare, Square } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import ProgettoForm from './ProgettoForm'

interface Progetto {
  id: string
  codice_progetto: string
  titolo_progetto: string
  descrizione_progetto: string
  stato: string
  stato_calcolato: string
  importo_totale_progetto: number
  contributo_ammesso: number
  percentuale_contributo: number
  data_decreto_concessione: string
  scadenza_accettazione_esiti: string
  data_effettiva_accettazione_esiti: string
  data_avvio_progetto: string
  data_fine_progetto_prevista: string
  anticipo_richiedibile: boolean
  percentuale_anticipo: number
  scadenza_richiesta_anticipo: string
  data_effettiva_richiesta_anticipo: string
  numero_sal: 'UNICO' | 'DUE' | 'TRE'
  scadenza_rendicontazione_finale: string
  referente_interno: string
  email_referente_interno: string
  note_progetto: string
  bando_nome: string
  codice_bando: string
  ente_erogatore: string
  cliente_denominazione: string
  cliente_email: string
  cliente_piva: string
  giorni_ad_accettazione: number
  giorni_a_richiesta_anticipo: number
  giorni_a_rendicontazione: number
  scadenze_totali: number
  scadenze_attive: number
  documenti_caricati: number
  percentuale_completamento: number
  created_at: string
  updated_at: string
}

export default function ProgettiContent() {
  const [progetti, setProgetti] = useState<Progetto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [filtroStato, setFiltroStato] = useState<string>('tutti')
  const [filtroEnte, setFiltroEnte] = useState<string>('tutti')
  const [selectedProgetto, setSelectedProgetto] = useState<Progetto | null>(null)
  const [showNewProgettoModal, setShowNewProgettoModal] = useState(false)
  const [progettoInModifica, setProgettoInModifica] = useState<Progetto | null>(null)
  const [selectedProgettiForDelete, setSelectedProgettiForDelete] = useState<Set<string>>(new Set())
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [progettoToDelete, setProgettoToDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Funzione per generare scadenze mancanti per progetti esistenti
  const generaScadenzeProgetto = async (progettoId: string) => {
    try {
      // Ottieni i dettagli del progetto dalla vista
      const { data: progettoData, error: progettoError } = await supabase
        .from('scadenze_bandi_progetti_view')
        .select('*')
        .eq('id', progettoId)
        .single()

      if (progettoError || !progettoData) {
        console.error('Errore nel caricamento progetto per generazione scadenze:', progettoError)
        return
      }

      // Ottieni il template del bando
      let { data: templateData, error: templateError } = await supabase
        .from('scadenze_bandi_template')
        .select('*')
        .eq('bando_id', progettoData.bando_id)

      // La tabella scadenze_bandi_template non esiste ancora nel database
      console.log(`Skipping template check - tabella template non ancora implementata nel database`)
      return

      // Prepara le date di riferimento dal progetto esistente
      const dateRiferimento: Record<string, Date> = {}

      if (progettoData.data_decreto_concessione) {
        dateRiferimento['decreto_concessione'] = new Date(progettoData.data_decreto_concessione)
      }
      if (progettoData.data_effettiva_accettazione_esiti) {
        dateRiferimento['accettazione_esiti'] = new Date(progettoData.data_effettiva_accettazione_esiti)
      }
      if (progettoData.data_avvio_progetto) {
        dateRiferimento['avvio_progetto'] = new Date(progettoData.data_avvio_progetto)
      }
      if (progettoData.data_fine_progetto_prevista) {
        dateRiferimento['conclusione_progetto'] = new Date(progettoData.data_fine_progetto_prevista)
      }

      // Genera le scadenze usando il template
      for (const template of templateData) {
        const eventoRif = template.evento_riferimento
        if (!dateRiferimento[eventoRif]) {
          console.log(`Data di riferimento '${eventoRif}' non disponibile per il progetto, skip scadenza`)
          continue
        }

        const dataRiferimento = new Date(dateRiferimento[eventoRif])
        const dataScadenza = new Date(dataRiferimento)
        dataScadenza.setDate(dataScadenza.getDate() + template.giorni_offset)

        // Crea la scadenza
        const { error: scadenzaError } = await supabase
          .from('scadenze_bandi_scadenze')
          .insert({
            progetto_id: progettoId,
            titolo_scadenza: template.titolo_scadenza,
            descrizione_scadenza: template.descrizione_scadenza,
            data_scadenza: dataScadenza.toISOString().split('T')[0],
            tipo_scadenza: template.tipo_scadenza,
            priorita: template.priorita,
            giorni_preavviso: template.giorni_preavviso,
            stato: 'in_attesa',
            evento_riferimento: template.evento_riferimento,
            giorni_offset: template.giorni_offset,
            data_riferimento: dataRiferimento.toISOString().split('T')[0]
          })

        if (scadenzaError) {
          console.error('Errore nella creazione scadenza:', scadenzaError)
        }
      }

    } catch (error) {
      console.error('Errore nella generazione scadenze progetto:', error)
    }
  }

  // Funzione per creare template di default per bandi senza template
  const creaTemplateDefault = async (bandoId: string, bandoNome: string) => {
    try {
      const templatesDefault = []

      // Template comune: Richiesta Proroga (30 giorni prima della conclusione)
      templatesDefault.push({
        bando_id: bandoId,
        titolo_scadenza: 'Richiesta Proroga',
        descrizione_scadenza: 'Termine per richiedere eventuali proroghe del progetto',
        tipo_scadenza: 'amministrativa',
        evento_riferimento: 'conclusione_progetto',
        giorni_offset: -30,
        priorita: 'alta',
        giorni_preavviso: 7
      })

      // Template comune: Rendicontazione Finale (30 giorni dopo la conclusione)
      templatesDefault.push({
        bando_id: bandoId,
        titolo_scadenza: 'Rendicontazione Finale',
        descrizione_scadenza: 'Termine per presentare la rendicontazione finale del progetto',
        tipo_scadenza: 'rendicontazione',
        evento_riferimento: 'conclusione_progetto',
        giorni_offset: 30,
        priorita: 'critica',
        giorni_preavviso: 15
      })

      // Template comune: Richiesta Anticipo (entro 30 giorni dall\'avvio)
      templatesDefault.push({
        bando_id: bandoId,
        titolo_scadenza: 'Richiesta Anticipo',
        descrizione_scadenza: 'Termine per richiedere l\'anticipo del contributo',
        tipo_scadenza: 'finanziaria',
        evento_riferimento: 'avvio_progetto',
        giorni_offset: 30,
        priorita: 'media',
        giorni_preavviso: 7
      })

      console.log(`Creando ${templatesDefault.length} template di default per il bando ${bandoNome}`)

      const { error } = await supabase
        .from('scadenze_bandi_template')
        .insert(templatesDefault)

      if (error) {
        console.error('Errore nella creazione template di default:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
          fullError: error
        })
      } else {
        console.log(`Template di default creati per il bando ${bandoNome}`)
      }

    } catch (error) {
      console.error('Errore nella creazione template di default:', error)
    }
  }

  // Carica progetti
  useEffect(() => {
    fetchProgetti()
  }, [])

  const fetchProgetti = async () => {
    try {
      setLoading(true)

      // Prima ottieni tutti i progetti dalla vista
      const { data: progettiData, error: progettiError } = await supabase
        .from('scadenze_bandi_progetti_view')
        .select('*')
        .order('created_at', { ascending: false })

      if (progettiError) throw progettiError

      // Poi aggiorna il conteggio scadenze per ogni progetto
      const progettiWithScadenze = await Promise.all(
        (progettiData || []).map(async (progetto) => {
          // Conta scadenze totali per questo progetto
          const { count: scadenzeTotali, error: errorTotali } = await supabase
            .from('scadenze_bandi_scadenze')
            .select('*', { count: 'exact', head: true })
            .eq('progetto_id', progetto.id)

          // Conta scadenze attive (non completate e con data futura o oggi)
          const oggi = new Date().toISOString().split('T')[0]
          const { count: scadenzeAttive, error: errorAttive } = await supabase
            .from('scadenze_bandi_scadenze')
            .select('*', { count: 'exact', head: true })
            .eq('progetto_id', progetto.id)
            .neq('stato', 'completata')
            .gte('data_scadenza', oggi)

          // Per ora disabilitiamo l'auto-generazione fino a quando il database non ha la tabella template
          // if (scadenzeTotali === 0) {
          //   await generaScadenzeProgetto(progetto.id)
          // }

          return {
            ...progetto,
            scadenze_totali: scadenzeTotali || 0,
            scadenze_attive: scadenzeAttive || 0
          }
        })
      )

      setProgetti(progettiWithScadenze)
    } catch (err: any) {
      console.error('Errore nel caricamento progetti:', err)
      setError('Errore nel caricamento dei progetti')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteProgetto = (progettoId: string) => {
    setProgettoToDelete(progettoId)
    setShowDeleteConfirm(true)
  }

  const handleBulkDelete = () => {
    if (selectedProgettiForDelete.size > 0) {
      setShowDeleteConfirm(true)
    }
  }

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      const progettiIds = progettoToDelete ? [progettoToDelete] : Array.from(selectedProgettiForDelete)

      console.log('Eliminando progetti:', progettiIds)

      // Per ogni progetto, elimina prima le scadenze collegate
      for (const progettoId of progettiIds) {
        const { error: scadenzeError } = await supabase
          .from('scadenze_bandi_scadenze')
          .delete()
          .eq('progetto_id', progettoId)

        if (scadenzeError) {
          console.error('Errore eliminazione scadenze:', scadenzeError)
          // Non lanciamo l'errore perché le scadenze potrebbero non esistere
        }
      }

      // Ora elimina i progetti
      const { error: progettiError } = await supabase
        .from('scadenze_bandi_progetti')
        .delete()
        .in('id', progettiIds)

      if (progettiError) {
        console.error('Errore eliminazione progetti:', progettiError)
        throw progettiError
      }

      // Reset stati
      if (progettoToDelete) {
        setProgettoToDelete(null)
      } else {
        setSelectedProgettiForDelete(new Set())
        setIsSelectMode(false)
      }

      setShowDeleteConfirm(false)
      fetchProgetti() // Ricarica la lista

      console.log(`✅ Eliminati con successo ${progettiIds.length} progetti e relative scadenze`)
    } catch (error: any) {
      console.error('Errore nell\'eliminazione:', error)
      alert(`Errore: ${error.message || 'Impossibile eliminare il progetto'}`)
    } finally {
      setDeleting(false)
    }
  }

  const toggleSelectProgetto = (progettoId: string) => {
    const newSelected = new Set(selectedProgettiForDelete)
    if (newSelected.has(progettoId)) {
      newSelected.delete(progettoId)
    } else {
      newSelected.add(progettoId)
    }
    setSelectedProgettiForDelete(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedProgettiForDelete.size === progettiFiltrati.length) {
      setSelectedProgettiForDelete(new Set())
    } else {
      setSelectedProgettiForDelete(new Set(progettiFiltrati.map(p => p.id)))
    }
  }

  // Filtra progetti
  const progettiFiltrati = progetti.filter(progetto => {
    if (searchTerm && !progetto.titolo_progetto?.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !progetto.codice_progetto?.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !progetto.cliente_denominazione?.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false
    }
    if (filtroStato !== 'tutti' && progetto.stato_calcolato !== filtroStato) {
      return false
    }
    if (filtroEnte !== 'tutti' && progetto.ente_erogatore !== filtroEnte) {
      return false
    }
    return true
  })

  // Raggruppa progetti per stato
  const progettiDecretoAtteso = progettiFiltrati.filter(p => p.stato_calcolato === 'DECRETO_ATTESO')
  const progettiDecretoRicevuto = progettiFiltrati.filter(p => p.stato_calcolato === 'DECRETO_RICEVUTO')
  const progettiInCorso = progettiFiltrati.filter(p => p.stato_calcolato === 'IN_CORSO')
  const progettiCompletati = progettiFiltrati.filter(p => p.stato_calcolato === 'COMPLETATO')

  // Enti unici per filtro
  const entiErogatori = [...new Set(progetti.map(p => p.ente_erogatore).filter(Boolean))]

  const getStatoColor = (stato: string) => {
    switch (stato) {
      case 'DECRETO_ATTESO': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'DECRETO_RICEVUTO': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'ACCETTATO': return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'IN_CORSO': return 'bg-green-100 text-green-800 border-green-200'
      case 'COMPLETATO': return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'SOSPESO': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'ANNULLATO': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-600 border-gray-200'
    }
  }

  const getProgressBarColor = (percentuale: number) => {
    if (percentuale >= 80) return 'bg-green-500'
    if (percentuale >= 50) return 'bg-blue-500'
    if (percentuale >= 30) return 'bg-yellow-500'
    return 'bg-gray-400'
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/D'
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const formatCurrency = (amount: number) => {
    if (!amount) return 'N/D'
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0
    }).format(amount)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Gestione Progetti</h1>
        <div className="flex items-center gap-3">
          {isSelectMode ? (
            <>
              {selectedProgettiForDelete.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Elimina ({selectedProgettiForDelete.size})
                </button>
              )}
              <button
                onClick={() => {
                  setIsSelectMode(false)
                  setSelectedProgettiForDelete(new Set())
                }}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg"
              >
                Annulla
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsSelectMode(true)}
                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <CheckSquare className="w-4 h-4" />
                Seleziona
              </button>
              <button
                onClick={() => setShowNewProgettoModal(true)}
                className="bg-primary-500 hover:bg-primary-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Nuovo Progetto
              </button>
            </>
          )}
        </div>
      </div>

      {/* Statistiche Rapide */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-600">Decreto Atteso</p>
              <p className="text-2xl font-bold text-yellow-900">{progettiDecretoAtteso.length}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-600" />
          </div>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">Decreto Ricevuto</p>
              <p className="text-2xl font-bold text-blue-900">{progettiDecretoRicevuto.length}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">In Corso</p>
              <p className="text-2xl font-bold text-green-900">{progettiInCorso.length}</p>
            </div>
            <Building className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Completati</p>
              <p className="text-2xl font-bold text-gray-900">{progettiCompletati.length}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-gray-600" />
          </div>
        </div>
      </div>

      {/* Filtri e Ricerca */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex gap-3 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Cerca progetto, codice, cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-80"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={filtroStato}
              onChange={(e) => setFiltroStato(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="tutti">Tutti gli stati</option>
              <option value="DECRETO_ATTESO">Decreto Atteso</option>
              <option value="DECRETO_RICEVUTO">Decreto Ricevuto</option>
              <option value="ACCETTATO">Accettato</option>
              <option value="IN_CORSO">In Corso</option>
              <option value="COMPLETATO">Completato</option>
              <option value="SOSPESO">Sospeso</option>
            </select>
          </div>

          <select
            value={filtroEnte}
            onChange={(e) => setFiltroEnte(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="tutti">Tutti gli enti</option>
            {entiErogatori.map(ente => (
              <option key={ente} value={ente}>{ente}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Lista Progetti */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {isSelectMode && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                    <button
                      onClick={toggleSelectAll}
                      className="text-gray-600 hover:text-gray-800"
                    >
                      {selectedProgettiForDelete.size === progettiFiltrati.length ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Progetto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bando
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Importi
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stato
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Progresso
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Scadenze
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Azioni
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {progettiFiltrati.map((progetto) => (
                <tr key={progetto.id} className="hover:bg-gray-50">
                  {isSelectMode && (
                    <td className="px-6 py-4 whitespace-nowrap w-12">
                      <button
                        onClick={() => toggleSelectProgetto(progetto.id)}
                        className="text-gray-600 hover:text-gray-800"
                      >
                        {selectedProgettiForDelete.has(progetto.id) ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {progetto.titolo_progetto || 'Titolo non specificato'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {progetto.codice_progetto}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm">
                      <div className="font-medium text-gray-900">{progetto.cliente_denominazione}</div>
                      <div className="text-gray-500">{progetto.cliente_piva}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm">
                      <div className="font-medium text-gray-900">{progetto.bando_nome}</div>
                      <div className="text-gray-500">{progetto.ente_erogatore}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm">
                      <div>Tot: <span className="font-medium">{formatCurrency(progetto.importo_totale_progetto)}</span></div>
                      <div className="text-green-600">Contr: {formatCurrency(progetto.contributo_ammesso)} ({progetto.percentuale_contributo}%)</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getStatoColor(progetto.stato_calcolato)}`}>
                      {progetto.stato_calcolato.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-full bg-gray-200 rounded-full h-2 mr-2">
                        <div
                          className={`h-2 rounded-full ${getProgressBarColor(progetto.percentuale_completamento)}`}
                          style={{ width: `${progetto.percentuale_completamento}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium text-gray-700">
                        {progetto.percentuale_completamento}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="text-sm">
                      <div className="font-medium">{progetto.scadenze_totali || 0}</div>
                      <div className={`text-xs ${progetto.scadenze_attive > 0 ? 'text-orange-600' : 'text-gray-500'}`}>
                        {progetto.scadenze_attive || 0} attive
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedProgetto(progetto)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Visualizza dettagli"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setProgettoInModifica(progetto)}
                        className="text-orange-600 hover:text-orange-900"
                        title="Modifica progetto"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        className="text-purple-600 hover:text-purple-900"
                        title="Carica documenti"
                      >
                        <Upload className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteProgetto(progetto.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Elimina progetto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {progettiFiltrati.length === 0 && (
          <div className="text-center py-12">
            <Building className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Nessun progetto trovato</h3>
            <p className="mt-1 text-sm text-gray-500">
              Non ci sono progetti che corrispondono ai filtri selezionati.
            </p>
          </div>
        )}
      </div>

      {/* Modal dettagli progetto */}
      {selectedProgetto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto m-4">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedProgetto.titolo_progetto}</h2>
                  <p className="text-gray-600">{selectedProgetto.codice_progetto}</p>
                </div>
                <button
                  onClick={() => setSelectedProgetto(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Colonna 1: Info Progetto */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Informazioni Progetto</h3>
                    <div className="space-y-2 text-sm">
                      <div><span className="font-medium">Stato:</span> {selectedProgetto.stato_calcolato}</div>
                      <div><span className="font-medium">Progresso:</span> {selectedProgetto.percentuale_completamento}%</div>
                      <div><span className="font-medium">Referente:</span> {selectedProgetto.referente_interno}</div>
                      <div><span className="font-medium">Email:</span> {selectedProgetto.email_referente_interno}</div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Importi</h3>
                    <div className="space-y-2 text-sm">
                      <div><span className="font-medium">Importo Totale:</span> {formatCurrency(selectedProgetto.importo_totale_progetto)}</div>
                      <div><span className="font-medium">Contributo Ammesso:</span> {formatCurrency(selectedProgetto.contributo_ammesso)}</div>
                      <div><span className="font-medium">% Contributo:</span> {selectedProgetto.percentuale_contributo}%</div>
                      {selectedProgetto.anticipo_richiedibile && (
                        <div><span className="font-medium">% Anticipo:</span> {selectedProgetto.percentuale_anticipo}%</div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Bando Collegato</h3>
                    <div className="space-y-2 text-sm">
                      <div><span className="font-medium">Nome:</span> {selectedProgetto.bando_nome}</div>
                      <div><span className="font-medium">Codice:</span> {selectedProgetto.codice_bando}</div>
                      <div><span className="font-medium">Ente:</span> {selectedProgetto.ente_erogatore}</div>
                    </div>
                  </div>
                </div>

                {/* Colonna 2: Date Critiche */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Date Critiche</h3>
                    <div className="space-y-2 text-sm">
                      <div><span className="font-medium">Decreto Concessione:</span> {formatDate(selectedProgetto.data_decreto_concessione)}</div>
                      <div>
                        <span className="font-medium">Scad. Accettazione:</span> {formatDate(selectedProgetto.scadenza_accettazione_esiti)}
                        {selectedProgetto.giorni_ad_accettazione !== null && selectedProgetto.giorni_ad_accettazione >= 0 && (
                          <span className="text-orange-600 ml-1">({selectedProgetto.giorni_ad_accettazione} gg)</span>
                        )}
                      </div>
                      <div><span className="font-medium">Accettazione Effettiva:</span> {formatDate(selectedProgetto.data_effettiva_accettazione_esiti)}</div>
                      <div><span className="font-medium">Avvio Progetto:</span> {formatDate(selectedProgetto.data_avvio_progetto)}</div>
                      <div><span className="font-medium">Fine Prevista:</span> {formatDate(selectedProgetto.data_fine_progetto_prevista)}</div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Anticipo & SAL</h3>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium">Scad. Richiesta Anticipo:</span> {formatDate(selectedProgetto.scadenza_richiesta_anticipo)}
                        {selectedProgetto.giorni_a_richiesta_anticipo !== null && selectedProgetto.giorni_a_richiesta_anticipo >= 0 && (
                          <span className="text-orange-600 ml-1">({selectedProgetto.giorni_a_richiesta_anticipo} gg)</span>
                        )}
                      </div>
                      <div><span className="font-medium">Richiesta Effettiva:</span> {formatDate(selectedProgetto.data_effettiva_richiesta_anticipo)}</div>
                      <div><span className="font-medium">Numero SAL:</span> {selectedProgetto.numero_sal}</div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Rendicontazione</h3>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium">Scad. Rendicontazione:</span> {formatDate(selectedProgetto.scadenza_rendicontazione_finale)}
                        {selectedProgetto.giorni_a_rendicontazione !== null && selectedProgetto.giorni_a_rendicontazione >= 0 && (
                          <span className="text-orange-600 ml-1">({selectedProgetto.giorni_a_rendicontazione} gg)</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Colonna 3: Cliente e Documenti */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Cliente</h3>
                    <div className="space-y-2 text-sm">
                      <div><span className="font-medium">Denominazione:</span> {selectedProgetto.cliente_denominazione}</div>
                      <div><span className="font-medium">P.IVA:</span> {selectedProgetto.cliente_piva}</div>
                      <div><span className="font-medium">Email:</span> {selectedProgetto.cliente_email}</div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Scadenze & Documenti</h3>
                    <div className="space-y-2 text-sm">
                      <div><span className="font-medium">Scadenze Totali:</span> {selectedProgetto.scadenze_totali}</div>
                      <div><span className="font-medium">Scadenze Attive:</span> {selectedProgetto.scadenze_attive}</div>
                      <div><span className="font-medium">Documenti Caricati:</span> {selectedProgetto.documenti_caricati}</div>
                    </div>
                  </div>

                  {selectedProgetto.note_progetto && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Note</h3>
                      <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                        {selectedProgetto.note_progetto}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {selectedProgetto.descrizione_progetto && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Descrizione Progetto</h3>
                  <p className="text-sm text-gray-600 bg-gray-50 p-4 rounded">
                    {selectedProgetto.descrizione_progetto}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Placeholder per modal nuovo progetto */}
      {showNewProgettoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Nuovo Progetto</h2>
            <p className="text-gray-600 mb-4">
              Form di creazione progetto sarà implementato nel prossimo step.
              <br />
              Include selezione bando vincente e cliente.
            </p>
            <button
              onClick={() => setShowNewProgettoModal(false)}
              className="bg-blue-600 text-white px-4 py-2 rounded"
            >
              Chiudi
            </button>
          </div>
        </div>
      )}

      {/* Modal modifica progetto */}
      {progettoInModifica && (
        <ProgettoForm
          onClose={() => setProgettoInModifica(null)}
          onProgettoCreated={() => {
            setProgettoInModifica(null)
            fetchProgetti() // Ricarica la lista
          }}
          progetto={progettoInModifica}
        />
      )}

      {/* Modal Conferma Eliminazione */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Conferma eliminazione
                  </h3>
                  <p className="text-gray-600">
                    {progettoToDelete
                      ? "Sei sicuro di voler eliminare questo progetto?"
                      : `Sei sicuro di voler eliminare ${selectedProgettiForDelete.size} progetti selezionati?`
                    }
                  </p>
                </div>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-yellow-800">
                  <strong>Attenzione:</strong> Questa operazione è irreversibile e eliminerà anche tutte le scadenze collegate.
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false)
                    setProgettoToDelete(null)
                  }}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  disabled={deleting}
                >
                  Annulla
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {deleting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Eliminando...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Elimina definitivamente
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}