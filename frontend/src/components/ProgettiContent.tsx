'use client'

import React, { useState, useEffect } from 'react'
import { Search, Plus, Filter, Calendar, Euro, Building, FileText, Clock, CheckCircle, AlertTriangle, Upload, Edit, Trash2, CheckSquare, Square } from 'lucide-react'
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

export default function ProgettiContent({ initialFilter, onNavigate }: { initialFilter?: string; onNavigate?: (page: string, params?: any) => void }) {
  const [progetti, setProgetti] = useState<Progetto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState(initialFilter || '')
  const [filtroStato, setFiltroStato] = useState<string>('tutti')
  const [filtroEnte, setFiltroEnte] = useState<string>('tutti')
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
      }

    } catch (error) {
      console.error('Errore nella creazione template di default:', error)
    }
  }

  // Carica progetti
  useEffect(() => {
    fetchProgetti()
  }, [])

  // Aggiorna il filtro di ricerca quando viene passato un filtro iniziale
  useEffect(() => {
    if (initialFilter) {
      setSearchTerm(initialFilter)
    }
  }, [initialFilter])

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

      // 🔥 PRIMO: Recupera TUTTI i dati dei progetti PRIMA di eliminarli
      console.log(`🔍 Pre-recupero dati per ${progettiIds.length} progetti prima dell'eliminazione`)
      const progettiDataMap = new Map()

      for (const progettoId of progettiIds) {
        console.log(`🔍 Pre-recupero dati progetto ID: ${progettoId}`)
        try {
          // Query semplificata per evitare problemi RLS (senza drive_folder_id che non esiste)
          const { data: progettoBase, error: baseError } = await supabase
            .from('scadenze_bandi_progetti')
            .select('titolo_progetto, bando_id')
            .eq('id', progettoId)
            .single()

          if (baseError) {
            console.error(`❌ Errore recupero progetto ${progettoId}:`, baseError)
            continue
          }

          if (!progettoBase) {
            console.warn(`⚠️ Progetto ${progettoId} non trovato`)
            continue
          }

          console.log(`📋 Dati progetto base pre-recuperati:`, progettoBase)

          // Recupera nome bando se disponibile
          let bandoNome = null
          if (progettoBase.bando_id) {
            const { data: bandoData } = await supabase
              .from('scadenze_bandi_bandi')
              .select('nome')
              .eq('id', progettoBase.bando_id)
              .single()

            bandoNome = bandoData?.nome || null
            console.log(`📋 Nome bando recuperato: ${bandoNome}`)
          }

          // Salva i dati nella mappa (senza drive_folder_id che non esiste nella DB)
          progettiDataMap.set(progettoId, {
            titolo_progetto: progettoBase.titolo_progetto,
            bando_nome: bandoNome
          })

          console.log(`✅ Dati progetto ${progettoId} salvati per eliminazione successiva`)
        } catch (error) {
          console.error(`❌ Errore pre-recupero progetto ${progettoId}:`, error)
        }
      }

      console.log(`📊 Pre-recuperati dati per ${progettiDataMap.size}/${progettiIds.length} progetti`)

      // 🔥 SECONDO: Ora procedi con le eliminazioni Google Drive
      for (const progettoId of progettiIds) {
        const progettoData = progettiDataMap.get(progettoId)

        if (!progettoData) {
          console.warn(`⚠️ Saltando eliminazione Drive per progetto ${progettoId} - dati non disponibili`)
          continue
        }

        console.log(`🗑️ Usando dati pre-recuperati per eliminazione Drive progetto: ${progettoData.titolo_progetto}`)

        // Elimina cartella Google Drive se esiste
        if (progettoData.titolo_progetto) {
          console.log(`🗑️ Tentativo eliminazione cartella Drive per progetto: ${progettoData.titolo_progetto}`)
          try {
            const driveResponse = await fetch('/api/drive/delete-progetto', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                bandoName: progettoData.bando_nome,
                progettoNome: progettoData.titolo_progetto,
                // Senza drive_folder_id - l'API cercherà per nome progetto
              })
            })

            if (driveResponse.ok) {
              console.log(`✅ Cartella Drive progetto "${progettoData.titolo_progetto}" eliminata con successo`)
            } else {
              const errorText = await driveResponse.text()
              console.warn(`⚠️ Impossibile eliminare cartella Drive progetto "${progettoData.titolo_progetto}":`, errorText)
            }
          } catch (driveError) {
            console.warn('⚠️ Errore eliminazione cartella Drive (continuo comunque):', driveError)
          }
        } else {
          console.log(`⚠️ Dati insufficienti per eliminazione Drive progetto ${progettoId}`)
        }

        // 1. Elimina le scadenze collegate al progetto
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

  const handleBandoClick = (bandoNome: string) => {
    if (onNavigate) {
      onNavigate('bandi', { filter: bandoNome })
    }
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
                className="bg-gradient-to-br from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white font-bold px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg"
              >
                <CheckSquare className="w-4 h-4" />
                Seleziona
              </button>
            </>
          )}
        </div>
      </div>

      {/* Statistiche Rapide */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-amber-500 to-yellow-500 p-4 rounded-xl border border-amber-400 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-white drop-shadow-sm">Decreto Atteso</p>
              <p className="text-2xl font-black text-white drop-shadow">{progettiDecretoAtteso.length}</p>
            </div>
            <Clock className="w-8 h-8 text-white drop-shadow" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-cyan-500 to-teal-500 p-4 rounded-xl border border-cyan-400 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-cyan-100 drop-shadow-sm">Decreto Ricevuto</p>
              <p className="text-2xl font-black text-white drop-shadow">{progettiDecretoRicevuto.length}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-cyan-200 drop-shadow" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-teal-500 p-4 rounded-xl border border-emerald-400 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-emerald-100 drop-shadow-sm">In Corso</p>
              <p className="text-2xl font-black text-white drop-shadow">{progettiInCorso.length}</p>
            </div>
            <Building className="w-8 h-8 text-emerald-200 drop-shadow" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 p-4 rounded-xl border border-red-400 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-red-100 drop-shadow-sm">Completati</p>
              <p className="text-2xl font-black text-white drop-shadow">{progettiCompletati.length}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-red-200 drop-shadow" />
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
        <div className="overflow-x-auto max-w-full">
          <table className="w-full divide-y divide-gray-200">
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
                  Scadenze
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {progettiFiltrati.map((progetto) => (
                <tr
                  key={progetto.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setProgettoInModifica(progetto)}
                >
                  {isSelectMode && (
                    <td
                      className="px-6 py-4 whitespace-nowrap w-12"
                      onClick={(e) => e.stopPropagation()}
                    >
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
                  <td className="px-1 py-2">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {progetto.titolo_progetto || 'Titolo non specificato'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {progetto.codice_progetto}
                      </div>
                    </div>
                  </td>
                  <td className="px-1 py-2">
                    <div className="text-sm">
                      <div className="font-medium text-gray-900">{progetto.cliente_denominazione}</div>
                      <div className="text-gray-500">{progetto.cliente_piva}</div>
                    </div>
                  </td>
                  <td
                    className="px-1 py-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="text-sm">
                      <button
                        onClick={() => handleBandoClick(progetto.bando_nome)}
                        className="font-medium text-blue-600 hover:text-blue-800 cursor-pointer transition-colors duration-150 text-left"
                        title="Vai al bando"
                      >
                        {progetto.bando_nome}
                      </button>
                      <div className="text-gray-500">{progetto.ente_erogatore}</div>
                    </div>
                  </td>
                  <td className="px-1 py-2">
                    <div className="text-sm">
                      <div>Tot: <span className="font-medium">{formatCurrency(progetto.importo_totale_progetto)}</span></div>
                      <div className="text-green-600">Contr: {formatCurrency(progetto.contributo_ammesso)} ({progetto.percentuale_contributo}%)</div>
                    </div>
                  </td>
                  <td className="px-1 py-2">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getStatoColor(progetto.stato_calcolato)}`}>
                      {progetto.stato_calcolato.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-1 py-2 text-center">
                    <div className="text-sm">
                      <div className="font-medium">{progetto.scadenze_totali || 0}</div>
                      <div className={`text-xs ${progetto.scadenze_attive > 0 ? 'text-orange-600' : 'text-gray-500'}`}>
                        {progetto.scadenze_attive || 0} attive
                      </div>
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



      {/* Modal modifica progetto */}
      {progettoInModifica && (
        <ProgettoForm
          onClose={() => setProgettoInModifica(null)}
          onProgettoCreated={() => {
            setProgettoInModifica(null)
            fetchProgetti() // Ricarica la lista
          }}
          onDelete={(progettoId) => {
            setProgettoInModifica(null)
            handleDeleteProgetto(progettoId)
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