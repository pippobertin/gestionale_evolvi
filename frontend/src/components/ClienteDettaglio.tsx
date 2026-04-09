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
  Receipt,
  Shield,
  ClipboardCheck
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import ReferentiManager from './ReferentiManager'
import ContrattiEvolviManager from './ContrattiEvolviManager'
import EvolviInvoicesContent from './EvolviInvoicesContent'
import DocumentiAmministrativiManager from './DocumentiAmministrativiManager'
import ContractTrackingPanel from './ContractTrackingPanel'

interface CollegamentoAziendale {
  id: string
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
  categoria_evolvi?: 'CLIENTE_SPOT' | 'EVOLVI'
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
  const [collegamenti, setCollegamenti] = useState<CollegamentoAziendale[]>([])
  const [loadingCollegamenti, setLoadingCollegamenti] = useState(false)

  useEffect(() => {
    if (isOpen && clienteId) {
      fetchCliente()
      loadCollegamenti()
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

  const loadCollegamenti = async () => {
    if (!clienteId) return

    setLoadingCollegamenti(true)
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
    } finally {
      setLoadingCollegamenti(false)
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

  const isEvolviClient = cliente.categoria_evolvi === 'EVOLVI'

  const baseTabs = [
    { id: 'anagrafica', label: 'Dati Anagrafici', icon: Building2 },
    { id: 'contatti', label: 'Contatti', icon: Mail },
    { id: 'legale', label: 'Legale Rappresentante', icon: User },
    { id: 'dimensionamento', label: 'Dimensionamento', icon: Users },
    { id: 'collegamenti', label: 'Rapporti di Collegamento', icon: Hash },
    { id: 'gestione', label: 'Gestione', icon: FileText },
    { id: 'doc_amministrativi', label: 'Doc. Amministrativi', icon: Shield }
  ]

  const evolviTabs = isEvolviClient ? [
    { id: 'contratti_evolvi', label: 'Contratti Evolvi', icon: ClipboardCheck },
    { id: 'fatturazione', label: 'Fatturazione', icon: Receipt }
  ] : []

  const tabs = [...baseTabs, ...evolviTabs]

  const renderTabContent = () => {
    switch (currentTab) {
      case 'anagrafica':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Denominazione</label>
                <div className="input bg-gray-50 cursor-not-allowed">
                  {cliente.denominazione || '-'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Numero Azienda</label>
                <div className="input bg-gray-50 cursor-not-allowed">
                  {cliente.numero_azienda || '-'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Partita IVA</label>
                <div className="input bg-gray-50 cursor-not-allowed">
                  {cliente.partita_iva || '-'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Codice Fiscale</label>
                <div className="input bg-gray-50 cursor-not-allowed">
                  {cliente.codice_fiscale || '-'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">REA</label>
                <div className="input bg-gray-50 cursor-not-allowed">
                  {cliente.rea || '-'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Codice ATECO 2025</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Data Costituzione</label>
                <div className="input bg-gray-50 cursor-not-allowed">
                  {cliente.data_costituzione ? new Date(cliente.data_costituzione).toLocaleDateString('it-IT') : '-'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estremi iscrizione al RUNTS</label>
                <div className="input bg-gray-50 cursor-not-allowed">
                  {cliente.estremi_iscrizione_runts || '-'}
                </div>
              </div>
            </div>

            {/* Sezione Dati Bancari */}
            <div className="border-t pt-3">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                <Euro className="w-4 h-4 mr-2" />
                Dati Bancari e Fatturazione
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Coordinate Bancarie (IBAN)</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.coordinate_bancarie || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Banca/Filiale</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.banca_filiale || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Codice SDI</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.sdi || '-'}
                  </div>
                </div>
              </div>
            </div>

            {/* Indirizzo */}
            <div className="border-t pt-3">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                <MapPin className="w-4 h-4 mr-2" />
                Indirizzo di Fatturazione
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Indirizzo</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.indirizzo_fatturazione || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CAP</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.cap_fatturazione || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Città</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.citta_fatturazione || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Provincia</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.provincia_fatturazione || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stato</label>
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
          <div className="space-y-3">
            {/* Contatti aziendali principali */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                <Mail className="w-4 h-4 mr-2" />
                Contatti Aziendali Principali
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.email || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PEC</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.pec || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.telefono || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sito Web</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.sito_web || '-'}
                  </div>
                </div>
              </div>
            </div>

            {/* Referenti aziendali */}
            <div className="border-t pt-3">
              <ReferentiManager
                clienteId={cliente.id}
                isNewClient={false}
              />
            </div>
          </div>
        )

      case 'legale':
        return (
          <div className="space-y-3">
            {/* Dati Anagrafici */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                <User className="w-4 h-4 mr-2" />
                Dati Anagrafici
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.legale_rappresentante_nome || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cognome</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.legale_rappresentante_cognome || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Codice Fiscale</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.legale_rappresentante_codice_fiscale || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data di Nascita</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.legale_rappresentante_data_nascita ? new Date(cliente.legale_rappresentante_data_nascita).toLocaleDateString('it-IT') : '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Luogo di Nascita</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.legale_rappresentante_luogo_nascita || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Provincia di Nascita</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.legale_rappresentante_provincia_nascita || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nazionalità</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.legale_rappresentante_nazionalita || '-'}
                  </div>
                </div>
              </div>
            </div>

            {/* Indirizzo */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                <MapPin className="w-4 h-4 mr-2" />
                Indirizzo di Residenza
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Indirizzo</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.legale_rappresentante_indirizzo || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CAP</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.legale_rappresentante_cap || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Città</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.legale_rappresentante_citta || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Provincia</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.legale_rappresentante_provincia || '-'}
                  </div>
                </div>
              </div>
            </div>

            {/* Contatti */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                <Mail className="w-4 h-4 mr-2" />
                Contatti
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.legale_rappresentante_email || '-'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
                  <div className="input bg-gray-50 cursor-not-allowed">
                    {cliente.legale_rappresentante_telefono || '-'}
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                  <div className="input bg-gray-50 cursor-not-allowed min-h-[60px]">
                    {cliente.legale_rappresentante_note || '-'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )

      case 'dimensionamento':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ULA (Unità Lavorative Annue)</label>
                <div className="input bg-gray-50 cursor-not-allowed">
                  {cliente.ula || '-'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ultimo Fatturato (€)</label>
                <div className="input bg-gray-50 cursor-not-allowed">
                  {cliente.ultimo_fatturato ? cliente.ultimo_fatturato.toLocaleString('it-IT') : '-'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Attivo di Bilancio (€)</label>
                <div className="input bg-gray-50 cursor-not-allowed">
                  {cliente.attivo_bilancio ? cliente.attivo_bilancio.toLocaleString('it-IT') : '-'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Numero Dipendenti</label>
                <div className="input bg-gray-50 cursor-not-allowed">
                  {cliente.numero_dipendenti || 0}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Numero Volontari</label>
                <div className="input bg-gray-50 cursor-not-allowed">
                  {cliente.numero_volontari || 0}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Numero Collaboratori</label>
                <div className="input bg-gray-50 cursor-not-allowed">
                  {cliente.numero_collaboratori || 0}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Matricola INPS</label>
                <div className="input bg-gray-50 cursor-not-allowed">
                  {cliente.matricola_inps || '-'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">PAT INAIL</label>
                <div className="input bg-gray-50 cursor-not-allowed">
                  {cliente.pat_inail || '-'}
                </div>
              </div>
            </div>
          </div>
        )

      case 'collegamenti':
        return (
          <div className="space-y-3">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <h4 className="text-sm font-medium text-yellow-800 mb-2">
                ⚖️ Rapporti di Collegamento/Controllo (UE 2003/361/CE)
              </h4>
              <p className="text-xs text-yellow-700">
                Visualizzazione in sola lettura. Cliccare l'icona "Modifica" in alto per gestire i rapporti di collegamento.
              </p>
            </div>

            {/* Lista collegamenti esistenti */}
            <div className="border rounded-lg">
              <div className="px-4 py-3 border-b bg-gray-50">
                <h4 className="font-medium text-gray-900">Rapporti di Collegamento Attivi</h4>
              </div>

              <div className="p-4">
                {loadingCollegamenti ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
                    <p className="text-sm text-gray-500 mt-2">Caricamento collegamenti...</p>
                  </div>
                ) : collegamenti.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nessun collegamento aziendale configurato</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {collegamenti.map((collegamento, index) => (
                      <div key={collegamento.id || index} className="border rounded-lg p-3 bg-gray-50">
                        <div className="flex items-start">
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

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                              <div>
                                <span className="text-gray-500">Partecipazione:</span>
                                <span className="ml-1 font-medium">
                                  {collegamento.percentuale_partecipazione}%
                                </span>
                              </div>
                              {collegamento.ula_collegata !== undefined && collegamento.ula_collegata !== null && (
                                <div>
                                  <span className="text-gray-500">ULA:</span>
                                  <span className="ml-1 font-medium">{collegamento.ula_collegata}</span>
                                </div>
                              )}
                              {collegamento.fatturato_collegato !== undefined && collegamento.fatturato_collegato !== null && (
                                <div>
                                  <span className="text-gray-500">Fatturato:</span>
                                  <span className="ml-1 font-medium">
                                    €{collegamento.fatturato_collegato.toLocaleString('it-IT')}
                                  </span>
                                </div>
                              )}
                              {collegamento.attivo_collegato !== undefined && collegamento.attivo_collegato !== null && (
                                <div>
                                  <span className="text-gray-500">Attivo:</span>
                                  <span className="ml-1 font-medium">
                                    €{collegamento.attivo_collegato.toLocaleString('it-IT')}
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
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Calcolo dimensione aggregata - solo se ci sono collegamenti */}
            {collegamenti.length > 0 && cliente && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <h4 className="text-sm font-medium text-blue-800 mb-2">
                  📊 Informazioni Dimensione Aggregata
                </h4>
                <div className="text-sm text-blue-700">
                  <p>Il cliente ha {collegamenti.length} collegamento{collegamenti.length > 1 ? 'i' : ''} aziendale{collegamenti.length > 1 ? 'i' : ''} attivo{collegamenti.length > 1 ? 'i' : ''}.</p>
                  <p className="mt-1">La dimensione aggregata viene calcolata secondo la normativa UE 2003/361/CE considerando:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Azienda principale: {cliente.ula || 0} ULA, €{(cliente.ultimo_fatturato || 0).toLocaleString('it-IT')}</li>
                    {collegamenti.map((col, idx) => (
                      <li key={idx}>
                        {col.denominazione_collegata}: {col.tipo_collegamento === 'ASSOCIATA' ? '100%' : `${col.percentuale_partecipazione}%`}
                        {' '}({col.ula_collegata || 0} ULA, €{(col.fatturato_collegato || 0).toLocaleString('it-IT')})
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs">
                    Clicca "Modifica" in alto per modificare i rapporti di collegamento e visualizzare la dimensione calcolata.
                  </p>
                </div>
              </div>
            )}
          </div>
        )

      case 'gestione':
        const showEvolviFields = cliente.categoria_evolvi === 'EVOLVI'

        return (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                <div className="input bg-gray-50 cursor-not-allowed">
                  {cliente.categoria_evolvi === 'CLIENTE_SPOT' ? 'Spot' :
                   cliente.categoria_evolvi === 'EVOLVI' ? 'Evolvi' : '-'}
                </div>
              </div>

              {showEvolviFields && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Scadenza Evolvi</label>
                    <div className="input bg-gray-50 cursor-not-allowed">
                      {cliente.scadenza_evolvi ? new Date(cliente.scadenza_evolvi).toLocaleDateString('it-IT') : '-'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Durata Evolvi</label>
                    <div className="input bg-gray-50 cursor-not-allowed">
                      {cliente.durata_evolvi || '-'}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Informazione per clienti spot */}
            {(cliente.categoria_evolvi === 'CLIENTE_SPOT' || !cliente.categoria_evolvi) && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
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
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center">
                  <FileText className="w-5 h-5 text-blue-600 mr-2" />
                  <h4 className="text-blue-800 font-medium">Cliente Evolvi</h4>
                </div>
                <p className="text-blue-700 text-sm mt-2">
                  Cliente con abbonamento Metodo Evolvi attivo.
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descrizione</label>
              <div className="input bg-gray-50 cursor-not-allowed min-h-[60px]">
                {cliente.descrizione || '-'}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
              <div className="input bg-gray-50 cursor-not-allowed min-h-[60px]">
                {cliente.note || '-'}
              </div>
            </div>
          </div>
        )

      case 'doc_amministrativi':
        return (
          <div className="space-y-3">
            <DocumentiAmministrativiManager clienteId={cliente.id} />
          </div>
        )

      case 'contratti_evolvi':
        return (
          <div className="space-y-3">
            <ContrattiEvolviManager
              clienteId={cliente.id}
              clienteDenominazione={cliente.denominazione}
            />
          </div>
        )

      case 'fatturazione':
        return (
          <div className="space-y-3">
            <EvolviInvoicesContent clienteId={cliente.id} />
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-hard max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="gradient-primary text-white p-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Building2 className="w-4 h-4" />
            <h2 className="text-sm font-semibold">
              {cliente.denominazione}
            </h2>
          </div>
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => onEdit(cliente)}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              title="Modifica cliente"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 px-4">
          <div className="flex space-x-3 overflow-x-auto min-w-full">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setCurrentTab(tab.id)}
                  className={`py-2 px-1.5 border-b-2 font-medium text-xs flex items-center space-x-1.5 transition-colors flex-shrink-0 ${
                    currentTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1">
          {renderTabContent()}
        </div>
      </div>
    </div>
  )
}