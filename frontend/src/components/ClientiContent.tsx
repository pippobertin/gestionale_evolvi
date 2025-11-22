'use client'

import { useState, useEffect } from 'react'
import {
  Plus,
  Search,
  Filter,
  Building2,
  Mail,
  Phone,
  Calendar,
  Edit,
  Users,
  MapPin,
  FileText,
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
  categoria_evolvi?: 'BASE' | 'PREMIUM' | 'BUSINESS' | 'ENTERPRISE'
  scadenza_evolvi?: string
  citta_fatturazione?: string
  created_at: string
  legale_rappresentante?: string
  numero_progetti?: number
  creato_da?: string
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
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null)
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
    setSelectedCliente(null)
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
    setSelectedCliente(null)
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
      case 'BASE': return 'bg-gray-100 text-gray-800'
      case 'PREMIUM': return 'bg-blue-100 text-blue-800'
      case 'BUSINESS': return 'bg-green-100 text-green-800'
      case 'ENTERPRISE': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }


  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
            <Building2 className="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Gestione Clienti</h2>
            <p className="text-gray-600">{filteredClienti.length} clienti trovati</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isSelectMode ? (
            <>
              {selectedClientiForDelete.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Elimina ({selectedClientiForDelete.size})
                </button>
              )}
              <button
                onClick={() => {
                  setIsSelectMode(false)
                  setSelectedClientiForDelete(new Set())
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
                onClick={handleImportCSV}
                className="bg-gradient-to-br from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg"
              >
                <Upload className="w-4 h-4" />
                Importa CSV
              </button>
              <button
                onClick={handleNuovoCliente}
                className="btn-primary flex items-center space-x-2"
              >
                <Plus className="w-5 h-5" />
                <span>Nuovo Cliente</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filtri e Ricerca */}
      <div className="card p-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          {/* Ricerca */}
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Cerca per denominazione, P.IVA o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>

          {/* Toggle Filtri */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn-secondary flex items-center space-x-2"
          >
            <Filter className="w-4 h-4" />
            <span>Filtri</span>
          </button>
        </div>

        {/* Filtri Avanzati */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Dimensione</label>
              <select
                value={selectedDimensione}
                onChange={(e) => setSelectedDimensione(e.target.value)}
                className="input"
              >
                <option value="all">Tutte le dimensioni</option>
                <option value="MICRO">Micro</option>
                <option value="PICCOLA">Piccola</option>
                <option value="MEDIA">Media</option>
                <option value="GRANDE">Grande</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Categoria Evolvi</label>
              <select
                value={selectedCategoria}
                onChange={(e) => setSelectedCategoria(e.target.value)}
                className="input"
              >
                <option value="all">Tutte le categorie</option>
                <option value="BASE">Base</option>
                <option value="PREMIUM">Premium</option>
                <option value="BUSINESS">Business</option>
                <option value="ENTERPRISE">Enterprise</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Lista Clienti */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900">Lista Clienti</h3>
        </div>

        {filteredClienti.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nessun cliente trovato</h3>
            <p className="text-gray-600 mb-6">
              {searchTerm || selectedDimensione !== 'all' || selectedCategoria !== 'all'
                ? 'Prova a modificare i filtri di ricerca'
                : 'Inizia aggiungendo il primo cliente'
              }
            </p>
            <button onClick={handleNuovoCliente} className="btn-primary">
              <Plus className="w-4 h-4 mr-2" />
              Aggiungi Cliente
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead className="table-header">
                <tr>
                  {isSelectMode && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                      <button
                        onClick={toggleSelectAll}
                        className="text-gray-600 hover:text-gray-800"
                      >
                        {selectedClientiForDelete.size === filteredClienti.length ? (
                          <CheckSquare className="w-4 h-4" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                  )}
                  <th className="table-header-cell">Cliente</th>
                  <th className="table-header-cell">Contatti</th>
                  <th className="table-header-cell">Dimensione</th>
                  <th className="table-header-cell">Categoria</th>
                  <th className="table-header-cell">Progetti</th>
                </tr>
              </thead>
              <tbody>
                {filteredClienti.map((cliente) => (
                  <tr key={cliente.id} className="hover:bg-gray-50 cursor-pointer transition-colors duration-150"
                      onClick={() => !isSelectMode && handleDettaglioCliente(cliente.id)}>
                    {isSelectMode && (
                      <td className="px-1 py-2 w-12">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleSelectCliente(cliente.id)
                          }}
                          className="text-gray-600 hover:text-gray-800"
                        >
                          {selectedClientiForDelete.has(cliente.id) ? (
                            <CheckSquare className="w-4 h-4 text-blue-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                    )}
                    <td className="px-1 py-2">
                      <div className="flex items-start space-x-3">
                        <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-5 h-5 text-primary-600" />
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">{cliente.denominazione}</div>
                          {cliente.partita_iva && (
                            <div className="text-sm text-gray-600">P.IVA: {cliente.partita_iva}</div>
                          )}
                          {cliente.citta_fatturazione && (
                            <div className="text-sm text-gray-500 flex items-center">
                              <MapPin className="w-3 h-3 mr-1" />
                              {cliente.citta_fatturazione}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-1 py-2">
                      <div className="space-y-1">
                        {cliente.email && (
                          <div className="text-sm text-blue-600 flex items-center hover:text-blue-800 cursor-pointer"
                               onClick={(e) => {
                                 e.stopPropagation();
                                 // TODO: Implementare apertura email dopo integrazione
                                 console.log('Email clicked:', cliente.email);
                               }}>
                            <Mail className="w-3 h-3 mr-1" />
                            {cliente.email}
                          </div>
                        )}
                        {cliente.telefono && (
                          <div className="text-sm text-gray-600 flex items-center">
                            <Phone className="w-3 h-3 mr-1" />
                            {cliente.telefono}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-1 py-2">
                      <div className="space-y-2">
                        {calcolaDimensioneAggregata(cliente) && (
                          <span className={`badge ${getDimensioneColor(calcolaDimensioneAggregata(cliente))}`}>
                            {calcolaDimensioneAggregata(cliente)}
                          </span>
                        )}
                        {cliente.numero_dipendenti !== undefined && (
                          <div className="text-sm text-gray-600 flex items-center">
                            <Users className="w-3 h-3 mr-1" />
                            {cliente.numero_dipendenti} dip.
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-1 py-2">
                      <div className="space-y-2">
                        {cliente.categoria_evolvi && (
                          <span className={`badge ${getCategoriaColor(cliente.categoria_evolvi)}`}>
                            {cliente.categoria_evolvi}
                          </span>
                        )}
                        {cliente.scadenza_evolvi && (
                          <div className="text-xs text-gray-600 flex items-center">
                            <Calendar className="w-3 h-3 mr-1" />
                            {formatDate(cliente.scadenza_evolvi)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-1 py-2">
                      <div
                        className="flex items-center space-x-1 cursor-pointer hover:text-primary-600 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleNavigateToProjects(cliente);
                        }}
                        title="Visualizza progetti di questo cliente"
                      >
                        <FileText className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600 font-medium">
                          {cliente.numero_progetti || 0}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modali */}
      <ClienteForm
        cliente={selectedCliente}
        isOpen={showForm}
        onClose={handleCloseForm}
        onSave={handleSaveCliente}
      />

      <ClienteDettaglio
        clienteId={selectedClienteId}
        isOpen={showDettaglio}
        onClose={handleCloseDettaglio}
        onEdit={handleEditFromDettaglio}
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
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">
                    Conferma eliminazione
                  </h3>
                  <p className="text-sm text-gray-500">
                    {clienteToDelete
                      ? 'Sei sicuro di voler eliminare questo cliente?'
                      : `Sei sicuro di voler eliminare ${selectedClientiForDelete.size} clienti?`
                    }
                  </p>
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-md p-4 mb-4">
                <p className="text-sm text-amber-800">
                  ⚠️ <strong>Attenzione:</strong> Questa operazione eliminerà anche tutti i progetti e scadenze collegati ai clienti selezionati. L'operazione non può essere annullata.
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false)
                    setClienteToDelete(null)
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
                      Conferma eliminazione
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