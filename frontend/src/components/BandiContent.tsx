'use client'

import React, { useState, useEffect } from 'react'
import { Search, Plus, Filter, Calendar, Euro, Building, FileText, ExternalLink, Upload, Edit, Rocket, Trash2, CheckSquare, Square } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import BandoForm from './BandoForm'
import ProgettoForm from './ProgettoForm'

interface Bando {
  id: string
  codice_bando: string
  nome: string
  descrizione: string
  ente_erogatore: string
  tipologia_bando: string
  contributo_massimo: number
  budget_totale: number
  percentuale_contributo: number
  data_pubblicazione: string
  data_apertura_presentazione: string
  data_chiusura_presentazione: string
  tempo_valutazione_giorni: number
  tipo_valutazione: 'A_PUNTEGGIO' | 'JUST_IN_TIME'
  stato_bando: string
  stato_calcolato: string | null
  link_bando_ufficiale: string
  settori_ammessi: string[]
  dimensioni_aziendali_ammesse: string[]
  localizzazione_geografica: string
  note_interne: string
  referente_bando: string
  email_referente: string
  giorni_ad_apertura: number
  giorni_a_chiusura: number
  progetti_collegati: number
  progetti_attivi: number
  documenti_caricati: number
  created_at: string
  updated_at: string
}

export default function BandiContent({ initialFilter }: { initialFilter?: string } = {}) {
  const [bandi, setBandi] = useState<Bando[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState(initialFilter || '')
  const [filtroStato, setFiltroStato] = useState<string>('tutti')
  const [filtroTipo, setFiltroTipo] = useState<string>('tutti')
  const [showNewBandoModal, setShowNewBandoModal] = useState(false)
  const [showEditBandoModal, setShowEditBandoModal] = useState(false)
  const [showProgettoModal, setShowProgettoModal] = useState(false)
  const [editingBando, setEditingBando] = useState<Bando | null>(null)
  const [progettoFromBando, setProgettoFromBando] = useState<Bando | null>(null)
  const [selectedBandiForDelete, setSelectedBandiForDelete] = useState<Set<string>>(new Set())
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [bandoToDelete, setBandoToDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Carica bandi
  useEffect(() => {
    fetchBandi()
  }, [])

  // Aggiorna il filtro di ricerca quando viene passato un filtro iniziale
  useEffect(() => {
    if (initialFilter) {
      setSearchTerm(initialFilter)
    }
  }, [initialFilter])

  const fetchBandi = async () => {
    try {
      setLoading(true)

      // Prima ottieni tutti i bandi
      const { data: bandiData, error: bandiError } = await supabase
        .from('scadenze_bandi_bandi')
        .select('*')
        .order('data_chiusura_presentazione', { ascending: true })

      if (bandiError) throw bandiError

      // Poi aggiorna il conteggio progetti e calcola lo stato per ogni bando
      const bandiWithProgetti = await Promise.all(
        (bandiData || []).map(async (bando) => {
          // Conta progetti totali collegati a questo bando
          const { count: progettiCollegati, error: errorTotali } = await supabase
            .from('scadenze_bandi_progetti')
            .select('*', { count: 'exact', head: true })
            .eq('bando_id', bando.id)

          // Per semplicità, consideriamo tutti i progetti come attivi per ora
          // Finché non implementiamo correttamente la gestione degli stati progetti
          const progettiAttivi = progettiCollegati;

          // Debug: logga i risultati per vedere cosa succede
          console.log(`Bando ${bando.nome}: Progetti totali: ${progettiCollegati}, Progetti attivi: ${progettiAttivi}`)

          // Calcola lo stato automaticamente basato sulle date
          const oggi = new Date()
          const dataApertura = new Date(bando.data_apertura_presentazione)
          const dataChiusura = new Date(bando.data_chiusura_presentazione)

          let statoCalcolato: string
          if (oggi < dataApertura) {
            statoCalcolato = 'IN_ARRIVO'
          } else if (oggi >= dataApertura && oggi <= dataChiusura) {
            statoCalcolato = 'APERTO'
          } else {
            statoCalcolato = 'SCADUTO'
          }

          return {
            ...bando,
            progetti_collegati: progettiCollegati || 0,
            progetti_attivi: progettiAttivi || 0,
            stato_calcolato: statoCalcolato
          }
        })
      )

      setBandi(bandiWithProgetti)
    } catch (err: any) {
      console.error('Errore nel caricamento bandi:', err)
      setError('Errore nel caricamento dei bandi')
    } finally {
      setLoading(false)
    }
  }

  // Calcola le statistiche dei bandi basate sui nuovi stati
  const bandiAperti = bandi.filter(bando => bando.stato_calcolato === 'APERTO')
  const bandiInArrivo = bandi.filter(bando => bando.stato_calcolato === 'IN_ARRIVO')
  const bandiScaduti = bandi.filter(bando => bando.stato_calcolato === 'SCADUTO')
  const totalProgettiAttivi = bandi.reduce((sum, bando) => sum + (bando.progetti_attivi || 0), 0)

  // Filtra bandi
  const bandiFiltrati = bandi.filter(bando => {
    if (searchTerm && !bando.nome.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !bando.codice_bando?.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !bando.ente_erogatore?.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false
    }
    if (filtroStato !== 'tutti' && bando.stato_calcolato !== filtroStato) {
      return false
    }
    if (filtroTipo !== 'tutti' && bando.tipologia_bando !== filtroTipo) {
      return false
    }
    return true
  })


  // Tipi di bando unici per filtro
  const tipiBando = Array.from(new Set(bandi.map(b => b.tipologia_bando).filter(Boolean)))

  const getStatoColor = (stato: string | null | undefined) => {
    if (!stato) return 'bg-gray-100 text-gray-600 border-gray-200'

    switch (stato) {
      case 'APERTO': return 'bg-green-100 text-green-800 border-green-200'
      case 'IN_ARRIVO': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'SCADUTO': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-600 border-gray-200'
    }
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

  const handleBandoCreated = () => {
    fetchBandi() // Ricarica la lista bandi
    setShowNewBandoModal(false) // Chiude il modale
    setShowEditBandoModal(false) // Chiude anche il modale di modifica
  }

  const handleEditBando = (bando: Bando) => {
    setEditingBando(bando)
    setShowEditBandoModal(true)
  }

  const handleCreateProgetto = (bando: Bando) => {
    setProgettoFromBando(bando)
    setShowProgettoModal(true)
  }

  const handleProgettoCreated = () => {
    fetchBandi() // Ricarica per aggiornare contatori progetti
    setShowProgettoModal(false)
    setProgettoFromBando(null)
  }



  const handleDeleteBando = (bandoId: string) => {
    setBandoToDelete(bandoId)
    setShowDeleteConfirm(true)
  }

  const handleBulkDelete = () => {
    if (selectedBandiForDelete.size > 0) {
      setShowDeleteConfirm(true)
    }
  }

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      const bandiIds = bandoToDelete ? [bandoToDelete] : Array.from(selectedBandiForDelete)

      // Per ogni bando, elimina prima le cartelle Google Drive e poi i dati dal database
      for (const bandoId of bandiIds) {
        // 0. Recupera i dati del bando per eliminazione Drive
        const { data: bandoData } = await supabase
          .from('scadenze_bandi_bandi')
          .select('nome, drive_folder_id')
          .eq('id', bandoId)
          .single()

        // Elimina cartella Google Drive se esiste
        if (bandoData && (bandoData.drive_folder_id || bandoData.nome)) {
          try {
            const driveResponse = await fetch('/api/drive/delete-bando', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                bandoName: bandoData.nome,
                driveFolderId: bandoData.drive_folder_id
              })
            })

            if (driveResponse.ok) {
              console.log(`✅ Cartella Drive bando "${bandoData.nome}" eliminata`)
            } else {
              console.warn(`⚠️ Impossibile eliminare cartella Drive bando "${bandoData.nome}":`, await driveResponse.text())
            }
          } catch (driveError) {
            console.warn('⚠️ Errore eliminazione cartella Drive (continuo comunque):', driveError)
          }
        }
        // 1. Trova tutti i progetti collegati a questo bando
        const { data: progetti, error: progettiError } = await supabase
          .from('scadenze_bandi_progetti')
          .select('id')
          .eq('bando_id', bandoId)

        if (progettiError) {
          console.error('Errore nel trovare progetti collegati:', progettiError)
          throw progettiError
        }

        // 2. Per ogni progetto, elimina prima tutte le scadenze collegate
        for (const progetto of progetti || []) {
          const { error: scadenzeError } = await supabase
            .from('scadenze_bandi_scadenze')
            .delete()
            .eq('progetto_id', progetto.id)

          if (scadenzeError) {
            console.error('Errore eliminazione scadenze progetto:', scadenzeError)
            throw scadenzeError
          }
        }

        // 3. Elimina tutti i progetti collegati al bando
        if (progetti && progetti.length > 0) {
          const { error: deleteProgettiError } = await supabase
            .from('scadenze_bandi_progetti')
            .delete()
            .eq('bando_id', bandoId)

          if (deleteProgettiError) {
            console.error('Errore eliminazione progetti:', deleteProgettiError)
            throw deleteProgettiError
          }
        }

        // 4. Elimina i template di scadenze del bando
        const { error: templateError } = await supabase
          .from('scadenze_bandi_template_scadenze')
          .delete()
          .eq('bando_id', bandoId)

        if (templateError) {
          console.error('Errore eliminazione template:', templateError)
          // Non lanciamo l'errore perché i template potrebbero non esistere
        }
      }

      // 5. Finalmente elimina i bandi
      const { error: bandiError } = await supabase
        .from('scadenze_bandi_bandi')
        .delete()
        .in('id', bandiIds)

      if (bandiError) {
        console.error('Errore eliminazione bandi:', bandiError)
        throw bandiError
      }

      // Reset stati
      if (bandoToDelete) {
        setBandoToDelete(null)
      } else {
        setSelectedBandiForDelete(new Set())
        setIsSelectMode(false)
      }

      setShowDeleteConfirm(false)
      fetchBandi() // Ricarica la lista

    } catch (error: any) {
      console.error('Errore nell\'eliminazione:', error)
      alert(`Errore: ${error.message || 'Impossibile eliminare il bando'}`)
    } finally {
      setDeleting(false)
    }
  }

  const toggleSelectBando = (bandoId: string) => {
    const newSelected = new Set(selectedBandiForDelete)
    if (newSelected.has(bandoId)) {
      newSelected.delete(bandoId)
    } else {
      newSelected.add(bandoId)
    }
    setSelectedBandiForDelete(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedBandiForDelete.size === bandiFiltrati.length) {
      setSelectedBandiForDelete(new Set())
    } else {
      setSelectedBandiForDelete(new Set(bandiFiltrati.map(b => b.id)))
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
        <h1 className="text-3xl font-bold text-gray-900">Gestione Bandi</h1>
        <div className="flex items-center gap-3">
          {isSelectMode ? (
            <>
              {selectedBandiForDelete.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Elimina ({selectedBandiForDelete.size})
                </button>
              )}
              <button
                onClick={() => {
                  setIsSelectMode(false)
                  setSelectedBandiForDelete(new Set())
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
              <button
                onClick={() => setShowNewBandoModal(true)}
                className="bg-gradient-to-br from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white font-bold px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg"
              >
                <Plus className="w-4 h-4" />
                Nuovo Bando
              </button>
            </>
          )}
        </div>
      </div>

      {/* Statistiche Rapide */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-500 p-4 rounded-xl border border-emerald-400 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-emerald-100 drop-shadow-sm">Aperti</p>
              <p className="text-2xl font-black text-white drop-shadow">{bandiAperti.length}</p>
            </div>
            <Calendar className="w-8 h-8 text-emerald-200 drop-shadow" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-cyan-500 to-teal-500 p-4 rounded-xl border border-cyan-400 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-cyan-100 drop-shadow-sm">In arrivo</p>
              <p className="text-2xl font-black text-white drop-shadow">{bandiInArrivo.length}</p>
            </div>
            <Calendar className="w-8 h-8 text-cyan-200 drop-shadow" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-yellow-500 p-4 rounded-xl border border-amber-400 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-white drop-shadow-sm">Scaduti</p>
              <p className="text-2xl font-black text-white drop-shadow">{bandiScaduti.length}</p>
            </div>
            <Building className="w-8 h-8 text-white drop-shadow" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-red-500 to-red-600 p-4 rounded-xl border border-red-400 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-red-100 drop-shadow-sm">Progetti attivi</p>
              <p className="text-2xl font-black text-white drop-shadow">
                {totalProgettiAttivi}
              </p>
            </div>
            <FileText className="w-8 h-8 text-red-200 drop-shadow" />
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
              placeholder="Cerca bando, codice, ente..."
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
              <option value="APERTO">Solo aperti</option>
              <option value="PROSSIMA_APERTURA">Prossima apertura</option>
              <option value="IN_VALUTAZIONE">In valutazione</option>
              <option value="CHIUSO">Chiusi</option>
            </select>
          </div>

          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="tutti">Tutte le tipologie</option>
            {tipiBando.map(tipo => (
              <option key={tipo} value={tipo}>{tipo}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Lista Bandi */}
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
                      {selectedBandiForDelete.size === bandiFiltrati.length ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bando
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Scadenze
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contributo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stato
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Progetti
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Azioni
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {bandiFiltrati.map((bando) => (
                <tr key={bando.id} className="hover:bg-gray-50">
                  {isSelectMode && (
                    <td className="px-1 py-2 w-12">
                      <button
                        onClick={() => toggleSelectBando(bando.id)}
                        className="text-gray-600 hover:text-gray-800"
                      >
                        {selectedBandiForDelete.has(bando.id) ? (
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
                        {bando.nome}
                      </div>
                      <div className="text-sm text-gray-500">
                        {bando.codice_bando} • {bando.tipologia_bando}
                      </div>
                    </div>
                  </td>
                  <td className="px-1 py-2 text-sm text-gray-900">
                    {bando.ente_erogatore}
                  </td>
                  <td className="px-1 py-2">
                    <div className="text-sm">
                      <div>Apertura: <span className="font-medium">{formatDate(bando.data_apertura_presentazione)}</span></div>
                      <div>Chiusura: <span className="font-medium">{formatDate(bando.data_chiusura_presentazione)}</span></div>
                      {bando.giorni_a_chiusura !== null && bando.giorni_a_chiusura >= 0 && (
                        <div className="text-orange-600">Tra {bando.giorni_a_chiusura} giorni</div>
                      )}
                    </div>
                  </td>
                  <td className="px-1 py-2">
                    <div className="text-sm">
                      <div>{formatCurrency(bando.contributo_massimo)}</div>
                      <div className="text-gray-500">{bando.percentuale_contributo}%</div>
                    </div>
                  </td>
                  <td className="px-1 py-2">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getStatoColor(bando.stato_calcolato)}`}>
                      {bando.stato_calcolato ? bando.stato_calcolato.replace('_', ' ') : 'N/A'}
                    </span>
                  </td>
                  <td className="px-1 py-2 text-sm text-gray-900">
                    <div className="text-center">
                      <div className="font-medium">{bando.progetti_collegati || 0}</div>
                      <div className="text-gray-500 text-xs">
                        {bando.progetti_attivi || 0} attivi
                      </div>
                    </div>
                  </td>
                  <td className="px-1 py-2 text-sm font-medium">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditBando(bando)}
                        className="text-orange-600 hover:text-orange-900"
                        title="Modifica bando"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleCreateProgetto(bando)}
                        className="text-emerald-600 hover:text-emerald-900"
                        title="Crea progetto da bando"
                      >
                        <Rocket className="w-4 h-4" />
                      </button>
                      {bando.link_bando_ufficiale && (
                        <a
                          href={bando.link_bando_ufficiale}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-600 hover:text-green-900"
                          title="Apri bando ufficiale"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        onClick={() => handleDeleteBando(bando.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Elimina bando"
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

        {bandiFiltrati.length === 0 && (
          <div className="text-center py-12">
            <Building className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Nessun bando trovato</h3>
            <p className="mt-1 text-sm text-gray-500">
              Non ci sono bandi che corrispondono ai filtri selezionati.
            </p>
          </div>
        )}
      </div>


      {/* Form Nuovo Bando */}
      {showNewBandoModal && (
        <BandoForm
          onClose={() => setShowNewBandoModal(false)}
          onBandoCreated={handleBandoCreated}
        />
      )}

      {/* Form Modifica Bando */}
      {showEditBandoModal && editingBando && (
        <BandoForm
          bando={editingBando}
          onClose={() => {
            setShowEditBandoModal(false)
            setEditingBando(null)
          }}
          onBandoCreated={handleBandoCreated}
        />
      )}

      {/* Form Creazione Progetto */}
      {showProgettoModal && progettoFromBando && (
        <ProgettoForm
          bando={progettoFromBando}
          onClose={() => {
            setShowProgettoModal(false)
            setProgettoFromBando(null)
          }}
          onProgettoCreated={handleProgettoCreated}
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
                    {bandoToDelete
                      ? "Sei sicuro di voler eliminare questo bando?"
                      : `Sei sicuro di voler eliminare ${selectedBandiForDelete.size} bandi selezionati?`
                    }
                  </p>
                </div>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-yellow-800">
                  <strong>Attenzione:</strong> Questa operazione è irreversibile e eliminerà automaticamente TUTTI i progetti collegati ai bandi selezionati e le relative scadenze.
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false)
                    setBandoToDelete(null)
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