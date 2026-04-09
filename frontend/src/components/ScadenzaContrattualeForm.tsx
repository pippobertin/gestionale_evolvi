'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  Calendar,
  RefreshCw,
  Bell,
  Tag,
  Save
} from 'lucide-react'
import {
  ScadenzaContrattuale,
  TIPI_SCADENZA,
  PRIORITA_SCADENZA
} from '@/types/evolvi-contract'

interface ScadenzaContrattualeFormProps {
  isOpen: boolean
  onClose: () => void
  onSave: () => void
  scadenza?: ScadenzaContrattuale
  defaultEntityType?: string
  defaultEntityId?: string
}

const ENTITY_TYPES = [
  { value: 'GENERALE', label: 'Generale' },
  { value: 'CLIENTE', label: 'Cliente' },
  { value: 'CONTRATTO_EVOLVI', label: 'Contratto Evolvi' }
]

const RECURRENCE_PATTERNS = [
  { value: 'MONTHLY', label: 'Mensile' },
  { value: 'QUARTERLY', label: 'Trimestrale' },
  { value: 'YEARLY', label: 'Annuale' }
]

const NOTIFICA_GIORNI_OPTIONS = [30, 15, 7, 3, 1]

export default function ScadenzaContrattualeForm({
  isOpen,
  onClose,
  onSave,
  scadenza,
  defaultEntityType,
  defaultEntityId
}: ScadenzaContrattualeFormProps) {
  const isEdit = !!scadenza

  // Form state
  const [titolo, setTitolo] = useState('')
  const [descrizione, setDescrizione] = useState('')
  const [tipoScadenza, setTipoScadenza] = useState('CONTRATTUALE')
  const [categoria, setCategoria] = useState('')
  const [dataScadenza, setDataScadenza] = useState('')
  const [dataPromemoria, setDataPromemoria] = useState('')
  const [priorita, setPriorita] = useState('MEDIA')
  const [responsabileEmail, setResponsabileEmail] = useState('')
  const [entityType, setEntityType] = useState(defaultEntityType || 'GENERALE')
  const [entityId, setEntityId] = useState(defaultEntityId || '')

  // Recurring
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrencePattern, setRecurrencePattern] = useState('MONTHLY')
  const [recurrenceInterval, setRecurrenceInterval] = useState(1)
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('')

  // Notifications
  const [notificheAttive, setNotificheAttive] = useState(true)
  const [notificaGiorniPrima, setNotificaGiorniPrima] = useState<number[]>([7, 3, 1])

  // Tags & Notes
  const [tagsInput, setTagsInput] = useState('')
  const [note, setNote] = useState('')

  // Entity search
  const [entitySearchResults, setEntitySearchResults] = useState<Array<{ id: string; label: string }>>([])
  const [entitySearchQuery, setEntitySearchQuery] = useState('')
  const [showEntityDropdown, setShowEntityDropdown] = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Populate form when editing
  useEffect(() => {
    if (scadenza) {
      setTitolo(scadenza.titolo)
      setDescrizione(scadenza.descrizione || '')
      setTipoScadenza(scadenza.tipo_scadenza)
      setCategoria(scadenza.categoria || '')
      setDataScadenza(scadenza.data_scadenza)
      setDataPromemoria(scadenza.data_promemoria || '')
      setPriorita(scadenza.priorita)
      setResponsabileEmail(scadenza.responsabile_email || '')
      setEntityType(scadenza.entity_type)
      setEntityId(scadenza.entity_id || '')
      setIsRecurring(scadenza.is_recurring)
      setRecurrencePattern(scadenza.recurrence_pattern || 'MONTHLY')
      setRecurrenceInterval(scadenza.recurrence_interval || 1)
      setRecurrenceEndDate(scadenza.recurrence_end_date || '')
      setNotificheAttive(scadenza.notifiche_attive)
      setNotificaGiorniPrima(scadenza.notifica_giorni_prima || [7, 3, 1])
      setTagsInput((scadenza.tags || []).join(', '))
      setNote(scadenza.note_completamento || '')
    }
  }, [scadenza])

  // Entity search
  useEffect(() => {
    if (entityType === 'GENERALE' || !entitySearchQuery || entitySearchQuery.length < 2) {
      setEntitySearchResults([])
      setShowEntityDropdown(false)
      return
    }

    const searchEntity = async () => {
      try {
        if (entityType === 'CLIENTE') {
          const res = await fetch(`/api/clienti/table-structure`)
          // For simplicity, search via supabase directly through the existing API
          // In a real implementation you'd have a search endpoint
          setEntitySearchResults([])
        } else if (entityType === 'CONTRATTO_EVOLVI') {
          const res = await fetch(`/api/contracts/evolvi`)
          const result = await res.json()
          if (result.success && result.data) {
            const filtered = result.data
              .filter((c: any) =>
                (c.numero_contratto || '').toLowerCase().includes(entitySearchQuery.toLowerCase()) ||
                (c.cliente_denominazione || '').toLowerCase().includes(entitySearchQuery.toLowerCase())
              )
              .slice(0, 10)
              .map((c: any) => ({
                id: c.id,
                label: `${c.numero_contratto || 'N/D'} - ${c.cliente_denominazione || 'N/D'}`
              }))
            setEntitySearchResults(filtered)
            setShowEntityDropdown(filtered.length > 0)
          }
        }
      } catch (err) {
        console.error('Errore ricerca entity:', err)
      }
    }

    const timer = setTimeout(searchEntity, 300)
    return () => clearTimeout(timer)
  }, [entitySearchQuery, entityType])

  const handleNotificaGiorniToggle = (giorni: number) => {
    setNotificaGiorniPrima(prev =>
      prev.includes(giorni)
        ? prev.filter(g => g !== giorni)
        : [...prev, giorni].sort((a, b) => b - a)
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!titolo.trim()) {
      setError('Il titolo è obbligatorio')
      return
    }

    if (!dataScadenza) {
      setError('La data di scadenza è obbligatoria')
      return
    }

    setSaving(true)

    try {
      const tags = tagsInput
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0)

      const payload = {
        titolo: titolo.trim(),
        descrizione: descrizione.trim() || null,
        tipo_scadenza: tipoScadenza,
        categoria: categoria.trim() || null,
        data_scadenza: dataScadenza,
        data_promemoria: dataPromemoria || null,
        priorita,
        responsabile_email: responsabileEmail.trim() || null,
        entity_type: entityType,
        entity_id: entityType === 'GENERALE' ? null : (entityId || null),
        is_recurring: isRecurring,
        recurrence_pattern: isRecurring ? recurrencePattern : null,
        recurrence_interval: isRecurring ? recurrenceInterval : null,
        recurrence_end_date: isRecurring && recurrenceEndDate ? recurrenceEndDate : null,
        notifiche_attive: notificheAttive,
        notifica_giorni_prima: notificheAttive ? notificaGiorniPrima : [],
        tags,
        note: note.trim() || null
      }

      const url = isEdit
        ? `/api/scadenze-contrattuali/${scadenza!.id}`
        : '/api/scadenze-contrattuali'

      const method = isEdit ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const result = await res.json()

      if (!result.success) {
        throw new Error(result.error)
      }

      onSave()
    } catch (err: any) {
      setError(err.message || 'Errore nel salvataggio')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {isEdit ? 'Modifica Scadenza Contrattuale' : 'Nuova Scadenza Contrattuale'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {/* Campi principali */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Titolo *
              </label>
              <input
                type="text"
                value={titolo}
                onChange={(e) => setTitolo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Es: Rinnovo contratto assistenza"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descrizione
              </label>
              <textarea
                value={descrizione}
                onChange={(e) => setDescrizione(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                placeholder="Descrizione dettagliata..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo Scadenza *
              </label>
              <select
                value={tipoScadenza}
                onChange={(e) => setTipoScadenza(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {TIPI_SCADENZA.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Categoria
              </label>
              <input
                type="text"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Es: Manutenzione, Licenza, ..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data Scadenza *
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={dataScadenza}
                  onChange={(e) => setDataScadenza(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data Promemoria
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={dataPromemoria}
                  onChange={(e) => setDataPromemoria(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priorita
              </label>
              <select
                value={priorita}
                onChange={(e) => setPriorita(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(PRIORITA_SCADENZA).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Responsabile
              </label>
              <input
                type="email"
                value={responsabileEmail}
                onChange={(e) => setResponsabileEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="responsabile@email.com"
              />
            </div>
          </div>

          {/* Entity */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Collegamento Entita</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo Entita
                </label>
                <select
                  value={entityType}
                  onChange={(e) => { setEntityType(e.target.value); setEntityId(''); setEntitySearchQuery('') }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {ENTITY_TYPES.map(et => (
                    <option key={et.value} value={et.value}>{et.label}</option>
                  ))}
                </select>
              </div>

              {entityType !== 'GENERALE' && (
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cerca {entityType === 'CLIENTE' ? 'Cliente' : 'Contratto'}
                  </label>
                  <input
                    type="text"
                    value={entitySearchQuery}
                    onChange={(e) => setEntitySearchQuery(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Cerca..."
                  />
                  {entityId && (
                    <p className="text-xs text-green-600 mt-1">ID selezionato: {entityId.substring(0, 8)}...</p>
                  )}
                  {showEntityDropdown && entitySearchResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {entitySearchResults.map(result => (
                        <button
                          key={result.id}
                          type="button"
                          onClick={() => {
                            setEntityId(result.id)
                            setEntitySearchQuery(result.label)
                            setShowEntityDropdown(false)
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                        >
                          {result.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Ricorrenza */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                Ricorrenza
              </h3>
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="sr-only"
                />
                <div className={`relative w-10 h-5 rounded-full transition-colors ${isRecurring ? 'bg-blue-600' : 'bg-gray-300'}`}>
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${isRecurring ? 'translate-x-5' : ''}`} />
                </div>
              </label>
            </div>

            {isRecurring && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pattern
                  </label>
                  <select
                    value={recurrencePattern}
                    onChange={(e) => setRecurrencePattern(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {RECURRENCE_PATTERNS.map(rp => (
                      <option key={rp.value} value={rp.value}>{rp.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Intervallo
                  </label>
                  <input
                    type="number"
                    value={recurrenceInterval}
                    onChange={(e) => setRecurrenceInterval(parseInt(e.target.value) || 1)}
                    min={1}
                    max={12}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data Fine Ricorrenza
                  </label>
                  <input
                    type="date"
                    value={recurrenceEndDate}
                    onChange={(e) => setRecurrenceEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Notifiche */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Bell className="w-4 h-4" />
                Notifiche
              </h3>
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notificheAttive}
                  onChange={(e) => setNotificheAttive(e.target.checked)}
                  className="sr-only"
                />
                <div className={`relative w-10 h-5 rounded-full transition-colors ${notificheAttive ? 'bg-blue-600' : 'bg-gray-300'}`}>
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${notificheAttive ? 'translate-x-5' : ''}`} />
                </div>
              </label>
            </div>

            {notificheAttive && (
              <div>
                <p className="text-sm text-gray-600 mb-2">Notifica giorni prima della scadenza:</p>
                <div className="flex flex-wrap gap-3">
                  {NOTIFICA_GIORNI_OPTIONS.map(giorni => (
                    <label key={giorni} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notificaGiorniPrima.includes(giorni)}
                        onChange={() => handleNotificaGiorniToggle(giorni)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{giorni} giorn{giorni === 1 ? 'o' : 'i'}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
              <Tag className="w-4 h-4" />
              Tags (separati da virgola)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Es: urgente, contratto, rinnovo"
            />
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Note
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Note aggiuntive..."
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Annulla
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvataggio...' : isEdit ? 'Aggiorna' : 'Crea Scadenza'}
          </button>
        </div>
      </div>
    </div>
  )
}
