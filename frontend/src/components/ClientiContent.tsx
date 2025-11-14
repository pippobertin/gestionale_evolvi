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
  Trash2,
  Eye,
  Users,
  Euro,
  MapPin,
  FileText
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import ClienteForm from './ClienteForm'
import ClienteDettaglio from './ClienteDettaglio'

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
}

export default function ClientiContent() {
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

  // Fetch clienti da Supabase
  useEffect(() => {
    fetchClienti()
  }, [])

  const fetchClienti = async () => {
    try {
      setLoading(true)

      // Usa la vista con dimensione aggregata calcolata
      console.log('📊 Tentativo caricamento vista aggregata...')
      const { data, error } = await supabase
        .from('scadenze_bandi_clienti_con_dimensione_aggregata')
        .select('*')
        .order('denominazione')

      if (error) {
        console.warn('⚠️ Vista aggregata non disponibile, uso tabella normale:', error.message)
        // Fallback sulla tabella normale se la view non esiste
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('scadenze_bandi_clienti')
          .select('*')
          .order('denominazione')

        if (fallbackError) throw fallbackError
        console.log('📋 Caricati clienti base:', fallbackData?.length || 0)
        setClienti(fallbackData || [])
      } else {
        console.log('✅ Caricati clienti con dimensione aggregata:', data?.length || 0)
        console.log('📊 Esempio cliente con aggregazione:', data?.[0])
        setClienti(data || [])
      }
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

  const handleModificaCliente = (cliente: Cliente) => {
    setSelectedCliente(cliente)
    setShowForm(true)
  }

  const handleDettaglioCliente = (clienteId: string) => {
    setSelectedClienteId(clienteId)
    setShowDettaglio(true)
  }

  const handleEliminaCliente = async (clienteId: string, denominazione: string) => {
    if (window.confirm(`Sei sicuro di voler eliminare il cliente "${denominazione}"?`)) {
      try {
        const { error } = await supabase
          .from('scadenze_bandi_clienti')
          .delete()
          .eq('id', clienteId)

        if (error) throw error

        fetchClienti() // Ricarica la lista
        alert('Cliente eliminato con successo')
      } catch (error) {
        console.error('Errore nell\'eliminazione:', error)
        alert('Errore nell\'eliminazione del cliente')
      }
    }
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
        <button
          onClick={handleNuovoCliente}
          className="btn-primary flex items-center space-x-2"
        >
          <Plus className="w-5 h-5" />
          <span>Nuovo Cliente</span>
        </button>
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
                  <th className="table-header-cell">Cliente</th>
                  <th className="table-header-cell">Contatti</th>
                  <th className="table-header-cell">Dimensione</th>
                  <th className="table-header-cell">Fatturato</th>
                  <th className="table-header-cell">Categoria</th>
                  <th className="table-header-cell">Progetti</th>
                  <th className="table-header-cell">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {filteredClienti.map((cliente) => (
                  <tr key={cliente.id} className="hover:bg-gray-25">
                    <td className="table-cell">
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
                    <td className="table-cell">
                      <div className="space-y-1">
                        {cliente.email && (
                          <div className="text-sm text-gray-600 flex items-center">
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
                    <td className="table-cell">
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
                    <td className="table-cell">
                      {cliente.ultimo_fatturato ? (
                        <div className="flex items-center text-gray-900">
                          <Euro className="w-3 h-3 mr-1" />
                          {formatCurrency(cliente.ultimo_fatturato)}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="table-cell">
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
                    <td className="table-cell">
                      <div className="flex items-center space-x-1">
                        <FileText className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {cliente.numero_progetti || 0}
                        </span>
                      </div>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleDettaglioCliente(cliente.id)}
                          className="p-1 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
                          title="Visualizza dettaglio"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleModificaCliente(cliente)}
                          className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Modifica cliente"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEliminaCliente(cliente.id, cliente.denominazione)}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Elimina cliente"
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
    </div>
  )
}