'use client'

import { useState, useEffect } from 'react'
import {
  X,
  Save,
  Calendar,
  AlertTriangle,
  Building2,
  FileText,
  User,
  Users,
  ChevronDown
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Cliente {
  id: string
  denominazione: string
  partita_iva?: string
}

interface Bando {
  id: string
  nome: string
  codice_bando?: string
  ente_erogatore?: string
}

interface Progetto {
  id: string
  titolo_progetto: string
  codice_progetto?: string
  cliente_denominazione?: string
  bando_nome?: string
}

interface TipologiaScadenza {
  id: string
  nome: string
  descrizione?: string
}

interface ScadenzaFormData {
  titolo: string
  data_scadenza: string
  stato: 'non_iniziata' | 'in_corso' | 'completata' | 'annullata'
  priorita: 'bassa' | 'media' | 'alta' | 'critica'
  tipologia_scadenza_id?: string
  responsabile_email?: string
  note?: string
  // Entità collegate (una sola alla volta)
  cliente_id?: string
  bando_id?: string
  progetto_id?: string
}

interface ScadenzaFormProps {
  onClose: () => void
  onScadenzaCreata: () => void
  scadenza?: any // Per modifica esistente
}

export default function ScadenzaForm({ onClose, onScadenzaCreata, scadenza }: ScadenzaFormProps) {
  const [formData, setFormData] = useState<ScadenzaFormData>({
    titolo: '',
    data_scadenza: '',
    stato: 'non_iniziata',
    priorita: 'media'
  })

  const [loading, setLoading] = useState(false)
  const [entitaSelezionata, setEntitaSelezionata] = useState<'cliente' | 'bando' | 'progetto' | ''>('')

  // Dati per i dropdown
  const [clienti, setClienti] = useState<Cliente[]>([])
  const [bandi, setBandi] = useState<Bando[]>([])
  const [progetti, setProgetti] = useState<Progetto[]>([])
  const [tipologie, setTipologie] = useState<TipologiaScadenza[]>([])

  useEffect(() => {
    loadData()
    if (scadenza) {
        setFormData({
          titolo: scadenza.titolo || '',
          data_scadenza: scadenza.data_scadenza ? scadenza.data_scadenza.split('T')[0] : '',
          stato: scadenza.stato || 'non_iniziata',
          priorita: scadenza.priorita || 'media',
          tipologia_scadenza_id: scadenza.tipologia_scadenza_id || '',
          responsabile_email: scadenza.responsabile_email || '',
          note: scadenza.note || '',
          cliente_id: scadenza.cliente_id || '',
          bando_id: scadenza.bando_id || '',
          progetto_id: scadenza.progetto_id || ''
        })

        // Determina quale entità è selezionata
        if (scadenza.progetto_id) setEntitaSelezionata('progetto')
        else if (scadenza.bando_id) setEntitaSelezionata('bando')
        else if (scadenza.cliente_id) setEntitaSelezionata('cliente')
      } else {
        // Nuovo - reset form
        setFormData({
          titolo: '',
          data_scadenza: '',
          stato: 'non_iniziata',
          priorita: 'media'
        })
        setEntitaSelezionata('')
      }
  }, [scadenza])

  const loadData = async () => {
    try {
      // Carica clienti
      const { data: clientiData } = await supabase
        .from('scadenze_bandi_clienti')
        .select('id, denominazione, partita_iva')
        .order('denominazione')

      // Carica bandi
      const { data: bandiData } = await supabase
        .from('scadenze_bandi_bandi')
        .select('id, nome, codice_bando, ente_erogatore')
        .order('nome')

      // Carica progetti
      const { data: progettiData } = await supabase
        .from('scadenze_bandi_progetti_view')
        .select('id, titolo_progetto, codice_progetto, cliente_denominazione, bando_nome')
        .order('titolo_progetto')

      // Carica tipologie
      const { data: tipologieData } = await supabase
        .from('scadenze_bandi_tipologie_scadenze')
        .select('id, nome, descrizione')
        .order('nome')

      setClienti(clientiData || [])
      setBandi(bandiData || [])
      setProgetti(progettiData || [])
      setTipologie(tipologieData || [])
    } catch (error) {
      console.error('Errore nel caricamento dati:', error)
    }
  }

  const handleInputChange = (field: keyof ScadenzaFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleEntitaChange = (entita: 'cliente' | 'bando' | 'progetto' | '') => {
    setEntitaSelezionata(entita)
    // Reset delle selezioni precedenti
    setFormData(prev => ({
      ...prev,
      cliente_id: '',
      bando_id: '',
      progetto_id: ''
    }))
  }

  const handleSave = async () => {
    if (!formData.titolo || !formData.data_scadenza) {
      alert('Inserisci almeno titolo e data scadenza')
      return
    }

    setLoading(true)
    try {
      const dataToSave = { ...formData }

      // Assicurati che solo uno dei collegamenti sia presente
      if (entitaSelezionata !== 'cliente') delete dataToSave.cliente_id
      if (entitaSelezionata !== 'bando') delete dataToSave.bando_id
      if (entitaSelezionata !== 'progetto') delete dataToSave.progetto_id

      // Rimuovi campi vuoti opzionali
      if (!dataToSave.tipologia_scadenza_id) delete dataToSave.tipologia_scadenza_id
      if (!dataToSave.responsabile_email) delete dataToSave.responsabile_email
      if (!dataToSave.note) delete dataToSave.note

      console.log('Dati da salvare:', dataToSave)
      console.log('Entità selezionata:', entitaSelezionata)

      if (scadenza?.id) {
        // Modifica esistente
        const { error } = await supabase
          .from('scadenze_bandi_scadenze')
          .update(dataToSave)
          .eq('id', scadenza.id)

        if (error) throw error
      } else {
        // Nuova scadenza
        const { error } = await supabase
          .from('scadenze_bandi_scadenze')
          .insert([dataToSave])

        if (error) throw error
      }

      onScadenzaCreata()
      onClose()
    } catch (error) {
      console.error('Errore nel salvataggio:', error)
      alert('Errore nel salvataggio della scadenza')
    } finally {
      setLoading(false)
    }
  }


  const getPrioritaColor = (priorita: string) => {
    switch (priorita) {
      case 'bassa': return 'border-green-500 bg-green-50 text-green-700'
      case 'media': return 'border-yellow-500 bg-yellow-50 text-yellow-700'
      case 'alta': return 'border-orange-500 bg-orange-50 text-orange-700'
      case 'critica': return 'border-red-500 bg-red-50 text-red-700'
      default: return 'border-gray-300 bg-gray-50 text-gray-700'
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {scadenza ? 'Modifica Scadenza' : 'Nuova Scadenza'}
              </h2>
              <p className="text-gray-600 text-sm">
                Crea una scadenza collegata a cliente, bando o progetto
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-6">
          {/* Selezione Entità */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Collega scadenza a: *
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => handleEntitaChange('cliente')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  entitaSelezionata === 'cliente'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Building2 className="w-6 h-6 mx-auto mb-2 text-blue-600" />
                <div className="text-sm font-medium">Cliente</div>
                <div className="text-xs text-gray-500">Contratti, certificazioni</div>
              </button>

              <button
                type="button"
                onClick={() => handleEntitaChange('bando')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  entitaSelezionata === 'bando'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <FileText className="w-6 h-6 mx-auto mb-2 text-green-600" />
                <div className="text-sm font-medium">Bando</div>
                <div className="text-xs text-gray-500">Aperture, graduatorie</div>
              </button>

              <button
                type="button"
                onClick={() => handleEntitaChange('progetto')}
                className={`p-4 rounded-lg border-2 transition-all ${
                  entitaSelezionata === 'progetto'
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Users className="w-6 h-6 mx-auto mb-2 text-purple-600" />
                <div className="text-sm font-medium">Progetto</div>
                <div className="text-xs text-gray-500">SAL, proroghe, milestone</div>
              </button>
            </div>
          </div>

          {/* Selezione specifica dell'entità */}
          {entitaSelezionata && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Seleziona {entitaSelezionata} *
              </label>

              {entitaSelezionata === 'cliente' && (
                <select
                  value={formData.cliente_id || ''}
                  onChange={(e) => handleInputChange('cliente_id', e.target.value)}
                  className="input"
                  required
                >
                  <option value="">Seleziona cliente...</option>
                  {clienti.map(cliente => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.denominazione} {cliente.partita_iva && `(${cliente.partita_iva})`}
                    </option>
                  ))}
                </select>
              )}

              {entitaSelezionata === 'bando' && (
                <select
                  value={formData.bando_id || ''}
                  onChange={(e) => handleInputChange('bando_id', e.target.value)}
                  className="input"
                  required
                >
                  <option value="">Seleziona bando...</option>
                  {bandi.map(bando => (
                    <option key={bando.id} value={bando.id}>
                      {bando.nome} {bando.codice_bando && `(${bando.codice_bando})`}
                    </option>
                  ))}
                </select>
              )}

              {entitaSelezionata === 'progetto' && (
                <select
                  value={formData.progetto_id || ''}
                  onChange={(e) => handleInputChange('progetto_id', e.target.value)}
                  className="input"
                  required
                >
                  <option value="">Seleziona progetto...</option>
                  {progetti.map(progetto => (
                    <option key={progetto.id} value={progetto.id}>
                      {progetto.titolo_progetto} {progetto.codice_progetto && `(${progetto.codice_progetto})`}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Dati scadenza */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Titolo *
              </label>
              <input
                type="text"
                value={formData.titolo}
                onChange={(e) => handleInputChange('titolo', e.target.value)}
                className="input"
                placeholder="Descrizione della scadenza"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Scadenza *
              </label>
              <input
                type="date"
                value={formData.data_scadenza}
                onChange={(e) => handleInputChange('data_scadenza', e.target.value)}
                className="input"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priorità *
              </label>
              <select
                value={formData.priorita}
                onChange={(e) => handleInputChange('priorita', e.target.value as any)}
                className={`input ${getPrioritaColor(formData.priorita)}`}
              >
                <option value="bassa">Bassa</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
                <option value="critica">Critica</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Stato
              </label>
              <select
                value={formData.stato}
                onChange={(e) => handleInputChange('stato', e.target.value as any)}
                className="input"
              >
                <option value="non_iniziata">Non iniziata</option>
                <option value="in_corso">In corso</option>
                <option value="completata">Completata</option>
                <option value="annullata">Annullata</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipologia
              </label>
              <select
                value={formData.tipologia_scadenza_id || ''}
                onChange={(e) => handleInputChange('tipologia_scadenza_id', e.target.value)}
                className="input"
              >
                <option value="">Seleziona tipologia...</option>
                {tipologie.map(tipologia => (
                  <option key={tipologia.id} value={tipologia.id}>
                    {tipologia.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Responsabile
              </label>
              <input
                type="email"
                value={formData.responsabile_email || ''}
                onChange={(e) => handleInputChange('responsabile_email', e.target.value)}
                className="input"
                placeholder="responsabile@blmproject.it"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Note
              </label>
              <textarea
                value={formData.note || ''}
                onChange={(e) => handleInputChange('note', e.target.value)}
                className="input"
                rows={3}
                placeholder="Note aggiuntive sulla scadenza..."
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 px-6 py-4 border-t border-gray-200">
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
            disabled={loading || !entitaSelezionata || !formData.titolo || !formData.data_scadenza}
          >
            <Save className="w-4 h-4" />
            <span>{loading ? 'Salvataggio...' : 'Salva Scadenza'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}