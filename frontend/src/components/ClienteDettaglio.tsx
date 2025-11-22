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
  FolderOpen
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import ReferentiManager from './ReferentiManager'
import DocumentiManager from './DocumentiManager'

interface Cliente {
  id: string
  denominazione: string
  numero_azienda?: string
  partita_iva?: string
  rea?: string
  codice_fiscale?: string
  ateco_2025?: string
  ateco_descrizione?: string
  data_costituzione?: string
  email?: string
  pec?: string
  telefono?: string
  sito_web?: string
  coordinate_bancarie?: string
  banca_filiale?: string
  estremi_iscrizione_runts?: string
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
  categoria_evolvi?: 'CLIENTE_SPOT' | 'EVOLVI_BASE' | 'EVOLVI_FULL'
  durata_evolvi?: string
  scadenza_evolvi?: string
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
  const [currentTab, setCurrentTab] = useState('anagrafica')

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
    } catch (error) {
      console.error('Errore nel caricamento cliente:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return ''
    return new Date(dateString).toISOString().split('T')[0]
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

  const tabs = [
    { id: 'anagrafica', label: 'Dati Anagrafici', icon: Building2 },
    { id: 'contatti', label: 'Contatti', icon: Mail },
    { id: 'legale', label: 'Legale Rappresentante', icon: User },
    { id: 'dimensionamento', label: 'Dimensionamento', icon: Users },
    { id: 'collegamenti', label: 'Rapporti di Collegamento', icon: Hash },
    { id: 'gestione', label: 'Gestione', icon: FileText },
    { id: 'documenti', label: 'Documenti', icon: FolderOpen }
  ]

  const renderTabContent = () => {
    switch (currentTab) {
      case 'anagrafica':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Denominazione</label>
                <div className="input bg-gray-50 cursor-not-allowed">
                  {cliente.denominazione || '-'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Numero Azienda</label>
                <div className="input bg-gray-50 cursor-not-allowed">
                  {cliente.numero_azienda || '-'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Partita IVA</label>
                <div className="input bg-gray-50 cursor-not-allowed">
                  {cliente.partita_iva || '-'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Codice Fiscale</label>
                <div className="input bg-gray-50 cursor-not-allowed">
                  {cliente.codice_fiscale || '-'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">REA</label>
                <div className="input bg-gray-50 cursor-not-allowed">
                  {cliente.rea || '-'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Codice ATECO 2025</label>
                <div className="input bg-gray-50 cursor-not-allowed">
                  {cliente.ateco_2025 || '-'}
                </div>
                {cliente.ateco_descrizione && (
                  <p className="text-xs text-gray-600 mt-1">
                    <strong>Attività:</strong> {cliente.ateco_descrizione}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data Costituzione</label>
                <div className="input bg-gray-50 cursor-not-allowed">
                  {cliente.data_costituzione ? new Date(cliente.data_costituzione).toLocaleDateString('it-IT') : '-'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Estremi iscrizione al RUNTS</label>
                <div className="input bg-gray-50 cursor-not-allowed">
                  {cliente.estremi_iscrizione_runts || '-'}
                </div>
              </div>
            </div>

            {/* Sezione Dati Bancari */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Euro className="w-5 h-5 mr-2" />
                Dati Bancari e Fatturazione
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Coordinate Bancarie (IBAN)</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.coordinate_bancarie || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Banca/Filiale</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.banca_filiale || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Codice SDI</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.sdi || '-'}
                  </div>
                </div>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Indirizzo</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.indirizzo_fatturazione || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">CAP</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.cap_fatturazione || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Città</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.citta_fatturazione || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Provincia</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.provincia_fatturazione || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Stato</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.stato_fatturazione || '-'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )

      case 'contatti':
        return (
          <div className="space-y-6">
            {/* Contatti aziendali principali */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Mail className="w-5 h-5 mr-2" />
                Contatti Aziendali Principali
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.email || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">PEC</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.pec || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Telefono</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.telefono || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sito Web</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.sito_web || '-'}
                  </div>
                </div>
              </div>
            </div>

            {/* Referenti aziendali */}
            <div className="border-t pt-6">
              <ReferentiManager
                clienteId={cliente.id}
                isNewClient={false}
              />
            </div>
          </div>
        )

      case 'legale':
        return (
          <div className="space-y-6">
            {/* Dati Anagrafici */}
            <div>
              <h4 className="text-md font-semibold text-gray-900 mb-4 flex items-center">
                <User className="w-4 h-4 mr-2" />
                Dati Anagrafici
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nome</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.legale_rappresentante_nome || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Cognome</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.legale_rappresentante_cognome || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Codice Fiscale</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.legale_rappresentante_codice_fiscale || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Data di Nascita</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.legale_rappresentante_data_nascita ? new Date(cliente.legale_rappresentante_data_nascita).toLocaleDateString('it-IT') : '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Luogo di Nascita</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.legale_rappresentante_luogo_nascita || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Provincia di Nascita</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.legale_rappresentante_provincia_nascita || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Nazionalità</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.legale_rappresentante_nazionalita || '-'}
                  </div>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Indirizzo</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.legale_rappresentante_indirizzo || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">CAP</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.legale_rappresentante_cap || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Città</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.legale_rappresentante_citta || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Provincia</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.legale_rappresentante_provincia || '-'}
                  </div>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.legale_rappresentante_email || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Telefono</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.legale_rappresentante_telefono || '-'}
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Note</label>
                  <div className="input bg-gray-50 cursor-not-allowed min-h-[80px]">
                    {cliente.legale_rappresentante_note || '-'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )

      case 'dimensionamento':
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">ULA (Unità Lavorative Annue)</label>
                <div className="input bg-gray-50 cursor-not-allowed">
                  {cliente.ula || '-'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Ultimo Fatturato (€)</label>
                <div className="input bg-gray-50 cursor-not-allowed">
                  {cliente.ultimo_fatturato ? cliente.ultimo_fatturato.toLocaleString('it-IT') : '-'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Attivo di Bilancio (€)</label>
                <div className="input bg-gray-50 cursor-not-allowed">
                  {cliente.attivo_bilancio ? cliente.attivo_bilancio.toLocaleString('it-IT') : '-'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Numero Dipendenti</label>
                <div className="input bg-gray-50 cursor-not-allowed">
                  {cliente.numero_dipendenti || 0}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Numero Volontari</label>
                <div className="input bg-gray-50 cursor-not-allowed">
                  {cliente.numero_volontari || 0}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Numero Collaboratori</label>
                <div className="input bg-gray-50 cursor-not-allowed">
                  {cliente.numero_collaboratori || 0}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Matricola INPS</label>
                <div className="input bg-gray-50 cursor-not-allowed">
                  {cliente.matricola_inps || '-'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">PAT INAIL</label>
                <div className="input bg-gray-50 cursor-not-allowed">
                  {cliente.pat_inail || '-'}
                </div>
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
                Visualizzazione in sola lettura. Cliccare "Modifica" per gestire i rapporti di collegamento.
              </p>
            </div>
            <div className="text-center py-8 text-gray-500">
              <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Per visualizzare e gestire i rapporti di collegamento,</p>
              <p className="text-sm">utilizzare la modalità modifica cliente</p>
            </div>
          </div>
        )

      case 'gestione':
        const showEvolviFields = cliente.categoria_evolvi === 'EVOLVI_BASE' || cliente.categoria_evolvi === 'EVOLVI_FULL'

        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Categoria</label>
                <div className="input bg-gray-50 cursor-not-allowed">
                  {cliente.categoria_evolvi === 'CLIENTE_SPOT' ? 'Cliente spot' :
                   cliente.categoria_evolvi === 'EVOLVI_BASE' ? 'Evolvi Base' :
                   cliente.categoria_evolvi === 'EVOLVI_FULL' ? 'Evolvi Full' : '-'}
                </div>
              </div>

              {showEvolviFields && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Scadenza Evolvi</label>
                    <div className="input bg-gray-50 cursor-not-allowed">
                      {cliente.scadenza_evolvi ? new Date(cliente.scadenza_evolvi).toLocaleDateString('it-IT') : '-'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Durata Evolvi</label>
                    <div className="input bg-gray-50 cursor-not-allowed">
                      {cliente.durata_evolvi || '-'}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Informazione per clienti spot */}
            {cliente.categoria_evolvi === 'CLIENTE_SPOT' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center">
                  <FileText className="w-5 h-5 text-yellow-600 mr-2" />
                  <h4 className="text-yellow-800 font-medium">Cliente Spot</h4>
                </div>
                <p className="text-yellow-700 text-sm mt-2">
                  Cliente occasionale senza abbonamento Evolvi.
                </p>
              </div>
            )}

            {/* Informazione per clienti Evolvi */}
            {showEvolviFields && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center">
                  <FileText className="w-5 h-5 text-blue-600 mr-2" />
                  <h4 className="text-blue-800 font-medium">Cliente Evolvi</h4>
                </div>
                <p className="text-blue-700 text-sm mt-2">
                  Cliente con abbonamento attivo {cliente.categoria_evolvi === 'EVOLVI_BASE' ? 'Base' : 'Full'}.
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Descrizione</label>
              <div className="input bg-gray-50 cursor-not-allowed min-h-[80px]">
                {cliente.descrizione || '-'}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Note</label>
              <div className="input bg-gray-50 cursor-not-allowed min-h-[80px]">
                {cliente.note || '-'}
              </div>
            </div>
          </div>
        )

      case 'documenti':
        return (
          <div className="space-y-6">
            <DocumentiManager
              clienteId={cliente.id}
              isNewClient={false}
            />
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-hard max-w-7xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="gradient-primary text-white p-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Building2 className="w-6 h-6" />
            <h2 className="text-xl font-bold">
              {cliente.denominazione}
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onEdit(cliente)}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              title="Modifica cliente"
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

        {/* Tabs */}
        <div className="border-b border-gray-200 px-6">
          <div className="flex space-x-6 overflow-x-auto min-w-full">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setCurrentTab(tab.id)}
                  className={`py-4 px-2 border-b-2 font-medium text-sm flex items-center space-x-2 transition-colors flex-shrink-0 ${
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
        <div className="p-6 overflow-y-auto flex-1">
          {renderTabContent()}
        </div>
      </div>
    </div>
  )
}