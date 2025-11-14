'use client'

import { useState, useEffect } from 'react'
import {
  X,
  Edit,
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
  Globe,
  CreditCard,
  Star,
  Clock,
  Target
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Cliente {
  id: string
  denominazione: string
  numero_azienda?: string
  partita_iva?: string
  rea?: string
  codice_fiscale?: string
  ateco?: string
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
  dimensione?: 'MICRO' | 'PICCOLA' | 'MEDIA' | 'GRANDE'
  matricola_inps?: string
  pat_inail?: string
  numero_dipendenti?: number
  numero_volontari?: number
  numero_collaboratori?: number
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
  created_at: string
  updated_at: string
}

interface ClienteDettaglioProps {
  clienteId: string
  isOpen: boolean
  onClose: () => void
  onEdit: (cliente: Cliente) => void
}

export default function ClienteDettaglio({ clienteId, isOpen, onClose, onEdit }: ClienteDettaglioProps) {
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [loading, setLoading] = useState(true)
  const [clienteCollegato, setClienteCollegato] = useState<Cliente | null>(null)

  useEffect(() => {
    if (isOpen && clienteId) {
      fetchCliente()
    }
  }, [isOpen, clienteId])

  const fetchCliente = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('scadenze_bandi_clienti')
        .select('*')
        .eq('id', clienteId)
        .single()

      if (error) throw error
      setCliente(data)

      // Carica anche l'azienda collegata se esiste
      if (data.impresa_collegata_id) {
        const { data: collegata, error: erroreCollegata } = await supabase
          .from('scadenze_bandi_clienti')
          .select('*')
          .eq('id', data.impresa_collegata_id)
          .single()

        if (!erroreCollegata) {
          setClienteCollegato(collegata)
        }
      }
    } catch (error) {
      console.error('Errore nel caricamento cliente:', error)
    } finally {
      setLoading(false)
    }
  }

  // Calcola dimensione aggregata considerando collegamenti aziendali
  const calcolaDimensioneAggregata = (cliente: Cliente): string => {
    if (!cliente.ula && !cliente.ultimo_fatturato && !cliente.attivo_bilancio) {
      return cliente.dimensione || ''
    }

    let ulaTotal = cliente.ula || 0
    let fatturatoTotal = cliente.ultimo_fatturato || 0
    let attivoTotal = cliente.attivo_bilancio || 0

    // Se c'è un collegamento aziendale, aggrega i dati dell'azienda collegata
    if (cliente.tipo_collegamento !== 'AUTONOMA' && cliente.impresa_collegata_id && clienteCollegato) {
      const percentuale = (cliente.percentuale_partecipazione || 0) / 100

      if (cliente.tipo_collegamento === 'COLLEGATA') {
        // Per aziende collegate (25-49.99%): somma proporzionale alla partecipazione
        ulaTotal += (clienteCollegato.ula || 0) * percentuale
        fatturatoTotal += (clienteCollegato.ultimo_fatturato || 0) * percentuale
        attivoTotal += (clienteCollegato.attivo_bilancio || 0) * percentuale
      } else if (cliente.tipo_collegamento === 'ASSOCIATA') {
        // Per aziende associate (≥50%): somma il 100%
        ulaTotal += clienteCollegato.ula || 0
        fatturatoTotal += clienteCollegato.ultimo_fatturato || 0
        attivoTotal += clienteCollegato.attivo_bilancio || 0
      }
    }

    // Applica i limiti UE 2003/361/CE
    if (ulaTotal < 10 && (fatturatoTotal <= 2000000 || attivoTotal <= 2000000)) return 'MICRO'
    if (ulaTotal < 50 && (fatturatoTotal <= 10000000 || attivoTotal <= 10000000)) return 'PICCOLA'
    if (ulaTotal < 250 && (fatturatoTotal <= 50000000 || attivoTotal <= 43000000)) return 'MEDIA'
    return 'GRANDE'
  }

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

  const renderRating = (rating?: number) => {
    if (!rating) return <span className="text-gray-400">Nessun rating</span>

    return (
      <div className="flex items-center space-x-1">
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            className={`w-4 h-4 ${
              i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    )
  }

  if (!isOpen) return null

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
          <p className="text-center text-gray-600 mt-4">Caricamento...</p>
        </div>
      </div>
    )
  }

  if (!cliente) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8">
          <p className="text-center text-red-600">Errore nel caricamento del cliente</p>
          <button onClick={onClose} className="mt-4 btn-primary mx-auto block">
            Chiudi
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-hard max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="gradient-primary text-white p-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Building2 className="w-6 h-6" />
            <div>
              <h2 className="text-xl font-bold">{cliente.denominazione}</h2>
              {cliente.partita_iva && (
                <p className="text-primary-100 text-sm">P.IVA: {cliente.partita_iva}</p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onEdit(cliente)}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <Edit className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)] space-y-8">
          {/* Riepilogo */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card p-4 text-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Euro className="w-6 h-6 text-green-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {formatCurrency(cliente.ultimo_fatturato)}
              </div>
              <div className="text-sm text-gray-600">Ultimo Fatturato</div>
            </div>

            <div className="card p-4 text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {cliente.numero_dipendenti || 0}
              </div>
              <div className="text-sm text-gray-600">Dipendenti</div>
            </div>

            <div className="card p-4 text-center">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Hash className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {cliente.ula || '-'}
              </div>
              <div className="text-sm text-gray-600">ULA</div>
            </div>

            <div className="card p-4 text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Star className="w-6 h-6 text-purple-600" />
              </div>
              <div className="mb-2">
                {renderRating(cliente.rating)}
              </div>
              <div className="text-sm text-gray-600">Rating</div>
            </div>
          </div>

          {/* Dati Anagrafici */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Building2 className="w-5 h-5 mr-2" />
              Dati Anagrafici
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cliente.numero_azienda && (
                <div>
                  <label className="block text-sm font-medium text-gray-500">Numero Azienda</label>
                  <p className="text-gray-900">{cliente.numero_azienda}</p>
                </div>
              )}
              {cliente.codice_fiscale && (
                <div>
                  <label className="block text-sm font-medium text-gray-500">Codice Fiscale</label>
                  <p className="text-gray-900">{cliente.codice_fiscale}</p>
                </div>
              )}
              {cliente.rea && (
                <div>
                  <label className="block text-sm font-medium text-gray-500">REA</label>
                  <p className="text-gray-900">{cliente.rea}</p>
                </div>
              )}
              {cliente.ateco && (
                <div>
                  <label className="block text-sm font-medium text-gray-500">Codice ATECO</label>
                  <p className="text-gray-900">{cliente.ateco}</p>
                </div>
              )}
              {cliente.data_costituzione && (
                <div>
                  <label className="block text-sm font-medium text-gray-500">Data Costituzione</label>
                  <p className="text-gray-900">{formatDate(cliente.data_costituzione)}</p>
                </div>
              )}
              {calcolaDimensioneAggregata(cliente) && (
                <div>
                  <label className="block text-sm font-medium text-gray-500">Dimensione</label>
                  <span className={`badge ${getDimensioneColor(calcolaDimensioneAggregata(cliente))}`}>
                    {calcolaDimensioneAggregata(cliente)}
                  </span>
                  {cliente.tipo_collegamento !== 'AUTONOMA' && cliente.impresa_collegata_id && (
                    <p className="text-xs text-gray-500 mt-1">
                      📊 Calcolo aggregato secondo UE 2003/361/CE
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Contatti */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Mail className="w-5 h-5 mr-2" />
              Contatti
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                {cliente.email && (
                  <div className="flex items-center space-x-3">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Email</label>
                      <p className="text-gray-900">{cliente.email}</p>
                    </div>
                  </div>
                )}
                {cliente.pec && (
                  <div className="flex items-center space-x-3">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <div>
                      <label className="block text-sm font-medium text-gray-500">PEC</label>
                      <p className="text-gray-900">{cliente.pec}</p>
                    </div>
                  </div>
                )}
                {cliente.telefono && (
                  <div className="flex items-center space-x-3">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Telefono</label>
                      <p className="text-gray-900">{cliente.telefono}</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-4">
                {cliente.sito_web && (
                  <div className="flex items-center space-x-3">
                    <Globe className="w-4 h-4 text-gray-400" />
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Sito Web</label>
                      <a
                        href={cliente.sito_web}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:text-primary-700"
                      >
                        {cliente.sito_web}
                      </a>
                    </div>
                  </div>
                )}
                {cliente.coordinate_bancarie && (
                  <div className="flex items-center space-x-3">
                    <CreditCard className="w-4 h-4 text-gray-400" />
                    <div>
                      <label className="block text-sm font-medium text-gray-500">IBAN</label>
                      <p className="text-gray-900 font-mono text-sm">{cliente.coordinate_bancarie}</p>
                    </div>
                  </div>
                )}
                {cliente.sdi && (
                  <div className="flex items-center space-x-3">
                    <Hash className="w-4 h-4 text-gray-400" />
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Codice SDI</label>
                      <p className="text-gray-900">{cliente.sdi}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Indirizzo */}
          {(cliente.indirizzo_fatturazione || cliente.citta_fatturazione) && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <MapPin className="w-5 h-5 mr-2" />
                Indirizzo di Fatturazione
              </h3>
              <div className="text-gray-900">
                {cliente.indirizzo_fatturazione && (
                  <p>{cliente.indirizzo_fatturazione}</p>
                )}
                {(cliente.cap_fatturazione || cliente.citta_fatturazione || cliente.provincia_fatturazione) && (
                  <p>
                    {cliente.cap_fatturazione && `${cliente.cap_fatturazione} `}
                    {cliente.citta_fatturazione}
                    {cliente.provincia_fatturazione && ` (${cliente.provincia_fatturazione})`}
                  </p>
                )}
                {cliente.stato_fatturazione && (
                  <p>{cliente.stato_fatturazione}</p>
                )}
              </div>
            </div>
          )}

          {/* Dimensionamento */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Users className="w-5 h-5 mr-2" />
              Dimensionamento
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {cliente.ula && (
                <div>
                  <label className="block text-sm font-medium text-gray-500">ULA</label>
                  <p className="text-gray-900">{cliente.ula}</p>
                </div>
              )}
              {cliente.attivo_bilancio && (
                <div>
                  <label className="block text-sm font-medium text-gray-500">Attivo di Bilancio</label>
                  <p className="text-gray-900">{formatCurrency(cliente.attivo_bilancio)}</p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-500">Dipendenti</label>
                <p className="text-gray-900">{cliente.numero_dipendenti || 0}</p>
              </div>
              {cliente.numero_volontari ? (
                <div>
                  <label className="block text-sm font-medium text-gray-500">Volontari</label>
                  <p className="text-gray-900">{cliente.numero_volontari}</p>
                </div>
              ) : null}
              {cliente.numero_collaboratori ? (
                <div>
                  <label className="block text-sm font-medium text-gray-500">Collaboratori</label>
                  <p className="text-gray-900">{cliente.numero_collaboratori}</p>
                </div>
              ) : null}
              {(cliente.matricola_inps || cliente.pat_inail) && (
                <>
                  {cliente.matricola_inps && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Matricola INPS</label>
                      <p className="text-gray-900">{cliente.matricola_inps}</p>
                    </div>
                  )}
                  {cliente.pat_inail && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500">PAT INAIL</label>
                      <p className="text-gray-900">{cliente.pat_inail}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Gestione Evolvi */}
          {(cliente.categoria_evolvi || cliente.scadenza_evolvi) && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Target className="w-5 h-5 mr-2" />
                Gestione Evolvi
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {cliente.categoria_evolvi && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Categoria</label>
                    <span className={`badge ${getCategoriaColor(cliente.categoria_evolvi)}`}>
                      {cliente.categoria_evolvi}
                    </span>
                  </div>
                )}
                {cliente.durata_evolvi && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Durata</label>
                    <p className="text-gray-900">{cliente.durata_evolvi}</p>
                  </div>
                )}
                {cliente.scadenza_evolvi && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Scadenza</label>
                    <p className="text-gray-900">{formatDate(cliente.scadenza_evolvi)}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Descrizione e Note */}
          {(cliente.descrizione || cliente.note) && (
            <div className="card p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                Informazioni Aggiuntive
              </h3>
              <div className="space-y-4">
                {cliente.descrizione && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-2">Descrizione</label>
                    <p className="text-gray-900 whitespace-pre-wrap">{cliente.descrizione}</p>
                  </div>
                )}
                {cliente.note && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-2">Note</label>
                    <p className="text-gray-900 whitespace-pre-wrap">{cliente.note}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Clock className="w-5 h-5 mr-2" />
              Informazioni di Sistema
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500">Creato il</label>
                <p className="text-gray-900">{formatDate(cliente.created_at)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Ultima modifica</label>
                <p className="text-gray-900">{formatDate(cliente.updated_at)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}