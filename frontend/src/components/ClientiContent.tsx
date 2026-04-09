'use client'

import { useState, useEffect } from 'react'
import {
  Plus,
  Search,
  Filter,
  Building2,
  CheckSquare,
  Square,
  Trash2,
  Upload
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import ClienteForm from './ClienteForm'
import ClienteDettaglio from './ClienteDettaglio'
import ClientiMappingCSV from './ClientiMappingCSV'

interface Cliente {
  id: string
  denominazione: string
  partita_iva?: string
  email?: string
  telefono?: string
  dimensione?: 'MICRO' | 'PICCOLA' | 'MEDIA' | 'GRANDE' // Dimensione base
  dimensione_aggregata?: string // Dimensione calcolata con collegamenti
  numero_collegamenti?: number // Numero di collegamenti aziendali
  ultimo_fatturato?: number
  numero_dipendenti?: number
  categoria_evolvi?: 'CLIENTE_SPOT' | 'EVOLVI'
  scadenza_evolvi?: string
  citta_fatturazione?: string
  created_at: string
  legale_rappresentante?: string
  numero_progetti?: number
  creato_da?: string
  // Proprietà per calcolo dimensione aggregata (Raccomandazione UE 2003/361/CE)
  ula?: number // Unità Lavorative Annuali
  attivo_bilancio?: number // Attivo di bilancio
  tipo_collegamento?: 'AUTONOMA' | 'COLLEGATA' | 'ASSOCIATA' // Tipo di collegamento aziendale
  impresa_collegata_id?: string // ID dell'impresa collegata
  percentuale_partecipazione?: number // Percentuale di partecipazione (0-100)
}

export default function ClientiContent({ onNavigate }: { onNavigate?: (page: string, params?: any) => void }) {
  const [clienti, setClienti] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDimensione, setSelectedDimensione] = useState<string>('all')
  const [selectedCategoria, setSelectedCategoria] = useState<string>('all')
  const [showFilters, setShowFilters] = useState(false)

  // Modal states
  const [showForm, setShowForm] = useState(false)
  const [showDettaglio, setShowDettaglio] = useState(false)
  const [selectedCliente, setSelectedCliente] = useState<Cliente | undefined>(undefined)
  const [selectedClienteId, setSelectedClienteId] = useState<string>('')

  // Bulk selection states
  const [selectedClientiForDelete, setSelectedClientiForDelete] = useState<Set<string>>(new Set())
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [clienteToDelete, setClienteToDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // CSV Import state
  const [showImportCSV, setShowImportCSV] = useState(false)

  // Fetch clienti da Supabase
  useEffect(() => {
    fetchClienti()
  }, [])

  const fetchClienti = async () => {
    try {
      setLoading(true)

      // Query per ottenere clienti con conteggio progetti reali e prossima scadenza
      let clientiData: any[] = []

      const { data, error: clientiError } = await supabase
        .from('scadenze_bandi_clienti_con_dimensione_aggregata')
        .select('*, creato_da')
        .order('denominazione')

      if (clientiError) {
        console.warn('⚠️ Vista aggregata non disponibile, uso tabella normale:', clientiError.message)
        // Fallback sulla tabella normale se la view non esiste
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('scadenze_bandi_clienti')
          .select('*, creato_da')
          .order('denominazione')

        if (fallbackError) throw fallbackError
        clientiData = fallbackData || []
      } else {
        clientiData = data || []
      }

      // Per ogni cliente, ottieni il conteggio progetti e la prossima scadenza
      const clientiConDati = await Promise.all(
        clientiData.map(async (cliente) => {
          // Conta progetti reali per cliente_id (tutti i progetti associati al cliente)
          const { count: numeroProgetti } = await supabase
            .from('scadenze_bandi_progetti')
            .select('*', { count: 'exact', head: true })
            .eq('cliente_id', cliente.id)

          return {
            ...cliente,
            numero_progetti: numeroProgetti || 0
          }
        })
      )

      setClienti(clientiConDati)
    } catch (error) {
      console.error('Errore nel caricamento clienti:', error)
    } finally {
      setLoading(false)
    }
  }

  // Funzioni per gestire i modali
  const handleNuovoCliente = () => {
    setSelectedCliente(undefined)
    setShowForm(true)
  }

  const handleImportCSV = () => {
    setShowImportCSV(true)
  }

  const handleCloseImportCSV = () => {
    setShowImportCSV(false)
  }

  const handleImportComplete = () => {
    fetchClienti() // Reload clients after import
  }


  const handleDettaglioCliente = (clienteId: string) => {
    setSelectedClienteId(clienteId)
    setShowDettaglio(true)
  }


  const handleCloseForm = () => {
    setShowForm(false)
    setSelectedCliente(undefined)
  }

  const handleCloseDettaglio = () => {
    setShowDettaglio(false)
    setSelectedClienteId('')
  }

  const handleSaveCliente = () => {
    fetchClienti() // Ricarica la lista dopo il salvataggio
  }

  // Calcola dimensione aggregata considerando collegamenti aziendali
  const calcolaDimensioneAggregata = (cliente: Cliente): string => {
    // Se la vista DB ha già calcolato la dimensione aggregata, usala
    if (cliente.dimensione_aggregata) {
      return cliente.dimensione_aggregata
    }

    if (!cliente.ula && !cliente.ultimo_fatturato && !cliente.attivo_bilancio) {
      return cliente.dimensione || ''
    }

    let ulaTotal = cliente.ula || 0
    let fatturatoTotal = cliente.ultimo_fatturato || 0
    let attivoTotal = cliente.attivo_bilancio || 0

    // Se c'è un collegamento aziendale, cerca i dati dell'azienda collegata
    if (cliente.tipo_collegamento !== 'AUTONOMA' && cliente.impresa_collegata_id) {
      // Trova l'azienda collegata nella lista
      const aziendaCollegata = clienti.find(c => c.id === cliente.impresa_collegata_id)

      if (aziendaCollegata) {
        const percentuale = (cliente.percentuale_partecipazione || 0) / 100

        if (cliente.tipo_collegamento === 'COLLEGATA') {
          // Per aziende collegate (25-49.99%): somma proporzionale alla partecipazione
          ulaTotal += (aziendaCollegata.ula || 0) * percentuale
          fatturatoTotal += (aziendaCollegata.ultimo_fatturato || 0) * percentuale
          attivoTotal += (aziendaCollegata.attivo_bilancio || 0) * percentuale
        } else if (cliente.tipo_collegamento === 'ASSOCIATA') {
          // Per aziende associate (≥50%): somma il 100%
          ulaTotal += aziendaCollegata.ula || 0
          fatturatoTotal += aziendaCollegata.ultimo_fatturato || 0
          attivoTotal += aziendaCollegata.attivo_bilancio || 0
        }
      }
    }

    // Applica i limiti UE 2003/361/CE
    if (ulaTotal < 10 && (fatturatoTotal <= 2000000 || attivoTotal <= 2000000)) return 'MICRO'
    if (ulaTotal < 50 && (fatturatoTotal <= 10000000 || attivoTotal <= 10000000)) return 'PICCOLA'
    if (ulaTotal < 250 && (fatturatoTotal <= 50000000 || attivoTotal <= 43000000)) return 'MEDIA'
    return 'GRANDE'
  }

  const handleEditFromDettaglio = (cliente: Cliente) => {
    setShowDettaglio(false)
    setSelectedCliente(cliente)
    setShowForm(true)
  }

  const handleNavigateToProjects = (cliente: Cliente) => {
    if (onNavigate) {
      onNavigate('progetti', { clienteFilter: cliente.denominazione })
    }
  }

  // Bulk selection handlers
  const handleDeleteCliente = (clienteId: string) => {
    setClienteToDelete(clienteId)
    setShowDeleteConfirm(true)
  }

  const handleBulkDelete = () => {
    if (selectedClientiForDelete.size > 0) {
      setShowDeleteConfirm(true)
    }
  }

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      const clientiIds = clienteToDelete ? [clienteToDelete] : Array.from(selectedClientiForDelete)

      // Per ogni cliente, elimina prima tutti i progetti collegati e poi il cliente
      for (const clienteId of clientiIds) {
        // 1. Trova tutti i progetti collegati a questo cliente
        const { data: progetti, error: progettiError } = await supabase
          .from('scadenze_bandi_progetti')
          .select('id')
          .eq('cliente_id', clienteId)

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

        // 3. Elimina tutti i progetti collegati al cliente
        if (progetti && progetti.length > 0) {
          const { error: deleteProgettiError } = await supabase
            .from('scadenze_bandi_progetti')
            .delete()
            .eq('cliente_id', clienteId)

          if (deleteProgettiError) {
            console.error('Errore eliminazione progetti:', deleteProgettiError)
            throw deleteProgettiError
          }
        }
      }

      // 4. Finalmente elimina i clienti
      const { error: clientiError } = await supabase
        .from('scadenze_bandi_clienti')
        .delete()
        .in('id', clientiIds)

      if (clientiError) {
        console.error('Errore eliminazione clienti:', clientiError)
        throw clientiError
      }

      // Reset stati
      if (clienteToDelete) {
        setClienteToDelete(null)
      } else {
        setSelectedClientiForDelete(new Set())
        setIsSelectMode(false)
      }

      setShowDeleteConfirm(false)
      fetchClienti() // Ricarica la lista

    } catch (error: any) {
      console.error('Errore nell\'eliminazione:', error)
      alert(`Errore: ${error.message || 'Impossibile eliminare il cliente'}`)
    } finally {
      setDeleting(false)
    }
  }

  const toggleSelectCliente = (clienteId: string) => {
    const newSelected = new Set(selectedClientiForDelete)
    if (newSelected.has(clienteId)) {
      newSelected.delete(clienteId)
    } else {
      newSelected.add(clienteId)
    }
    setSelectedClientiForDelete(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedClientiForDelete.size === filteredClienti.length) {
      setSelectedClientiForDelete(new Set())
    } else {
      setSelectedClientiForDelete(new Set(filteredClienti.map(c => c.id)))
    }
  }

  // Filtri
  const filteredClienti = clienti.filter(cliente => {
    const matchSearch = cliente.denominazione?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       cliente.partita_iva?.includes(searchTerm) ||
                       cliente.email?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchDimensione = selectedDimensione === 'all' || cliente.dimensione === selectedDimensione
    const matchCategoria = selectedCategoria === 'all' || cliente.categoria_evolvi === selectedCategoria

    return matchSearch && matchDimensione && matchCategoria
  })

  const formatCurrency = (amount?: number) => {
    if (!amount) return '-'
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('it-IT')
  }

  const getDimensioneColor = (dimensione?: string) => {
    switch (dimensione) {
      case 'MICRO': return 'bg-green-100 text-green-800 border-green-200'
      case 'PICCOLA': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'MEDIA': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'GRANDE': return 'bg-purple-100 text-purple-800 border-purple-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getCategoriaColor = (categoria?: string) => {
    switch (categoria) {
      case 'CLIENTE_SPOT': return 'bg-yellow-100 text-yellow-800'
      case 'EVOLVI': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getCategoriaLabel = (categoria?: string) => {
    switch (categoria) {
      case 'CLIENTE_SPOT': return 'Spot'
      case 'EVOLVI': return 'Evolvi'
      default: return categoria || ''
    }
  }


  // Counts for status bar
  const evolviCount = filteredClienti.filter(c => c.categoria_evolvi === 'EVOLVI').length
  const spotCount = filteredClienti.filter(c => c.categoria_evolvi === 'CLIENTE_SPOT').length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-5.5rem)]">
      {/* Toolbar */}
      <div className="border-b border-gray-200 px-4 py-1.5 flex items-center gap-3 bg-white">
        <Building2 className="w-4 h-4 text-primary-600 flex-shrink-0" />
        <span className="text-sm font-semibold text-gray-900">Clienti</span>
        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
          {filteredClienti.length}
        </span>
        <div className="flex-1" />

        {/* Search */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-2 flex items-center">
            <Search className="h-3.5 w-3.5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Cerca..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-48 text-[11px] pl-7 pr-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        <div className="w-px h-5 bg-gray-200" />

        {isSelectMode ? (
          <>
            {selectedClientiForDelete.size > 0 && (
              <button
                onClick={handleBulkDelete}
                className="text-[11px] bg-red-500 hover:bg-red-600 text-white px-2.5 py-1 rounded flex items-center gap-1.5"
              >
                <Trash2 className="w-3 h-3" />
                Elimina ({selectedClientiForDelete.size})
              </button>
            )}
            <button
              onClick={() => {
                setIsSelectMode(false)
                setSelectedClientiForDelete(new Set())
              }}
              className="text-[11px] text-gray-600 hover:text-gray-800 px-2 py-1"
            >
              Annulla
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`text-[11px] px-2 py-1 rounded flex items-center gap-1.5 ${
                showFilters ? 'bg-primary-100 text-primary-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Filter className="w-3 h-3" />
              Filtri
            </button>
            <button
              onClick={() => setIsSelectMode(true)}
              className="text-[11px] text-gray-600 hover:bg-gray-100 px-2 py-1 rounded flex items-center gap-1.5"
            >
              <CheckSquare className="w-3 h-3" />
              Seleziona
            </button>
            <button
              onClick={handleImportCSV}
              className="text-[11px] text-gray-600 hover:bg-gray-100 px-2 py-1 rounded flex items-center gap-1.5"
            >
              <Upload className="w-3 h-3" />
              CSV
            </button>
            <button
              onClick={handleNuovoCliente}
              className="text-[11px] bg-primary-500 hover:bg-primary-600 text-white px-2.5 py-1 rounded flex items-center gap-1.5"
            >
              <Plus className="w-3 h-3" />
              Nuovo
            </button>
          </>
        )}
      </div>

      {/* Filter row (conditional) */}
      {showFilters && (
        <div className="border-b border-gray-200 px-4 py-1.5 bg-gray-50/50 flex items-center gap-3">
          <select
            value={selectedDimensione}
            onChange={(e) => setSelectedDimensione(e.target.value)}
            className="text-[11px] px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="all">Tutte le dimensioni</option>
            <option value="MICRO">Micro</option>
            <option value="PICCOLA">Piccola</option>
            <option value="MEDIA">Media</option>
            <option value="GRANDE">Grande</option>
          </select>
          <select
            value={selectedCategoria}
            onChange={(e) => setSelectedCategoria(e.target.value)}
            className="text-[11px] px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="all">Tutte le categorie</option>
            <option value="CLIENTE_SPOT">Spot</option>
            <option value="EVOLVI">Evolvi</option>
          </select>
        </div>
      )}

      {/* Alphabet strip */}
      <div className="border-b border-gray-200 px-4 py-1 flex items-center gap-0.5 bg-white flex-shrink-0">
        {Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ').map(letter => {
          const hasClienti = filteredClienti.some(c =>
            c.denominazione?.toUpperCase().startsWith(letter)
          )
          return (
            <button
              key={letter}
              onClick={() => {
                const firstClient = filteredClienti.find(c =>
                  c.denominazione?.toUpperCase().startsWith(letter)
                )
                if (firstClient) {
                  const element = document.getElementById(`client-${firstClient.id}`)
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  }
                }
              }}
              disabled={!hasClienti}
              className={`w-[22px] h-[20px] rounded-sm text-[10px] font-medium transition-all flex items-center justify-center ${
                hasClienti
                  ? 'bg-primary-50 text-primary-700 hover:bg-primary-100 cursor-pointer'
                  : 'text-gray-300 cursor-not-allowed'
              }`}
            >
              {letter}
            </button>
          )
        })}
      </div>

      {/* Table full-bleed */}
      <div className="flex-1 overflow-auto">
        {filteredClienti.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-gray-500 mb-3">
              {searchTerm || selectedDimensione !== 'all' || selectedCategoria !== 'all'
                ? 'Nessun cliente trovato. Prova a modificare i filtri.'
                : 'Nessun cliente. Inizia aggiungendo il primo.'
              }
            </p>
            <button onClick={handleNuovoCliente} className="text-xs bg-primary-500 hover:bg-primary-600 text-white px-3 py-1.5 rounded flex items-center gap-1.5 mx-auto">
              <Plus className="w-3 h-3" />
              Aggiungi Cliente
            </button>
          </div>
        ) : (
          <table className="w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-[1]">
              <tr>
                {isSelectMode && (
                  <th className="px-4 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8">
                    <button
                      onClick={toggleSelectAll}
                      className="text-gray-600 hover:text-gray-800"
                    >
                      {selectedClientiForDelete.size === filteredClienti.length ? (
                        <CheckSquare className="w-3.5 h-3.5" />
                      ) : (
                        <Square className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </th>
                )}
                <th className="px-4 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Denominazione</th>
                <th className="px-4 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">P.IVA</th>
                <th className="px-4 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider max-w-[120px]">Sede</th>
                <th className="px-4 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider max-w-[160px]">Email</th>
                <th className="px-4 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dim.</th>
                <th className="px-4 py-1.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Dip.</th>
                <th className="px-4 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                <th className="px-4 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Scad. Evolvi</th>
                <th className="px-4 py-1.5 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Prog.</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredClienti.map((cliente) => (
                <tr
                  key={cliente.id}
                  id={`client-${cliente.id}`}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => !isSelectMode && handleDettaglioCliente(cliente.id)}
                >
                  {isSelectMode && (
                    <td className="px-1 py-2 w-8">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleSelectCliente(cliente.id)
                        }}
                        className="text-gray-600 hover:text-gray-800"
                      >
                        {selectedClientiForDelete.has(cliente.id) ? (
                          <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                        ) : (
                          <Square className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </td>
                  )}
                  <td className="px-1 py-2 text-sm font-medium text-gray-900 whitespace-nowrap">
                    {cliente.denominazione}
                  </td>
                  <td className="px-1 py-2 text-sm text-gray-500 font-mono whitespace-nowrap">
                    {cliente.partita_iva || '-'}
                  </td>
                  <td className="px-1 py-2 text-sm text-gray-500 max-w-[120px] truncate" title={cliente.citta_fatturazione || ''}>
                    {cliente.citta_fatturazione || '-'}
                  </td>
                  <td className="px-1 py-2 text-sm text-blue-600 max-w-[160px] truncate" title={cliente.email || ''}>
                    {cliente.email || '-'}
                  </td>
                  <td className="px-1 py-2">
                    {calcolaDimensioneAggregata(cliente) ? (
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getDimensioneColor(calcolaDimensioneAggregata(cliente))}`}>
                        {calcolaDimensioneAggregata(cliente)}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-1 py-2 text-sm text-gray-500 text-center">
                    {cliente.numero_dipendenti ?? '-'}
                  </td>
                  <td className="px-1 py-2">
                    {cliente.categoria_evolvi ? (
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getCategoriaColor(cliente.categoria_evolvi)}`}>
                        {getCategoriaLabel(cliente.categoria_evolvi)}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-1 py-2 text-sm text-gray-500 whitespace-nowrap">
                    {formatDate(cliente.scadenza_evolvi)}
                  </td>
                  <td className="px-1 py-2 text-sm text-center">
                    <span
                      className="cursor-pointer hover:text-primary-600 font-medium"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleNavigateToProjects(cliente)
                      }}
                      title="Visualizza progetti"
                    >
                      {cliente.numero_progetti || 0}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Status bar */}
      <div className="border-t border-gray-200 px-4 py-1 bg-white">
        <span className="text-[10px] text-gray-400">
          {filteredClienti.length} clienti{evolviCount > 0 && ` \u00b7 ${evolviCount} Evolvi`}{spotCount > 0 && ` \u00b7 ${spotCount} Spot`}
        </span>
      </div>

      {/* Modali */}
      <ClienteForm
        cliente={selectedCliente as any}
        isOpen={showForm}
        onClose={handleCloseForm}
        onSave={handleSaveCliente}
      />

      <ClienteDettaglio
        clienteId={selectedClienteId}
        isOpen={showDettaglio}
        onClose={handleCloseDettaglio}
        onEdit={handleEditFromDettaglio as any}
      />

      <ClientiMappingCSV
        isOpen={showImportCSV}
        onClose={handleCloseImportCSV}
        onImportComplete={handleImportComplete}
      />

      {/* Modal Conferma Eliminazione */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-md w-full mx-4">
            <div className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                  <Trash2 className="w-4 h-4 text-red-600" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-900">
                    Conferma eliminazione
                  </h3>
                  <p className="text-xs text-gray-500">
                    {clienteToDelete
                      ? 'Sei sicuro di voler eliminare questo cliente?'
                      : `Sei sicuro di voler eliminare ${selectedClientiForDelete.size} clienti?`
                    }
                  </p>
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3 mb-3">
                <p className="text-xs text-amber-800">
                  Questa operazione eliminerà anche tutti i progetti e scadenze collegati. Non può essere annullata.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false)
                    setClienteToDelete(null)
                  }}
                  className="text-xs px-3 py-1.5 text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
                  disabled={deleting}
                >
                  Annulla
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleting}
                  className="text-xs px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {deleting ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                      Eliminando...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3 h-3" />
                      Elimina
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