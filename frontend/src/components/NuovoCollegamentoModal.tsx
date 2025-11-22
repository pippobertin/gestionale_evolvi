'use client'

import { useState, useEffect } from 'react'
import { X, Save } from 'lucide-react'
import NuovaAziendaCollegataModal from './NuovaAziendaCollegataModal'

interface CollegamentoAziendale {
  id?: string
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
  numero_azienda: string
  ula?: number
  ultimo_fatturato?: number
  attivo_bilancio?: number
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onSave: (collegamento: CollegamentoAziendale) => Promise<void>
  clientiDisponibili: Cliente[]
  collegamentoInModifica?: CollegamentoAziendale | null
  onReloadClienti?: () => Promise<void>
  collegamentiEsistenti?: CollegamentoAziendale[]
}

const NuovoCollegamentoModal = ({ isOpen, onClose, onSave, clientiDisponibili, collegamentoInModifica, onReloadClienti, collegamentiEsistenti = [] }: Props) => {
  const [formData, setFormData] = useState<CollegamentoAziendale>({
    azienda_collegata_id: '',
    tipo_collegamento: 'COLLEGATA',
    percentuale_partecipazione: 0,
    diritti_voto: 0,
    influenza_dominante: false,
    note_collegamento: ''
  })
  const [saving, setSaving] = useState(false)
  const [showNuovaAziendaModal, setShowNuovaAziendaModal] = useState(false)

  // Filtra i clienti disponibili escludendo quelli già collegati
  const clientiFiltrati = clientiDisponibili.filter(cliente => {
    // Se stiamo modificando un collegamento esistente, non escludere l'azienda attualmente collegata
    if (collegamentoInModifica && cliente.id === collegamentoInModifica.azienda_collegata_id) {
      return true
    }

    // Escludi le aziende che sono già collegate
    const giaCollegata = collegamentiEsistenti.some(
      collegamento => collegamento.azienda_collegata_id === cliente.id
    )
    return !giaCollegata
  })

  useEffect(() => {
    if (collegamentoInModifica) {
      setFormData(collegamentoInModifica)
    } else {
      setFormData({
        azienda_collegata_id: '',
        tipo_collegamento: 'COLLEGATA',
        percentuale_partecipazione: 0,
        diritti_voto: 0,
        influenza_dominante: false,
        note_collegamento: ''
      })
    }
  }, [collegamentoInModifica, isOpen])

  const handleInputChange = (field: keyof CollegamentoAziendale, value: any) => {
    // Se l'utente seleziona "NUOVA_AZIENDA", apri il modal per creare una nuova azienda
    if (field === 'azienda_collegata_id' && value === 'NUOVA_AZIENDA') {
      setShowNuovaAziendaModal(true)
      return
    }

    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleNuovaAziendaCreata = async (nuovaAzienda: Cliente) => {
    // Aggiorna il form con la nuova azienda creata
    setFormData(prev => ({
      ...prev,
      azienda_collegata_id: nuovaAzienda.id
    }))
    setShowNuovaAziendaModal(false)

    // Ricarica la lista dei clienti disponibili
    if (onReloadClienti) {
      await onReloadClienti()
    }
  }

  const handleSave = async () => {

    if (!formData.azienda_collegata_id || formData.azienda_collegata_id === 'NUOVA_AZIENDA') {
      alert('Seleziona un\'azienda collegata valida')
      return
    }

    if (!formData.percentuale_partecipazione || formData.percentuale_partecipazione <= 0 || formData.percentuale_partecipazione > 100) {
      alert('La percentuale di partecipazione deve essere tra 1 e 100')
      return
    }

    // Validazione coerenza tipo collegamento vs percentuale
    if (formData.tipo_collegamento === 'ASSOCIATA' && formData.percentuale_partecipazione < 50) {
      alert('Per aziende associate la partecipazione deve essere almeno 50%')
      return
    }

    if (formData.tipo_collegamento === 'COLLEGATA' && formData.percentuale_partecipazione >= 50) {
      alert('Per aziende collegate la partecipazione deve essere inferiore al 50%')
      return
    }

    setSaving(true)
    try {
      // Aggiungi i dati dell'azienda collegata per il display
      const aziendaCollegata = clientiDisponibili.find(c => c.id === formData.azienda_collegata_id)
      if (aziendaCollegata) {
        formData.denominazione_collegata = aziendaCollegata.denominazione
        formData.ula_collegata = aziendaCollegata.ula
        formData.fatturato_collegato = aziendaCollegata.ultimo_fatturato
        formData.attivo_collegato = aziendaCollegata.attivo_bilancio
      }

      await onSave(formData)
      onClose()
    } catch (error) {
      console.error('❌ Errore nel salvataggio dal modal:', error)
      alert(`Errore nel salvataggio: ${error.message || 'Errore sconosciuto'}`)
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {collegamentoInModifica ? 'Modifica Collegamento' : 'Nuovo Collegamento Aziendale'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-yellow-800 mb-1">
              ⚖️ Normativa UE 2003/361/CE
            </h4>
            <p className="text-xs text-yellow-700">
              <strong>Collegata:</strong> 25-49.99% partecipazione (calcolo proporzionale)<br/>
              <strong>Associata:</strong> ≥50% partecipazione (calcolo 100%)
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Azienda Collegata *
              </label>
              <select
                value={formData.azienda_collegata_id}
                onChange={(e) => handleInputChange('azienda_collegata_id', e.target.value)}
                className="input"
                required
              >
                <option value="">Seleziona azienda</option>
                {clientiFiltrati.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>
                    {cliente.numero_azienda} - {cliente.denominazione}
                  </option>
                ))}
                <option value="NUOVA_AZIENDA" className="text-blue-600 font-medium">
                  ➕ Nuova azienda collegata
                </option>
              </select>
              {formData.azienda_collegata_id !== 'NUOVA_AZIENDA' && (
                <p className="text-xs text-blue-600 mt-1">
                  💡 Puoi creare una nuova azienda collegata selezionando l'ultima opzione
                </p>
              )}
              {clientiFiltrati.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  ⚠️ Tutte le aziende disponibili sono già collegate. Crea una nuova azienda per aggiungere un collegamento.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo di Collegamento *
              </label>
              <select
                value={formData.tipo_collegamento}
                onChange={(e) => handleInputChange('tipo_collegamento', e.target.value)}
                className="input"
                required
              >
                <option value="COLLEGATA">Collegata (25-49.99%)</option>
                <option value="ASSOCIATA">Associata (≥50%)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Percentuale Partecipazione (%) *
              </label>
              <input
                type="number"
                min="0.01"
                max="100"
                step="0.01"
                value={formData.percentuale_partecipazione || ''}
                onChange={(e) => handleInputChange('percentuale_partecipazione', parseFloat(e.target.value) || 0)}
                className="input"
                placeholder="25.50"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.tipo_collegamento === 'ASSOCIATA'
                  ? 'Deve essere almeno 50% per aziende associate'
                  : 'Deve essere tra 25% e 49.99% per aziende collegate'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Diritti di Voto (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={formData.diritti_voto || ''}
                onChange={(e) => handleInputChange('diritti_voto', parseFloat(e.target.value) || 0)}
                className="input"
                placeholder="30.00"
              />
            </div>
          </div>

          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.influenza_dominante || false}
                onChange={(e) => handleInputChange('influenza_dominante', e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Esercita influenza dominante
              </span>
            </label>
            <p className="text-xs text-gray-500 mt-1">
              Controllo attraverso nomina della maggioranza degli amministratori o influenza dominante nell'assemblea
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Note sul Collegamento
            </label>
            <textarea
              value={formData.note_collegamento || ''}
              onChange={(e) => handleInputChange('note_collegamento', e.target.value)}
              className="input min-h-[80px]"
              placeholder="Dettagli sui rapporti di partecipazione e controllo..."
              rows={3}
            />
          </div>
        </div>

        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? 'Salvataggio...' : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {collegamentoInModifica ? 'Aggiorna' : 'Salva'} Collegamento
              </>
            )}
          </button>
        </div>
      </div>

      {/* Modal per creare nuova azienda collegata */}
      <NuovaAziendaCollegataModal
        isOpen={showNuovaAziendaModal}
        onClose={() => setShowNuovaAziendaModal(false)}
        onSave={handleNuovaAziendaCreata}
      />
    </div>
  )
}

export default NuovoCollegamentoModal