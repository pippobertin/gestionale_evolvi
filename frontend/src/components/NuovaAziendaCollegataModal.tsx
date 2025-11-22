'use client'

import { useState, useEffect } from 'react'
import { X, Save, Building2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface NuovaAziendaData {
  denominazione: string
  partita_iva?: string
  ultimo_fatturato?: number
  attivo_bilancio?: number
  ula?: number
}

interface NuovaAziendaCollegataModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (azienda: { id: string; denominazione: string; numero_azienda: string }) => void
}

export default function NuovaAziendaCollegataModal({ isOpen, onClose, onSave }: NuovaAziendaCollegataModalProps) {
  const [formData, setFormData] = useState<NuovaAziendaData>({
    denominazione: '',
    partita_iva: '',
    ultimo_fatturato: undefined,
    attivo_bilancio: undefined,
    ula: undefined
  })
  const [loading, setLoading] = useState(false)
  const [dimensioneCalcolata, setDimensioneCalcolata] = useState<string>('')

  // Calcola automaticamente la dimensione quando cambiano i valori
  useEffect(() => {
    if (formData.ula !== undefined || formData.ultimo_fatturato !== undefined || formData.attivo_bilancio !== undefined) {
      const dimensione = calcolaDimensione(formData.ula, formData.ultimo_fatturato, formData.attivo_bilancio)
      setDimensioneCalcolata(dimensione)
    }
  }, [formData.ula, formData.ultimo_fatturato, formData.attivo_bilancio])

  const calcolaDimensione = (ula?: number, fatturato?: number, attivo?: number): string => {
    if (!ula && !fatturato && !attivo) return ''

    const ulaVal = ula || 0
    const fatturatoVal = fatturato || 0
    const attivoVal = attivo || 0

    if (ulaVal < 10 && (fatturatoVal <= 2000000 || attivoVal <= 2000000)) return 'MICRO'
    if (ulaVal < 50 && (fatturatoVal <= 10000000 || attivoVal <= 10000000)) return 'PICCOLA'
    if (ulaVal < 250 && (fatturatoVal <= 50000000 || attivoVal <= 43000000)) return 'MEDIA'
    return 'GRANDE'
  }

  const handleInputChange = (field: keyof NuovaAziendaData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSave = async () => {
    if (!formData.denominazione.trim()) {
      alert('La denominazione è obbligatoria')
      return
    }

    // Prepara i dati per il salvataggio (fuori dal try per il debug)
    const dataToSave = {
      denominazione: formData.denominazione.trim(),
      partita_iva: formData.partita_iva || null,
      ultimo_fatturato: formData.ultimo_fatturato || null,
      attivo_bilancio: formData.attivo_bilancio || null,
      ula: formData.ula || null,
      stato_fatturazione: 'Italia' // Default
      // Rimosso 'dimensione' perché è una colonna generata automaticamente
    }

    setLoading(true)
    try {

      const { data, error } = await supabase
        .from('scadenze_bandi_clienti')
        .insert([dataToSave])
        .select('id, denominazione, numero_azienda')
        .single()

      if (error) {
        console.error('❌ Errore database:', error)
        throw error
      }


      // Chiama la callback con i dati dell'azienda creata
      onSave(data)

      // Reset del form
      setFormData({
        denominazione: '',
        partita_iva: '',
        ultimo_fatturato: undefined,
        attivo_bilancio: undefined,
        ula: undefined
      })

      onClose()
    } catch (error) {
      console.error('❌ Errore nel salvataggio azienda collegata:', error)
      console.error('📋 Dati inviati:', dataToSave)
      alert(`Errore nel salvataggio della nuova azienda: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-hard max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="gradient-primary text-white p-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Building2 className="w-6 h-6" />
            <h2 className="text-xl font-bold">Nuova Azienda Collegata</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-800 mb-2">
              ℹ️ Dati Essenziali per Collegamento
            </h4>
            <p className="text-xs text-blue-700">
              Inserisci i dati minimi necessari per creare il collegamento aziendale.
              Potrai completare tutte le altre informazioni successivamente.
            </p>
          </div>

          {/* Dati Anagrafici */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Dati Anagrafici</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Denominazione *
                </label>
                <input
                  type="text"
                  value={formData.denominazione}
                  onChange={(e) => handleInputChange('denominazione', e.target.value)}
                  className="input"
                  placeholder="Ragione sociale completa"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Partita IVA
                </label>
                <input
                  type="text"
                  value={formData.partita_iva || ''}
                  onChange={(e) => handleInputChange('partita_iva', e.target.value)}
                  className="input"
                  placeholder="12345678901"
                />
              </div>
            </div>
          </div>

          {/* Dimensionamento */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Dimensionamento</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ULA (Unità Lavorative Annue)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.ula || ''}
                  onChange={(e) => handleInputChange('ula', parseFloat(e.target.value) || undefined)}
                  className="input"
                  placeholder="2.5"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ultimo Fatturato (€)
                </label>
                <input
                  type="number"
                  value={formData.ultimo_fatturato || ''}
                  onChange={(e) => handleInputChange('ultimo_fatturato', parseFloat(e.target.value) || undefined)}
                  className="input"
                  placeholder="325000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Attivo di Bilancio (€)
                </label>
                <input
                  type="number"
                  value={formData.attivo_bilancio || ''}
                  onChange={(e) => handleInputChange('attivo_bilancio', parseFloat(e.target.value) || undefined)}
                  className="input"
                  placeholder="140000"
                />
              </div>
            </div>

            {/* Dimensione calcolata */}
            {dimensioneCalcolata && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-green-800 mb-2">
                  📊 Dimensione Aziendale Calcolata
                </h4>
                <span className="text-lg font-bold text-green-600">
                  {dimensioneCalcolata}
                </span>
                <p className="text-xs text-green-600 mt-1">
                  Secondo i criteri UE 2003/361/CE
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            className="btn-secondary"
            disabled={loading}
          >
            Annulla
          </button>
          <button
            onClick={handleSave}
            className="btn-primary flex items-center space-x-2"
            disabled={loading || !formData.denominazione.trim()}
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{loading ? 'Salvando...' : 'Crea Azienda'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}