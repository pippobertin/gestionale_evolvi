'use client'

import React, { useState, useEffect } from 'react'
import { FileText, Plus, RefreshCw, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ContrattoEvolvi } from '@/types/evolvi-contract'
import EvolviContractCard from './EvolviContractCard'
import EvolviContractModal from './EvolviContractModal'

interface ContrattiEvolviManagerProps {
  clienteId: string
  clienteDenominazione: string
}

export default function ContrattiEvolviManager({ clienteId, clienteDenominazione }: ContrattiEvolviManagerProps) {
  const [contratti, setContratti] = useState<ContrattoEvolvi[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    if (clienteId) {
      loadContratti()
    }
  }, [clienteId])

  const loadContratti = async () => {
    if (!clienteId) return

    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('scadenze_bandi_contratti_evolvi')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError
      setContratti(data || [])
    } catch (err: any) {
      console.error('Errore caricamento contratti Evolvi:', err)
      setError(err.message || 'Errore nel caricamento dei contratti')
    } finally {
      setLoading(false)
    }
  }

  const handleSuccess = () => {
    setShowModal(false)
    loadContratti()
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-medium text-gray-900 flex items-center">
          <FileText className="w-5 h-5 mr-2" />
          Contratti Evolvi
        </h4>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={loadContratti}
            className="btn-secondary text-sm py-2 px-3"
            disabled={loading}
            title="Aggiorna lista"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="btn-primary text-sm py-2 px-3"
            disabled={loading}
          >
            <Plus className="w-4 h-4 mr-1" />
            Nuovo Contratto Evolvi
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Contract List */}
      <div className="space-y-3">
        {loading && contratti.length === 0 ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500 mx-auto"></div>
            <p className="text-sm text-gray-500 mt-2">Caricamento contratti...</p>
          </div>
        ) : contratti.length === 0 ? (
          <div className="text-center py-8 text-gray-500 border border-gray-200 rounded-lg">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nessun contratto Evolvi presente</p>
            <p className="text-xs mt-1">Clicca "Nuovo Contratto Evolvi" per crearne uno</p>
          </div>
        ) : (
          contratti.map((contratto) => (
            <EvolviContractCard
              key={contratto.id}
              contract={contratto}
              onRefresh={loadContratti}
            />
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <EvolviContractModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          onSuccess={handleSuccess}
          clienteId={clienteId}
          clienteDenominazione={clienteDenominazione}
        />
      )}
    </div>
  )
}
