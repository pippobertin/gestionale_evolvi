'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Users, Search, RefreshCw, ExternalLink } from 'lucide-react'
import ConsulenteDettaglio from './ConsulenteDettaglio'

interface Consulente {
  id: string
  denominazione: string
  partita_iva: string | null
  citta: string | null
  provincia: string | null
  telefono: string | null
  email: string | null
}

interface ConsulentiContentProps {
  onNavigate?: (section: string, params?: any) => void
}

export default function ConsulentiContent({ onNavigate }: ConsulentiContentProps) {
  const [consulenti, setConsulenti] = useState<Consulente[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedConsulenteId, setSelectedConsulenteId] = useState<string | null>(null)
  const [showDettaglio, setShowDettaglio] = useState(false)

  const fetchConsulenti = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('scadenze_bandi_clienti')
        .select('*')
        .eq('categoria_evolvi', 'CONSULENTI')
        .order('denominazione', { ascending: true })

      if (error) {
        console.error('Supabase error:', error.message, error.details, error.hint)
        throw error
      }
      setConsulenti((data || []).map((d: any) => ({
        id: d.id,
        denominazione: d.denominazione,
        partita_iva: d.partita_iva,
        citta: d.citta,
        provincia: d.provincia,
        telefono: d.telefono,
        email: d.email
      })))
    } catch (error) {
      console.error('Errore caricamento consulenti:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConsulenti()
  }, [fetchConsulenti])

  const filtered = consulenti.filter(c =>
    c.denominazione.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.citta && c.citta.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const handleOpenDettaglio = (id: string) => {
    setSelectedConsulenteId(id)
    setShowDettaglio(true)
  }

  const handleCloseDettaglio = () => {
    setShowDettaglio(false)
    setSelectedConsulenteId(null)
    fetchConsulenti()
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-purple-600" />
          <h2 className="text-lg font-semibold text-gray-900">Consulenti</h2>
          <span className="bg-purple-100 text-purple-700 text-xs font-medium px-2 py-0.5 rounded-full">
            {filtered.length}
          </span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cerca consulente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-9 w-full sm:w-64"
            />
          </div>
          <button
            onClick={fetchConsulenti}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Aggiorna"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabella */}
      <div className="bg-white rounded-lg card-shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <RefreshCw className="w-6 h-6 animate-spin text-gray-400 mx-auto" />
            <p className="text-sm text-gray-500 mt-2">Caricamento consulenti...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-10 h-10 text-gray-300 mx-auto" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              {searchTerm ? `Nessun risultato per "${searchTerm}"` : 'Nessun consulente trovato'}
            </h3>
            {!searchTerm && (
              <p className="mt-1 text-sm text-gray-500">
                I consulenti vengono aggiunti assegnando la categoria "Consulenti" a un cliente.
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Denominazione</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">P.IVA</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Città</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Prov.</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Telefono</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Azioni</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleOpenDettaglio(c.id)}
                  >
                    <td className="px-4 py-2 text-sm font-medium text-gray-900 hover:text-blue-600">
                      {c.denominazione}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">{c.partita_iva || '-'}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{c.citta || '-'}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{c.provincia || '-'}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{c.telefono || '-'}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{c.email || '-'}</td>
                    <td className="px-4 py-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleOpenDettaglio(c.id)
                        }}
                        className="text-gray-400 hover:text-purple-600 transition-colors"
                        title="Apri dettaglio consulente"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Dettaglio Consulente */}
      {showDettaglio && selectedConsulenteId && (
        <ConsulenteDettaglio
          consulenteId={selectedConsulenteId}
          isOpen={showDettaglio}
          onClose={handleCloseDettaglio}
          onNavigate={onNavigate}
        />
      )}
    </div>
  )
}
