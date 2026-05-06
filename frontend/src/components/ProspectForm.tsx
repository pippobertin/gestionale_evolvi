'use client'

import { useState, useEffect } from 'react'
import {
  X,
  Save,
  Building2,
  MapPin,
  User,
  StickyNote
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  Prospect,
  FONTI_ACQUISIZIONE,
  DIMENSIONI
} from '@/types/prospect'

interface ProspectFormProps {
  prospect?: Prospect
  isOpen: boolean
  onClose: () => void
  onSave: () => void
}

export default function ProspectForm({ prospect, isOpen, onClose, onSave }: ProspectFormProps) {
  const [formData, setFormData] = useState<Record<string, any>>({
    denominazione: '',
    partita_iva: '',
    codice_fiscale: '',
    email: '',
    pec: '',
    telefono: '',
    sito_web: '',
    indirizzo: '',
    cap: '',
    citta: '',
    provincia: '',
    settore: '',
    ateco_2025: '',
    dimensione: '',
    numero_dipendenti: '',
    ultimo_fatturato: '',
    legale_rappresentante_nome: '',
    legale_rappresentante_cognome: '',
    legale_rappresentante_email: '',
    legale_rappresentante_telefono: '',
    fonte_acquisizione: '',
    fonte_dettaglio: '',
    assegnato_a: '',
    note: ''
  })
  const [loading, setSaving] = useState(false)
  const [currentTab, setCurrentTab] = useState('anagrafica')

  useEffect(() => {
    if (prospect) {
      setFormData({
        denominazione: prospect.denominazione || '',
        partita_iva: prospect.partita_iva || '',
        codice_fiscale: prospect.codice_fiscale || '',
        email: prospect.email || '',
        pec: prospect.pec || '',
        telefono: prospect.telefono || '',
        sito_web: prospect.sito_web || '',
        indirizzo: prospect.indirizzo || '',
        cap: prospect.cap || '',
        citta: prospect.citta || '',
        provincia: prospect.provincia || '',
        settore: prospect.settore || '',
        ateco_2025: prospect.ateco_2025 || '',
        dimensione: prospect.dimensione || '',
        numero_dipendenti: prospect.numero_dipendenti ?? '',
        ultimo_fatturato: prospect.ultimo_fatturato ?? '',
        legale_rappresentante_nome: prospect.legale_rappresentante_nome || '',
        legale_rappresentante_cognome: prospect.legale_rappresentante_cognome || '',
        legale_rappresentante_email: prospect.legale_rappresentante_email || '',
        legale_rappresentante_telefono: prospect.legale_rappresentante_telefono || '',
        fonte_acquisizione: prospect.fonte_acquisizione || '',
        fonte_dettaglio: prospect.fonte_dettaglio || '',
        assegnato_a: prospect.assegnato_a || '',
        note: prospect.note || ''
      })
    } else {
      setFormData({
        denominazione: '',
        partita_iva: '',
        codice_fiscale: '',
        email: '',
        pec: '',
        telefono: '',
        sito_web: '',
        indirizzo: '',
        cap: '',
        citta: '',
        provincia: '',
        settore: '',
        ateco_2025: '',
        dimensione: '',
        numero_dipendenti: '',
        ultimo_fatturato: '',
        legale_rappresentante_nome: '',
        legale_rappresentante_cognome: '',
        legale_rappresentante_email: '',
        legale_rappresentante_telefono: '',
        fonte_acquisizione: '',
        fonte_dettaglio: '',
        assegnato_a: '',
        note: ''
      })
    }
  }, [prospect])

  const handleInputChange = (field: string, value: any) => {
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

    setSaving(true)
    try {
      const dataToSave: Record<string, any> = {
        denominazione: formData.denominazione.trim(),
        partita_iva: formData.partita_iva || null,
        codice_fiscale: formData.codice_fiscale || null,
        email: formData.email || null,
        pec: formData.pec || null,
        telefono: formData.telefono || null,
        sito_web: formData.sito_web || null,
        indirizzo: formData.indirizzo || null,
        cap: formData.cap || null,
        citta: formData.citta || null,
        provincia: formData.provincia || null,
        settore: formData.settore || null,
        ateco_2025: formData.ateco_2025 || null,
        dimensione: formData.dimensione || null,
        numero_dipendenti: formData.numero_dipendenti !== '' ? parseInt(formData.numero_dipendenti) : null,
        ultimo_fatturato: formData.ultimo_fatturato !== '' ? parseFloat(formData.ultimo_fatturato) : null,
        legale_rappresentante_nome: formData.legale_rappresentante_nome || null,
        legale_rappresentante_cognome: formData.legale_rappresentante_cognome || null,
        legale_rappresentante_email: formData.legale_rappresentante_email || null,
        legale_rappresentante_telefono: formData.legale_rappresentante_telefono || null,
        fonte_acquisizione: formData.fonte_acquisizione || null,
        fonte_dettaglio: formData.fonte_dettaglio || null,
        assegnato_a: formData.assegnato_a || null,
        note: formData.note || null
      }

      if (prospect?.id) {
        const { error } = await supabase
          .from('scadenze_bandi_prospect')
          .update(dataToSave)
          .eq('id', prospect.id)

        if (error) throw error
      } else {
        dataToSave.stato = 'bozza'
        dataToSave.profiling_data = {}
        dataToSave.profiling_score = 0
        const { error } = await supabase
          .from('scadenze_bandi_prospect')
          .insert([dataToSave])

        if (error) throw error
      }

      onSave()
      onClose()
    } catch (error) {
      console.error('Errore nel salvataggio:', error)
      alert('Errore nel salvataggio del prospect')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const tabs = [
    { id: 'anagrafica', label: 'Anagrafica', icon: Building2 },
    { id: 'dettagli', label: 'Dettagli', icon: MapPin },
    { id: 'legale', label: 'Legale Rappresentante', icon: User },
    { id: 'note', label: 'Note', icon: StickyNote }
  ]

  const renderTabContent = () => {
    switch (currentTab) {
      case 'anagrafica':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Denominazione *
                </label>
                <input
                  type="text"
                  value={formData.denominazione}
                  onChange={(e) => handleInputChange('denominazione', e.target.value)}
                  className="input"
                  placeholder="Ragione sociale"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Partita IVA
                </label>
                <input
                  type="text"
                  value={formData.partita_iva}
                  onChange={(e) => handleInputChange('partita_iva', e.target.value)}
                  className="input"
                  placeholder="12345678901"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Codice Fiscale
                </label>
                <input
                  type="text"
                  value={formData.codice_fiscale}
                  onChange={(e) => handleInputChange('codice_fiscale', e.target.value)}
                  className="input"
                  placeholder="RSSMRA80A01H501Z"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="input"
                  placeholder="info@azienda.it"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  PEC
                </label>
                <input
                  type="email"
                  value={formData.pec}
                  onChange={(e) => handleInputChange('pec', e.target.value)}
                  className="input"
                  placeholder="pec@azienda.pec.it"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Telefono
                </label>
                <input
                  type="tel"
                  value={formData.telefono}
                  onChange={(e) => handleInputChange('telefono', e.target.value)}
                  className="input"
                  placeholder="+39 06 12345678"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sito Web
              </label>
              <input
                type="url"
                value={formData.sito_web}
                onChange={(e) => handleInputChange('sito_web', e.target.value)}
                className="input"
                placeholder="https://www.azienda.it"
              />
            </div>
          </div>
        )

      case 'dettagli':
        return (
          <div className="space-y-3">
            {/* Indirizzo */}
            <div className="border-b pb-3">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center">
                <MapPin className="w-4 h-4 mr-2" />
                Indirizzo
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Indirizzo</label>
                  <input
                    type="text"
                    value={formData.indirizzo}
                    onChange={(e) => handleInputChange('indirizzo', e.target.value)}
                    className="input"
                    placeholder="Via Roma, 123"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CAP</label>
                  <input
                    type="text"
                    value={formData.cap}
                    onChange={(e) => handleInputChange('cap', e.target.value)}
                    className="input"
                    placeholder="00100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Citta</label>
                  <input
                    type="text"
                    value={formData.citta}
                    onChange={(e) => handleInputChange('citta', e.target.value)}
                    className="input"
                    placeholder="Roma"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Provincia</label>
                  <input
                    type="text"
                    value={formData.provincia}
                    onChange={(e) => handleInputChange('provincia', e.target.value)}
                    className="input"
                    placeholder="RM"
                    maxLength={2}
                  />
                </div>
              </div>
            </div>

            {/* Dettagli Aziendali */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center">
                <Building2 className="w-4 h-4 mr-2" />
                Dettagli Aziendali
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Settore</label>
                  <input
                    type="text"
                    value={formData.settore}
                    onChange={(e) => handleInputChange('settore', e.target.value)}
                    className="input"
                    placeholder="Es: Manifatturiero"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Codice ATECO 2025</label>
                  <input
                    type="text"
                    value={formData.ateco_2025}
                    onChange={(e) => handleInputChange('ateco_2025', e.target.value)}
                    className="input"
                    placeholder="28.99.30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dimensione</label>
                  <select
                    value={formData.dimensione}
                    onChange={(e) => handleInputChange('dimensione', e.target.value)}
                    className="input"
                  >
                    <option value="">Seleziona dimensione</option>
                    {DIMENSIONI.map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Numero Dipendenti</label>
                  <input
                    type="number"
                    value={formData.numero_dipendenti}
                    onChange={(e) => handleInputChange('numero_dipendenti', e.target.value)}
                    className="input"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ultimo Fatturato</label>
                  <input
                    type="number"
                    value={formData.ultimo_fatturato}
                    onChange={(e) => handleInputChange('ultimo_fatturato', e.target.value)}
                    className="input"
                    placeholder="325000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fonte Acquisizione</label>
                  <select
                    value={formData.fonte_acquisizione}
                    onChange={(e) => {
                      handleInputChange('fonte_acquisizione', e.target.value)
                      if (!e.target.value) handleInputChange('fonte_dettaglio', '')
                    }}
                    className="input"
                  >
                    <option value="">Seleziona fonte</option>
                    {FONTI_ACQUISIZIONE.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                  {formData.fonte_acquisizione && ['referral', 'evento', 'cold_call', 'altro'].includes(formData.fonte_acquisizione) && (
                    <input
                      type="text"
                      value={formData.fonte_dettaglio}
                      onChange={(e) => handleInputChange('fonte_dettaglio', e.target.value)}
                      className="input mt-2"
                      placeholder={
                        formData.fonte_acquisizione === 'referral' ? 'Chi ha segnalato il prospect?' :
                        formData.fonte_acquisizione === 'evento' ? 'Quale evento/fiera?' :
                        formData.fonte_acquisizione === 'cold_call' ? 'Dettagli contatto' :
                        'Specifica la fonte...'
                      }
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        )

      case 'legale':
        return (
          <div className="space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
              <div className="flex items-center">
                <User className="w-4 h-4 text-blue-600 mr-2" />
                <h3 className="text-sm font-semibold text-blue-900">Dati Legale Rappresentante</h3>
              </div>
              <p className="text-blue-700 mt-2 text-sm">
                Inserisci i dati del legale rappresentante del prospect
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input
                  type="text"
                  value={formData.legale_rappresentante_nome}
                  onChange={(e) => handleInputChange('legale_rappresentante_nome', e.target.value)}
                  className="input"
                  placeholder="Nome del legale rappresentante"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cognome</label>
                <input
                  type="text"
                  value={formData.legale_rappresentante_cognome}
                  onChange={(e) => handleInputChange('legale_rappresentante_cognome', e.target.value)}
                  className="input"
                  placeholder="Cognome del legale rappresentante"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.legale_rappresentante_email}
                  onChange={(e) => handleInputChange('legale_rappresentante_email', e.target.value)}
                  className="input"
                  placeholder="mario.rossi@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefono</label>
                <input
                  type="tel"
                  value={formData.legale_rappresentante_telefono}
                  onChange={(e) => handleInputChange('legale_rappresentante_telefono', e.target.value)}
                  className="input"
                  placeholder="+39 333 1234567"
                />
              </div>
            </div>
          </div>
        )

      case 'note':
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Note Generali</label>
              <textarea
                value={formData.note}
                onChange={(e) => handleInputChange('note', e.target.value)}
                className="input min-h-[120px]"
                rows={5}
                placeholder="Note interne sul prospect..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assegnato a</label>
              <input
                type="text"
                value={formData.assegnato_a}
                onChange={(e) => handleInputChange('assegnato_a', e.target.value)}
                className="input"
                placeholder="Nome del responsabile"
              />
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-hard max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col border-4 border-orange-400">
        {/* Header */}
        <div className="gradient-primary text-white p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Building2 className="w-4 h-4" />
            <div>
              <h2 className="text-sm font-semibold">
                {prospect ? 'Modifica Prospect' : 'Nuovo Prospect'}
              </h2>
              <div className="flex items-center space-x-2 mt-1">
                <span className="px-2 py-1 bg-orange-400 text-orange-900 text-xs font-semibold rounded-full">
                  {prospect ? 'MODIFICA' : 'NUOVO'}
                </span>
                {prospect?.denominazione && (
                  <span className="text-primary-100 text-sm">
                    {prospect.denominazione}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
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
                  className={`py-2 px-1.5 border-b-2 font-medium text-xs flex items-center space-x-2 transition-colors flex-shrink-0 ${
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
        <div className="p-4 overflow-y-auto flex-1">
          {renderTabContent()}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-4 py-2.5 bg-gray-50 flex items-center justify-end flex-shrink-0">
          <div className="flex items-center space-x-3">
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
              <span>{loading ? 'Salvando...' : 'Salva Prospect'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
