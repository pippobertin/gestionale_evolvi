'use client'

import { useState, useEffect } from 'react'
import { User, Users, X, Plus, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Utente {
  id: string
  nome: string
  cognome: string
  email: string
}

interface Gruppo {
  id: string
  nome: string
  descrizione?: string
  colore_hex: string
}

export interface Responsabile {
  type: 'utente' | 'gruppo'
  id: string
  nome: string
  email?: string // Solo per utenti
}

interface MultiResponsableSelectorProps {
  value: Responsabile[]
  onChange: (responsabili: Responsabile[]) => void
  className?: string
}

export default function MultiResponsableSelector({
  value = [],
  onChange,
  className = ''
}: MultiResponsableSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [utenti, setUtenti] = useState<Utente[]>([])
  const [gruppi, setGruppi] = useState<Gruppo[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)

      // Carica utenti
      const { data: utentiData, error: utentiError } = await supabase
        .from('scadenze_bandi_utenti')
        .select('id, nome, cognome, email')
        .order('nome')

      if (utentiError) throw utentiError

      // Carica gruppi
      const { data: gruppiData, error: gruppiError } = await supabase
        .from('scadenze_bandi_gruppi_utenti')
        .select('id, nome, descrizione, colore_hex')
        .eq('attivo', true)
        .order('nome')

      if (gruppiError) throw gruppiError

      setUtenti(utentiData || [])
      setGruppi(gruppiData || [])
    } catch (error: any) {
      console.error('Errore caricamento responsabili:', error?.message || error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddUtente = (utente: Utente) => {
    // Controlla se già presente
    if (value.some(r => r.type === 'utente' && r.id === utente.id)) {
      return
    }

    onChange([
      ...value,
      {
        type: 'utente',
        id: utente.id,
        nome: `${utente.nome} ${utente.cognome}`,
        email: utente.email
      }
    ])
    setIsOpen(false)
  }

  const handleAddGruppo = (gruppo: Gruppo) => {
    // Controlla se già presente
    if (value.some(r => r.type === 'gruppo' && r.id === gruppo.id)) {
      return
    }

    onChange([
      ...value,
      {
        type: 'gruppo',
        id: gruppo.id,
        nome: gruppo.nome
      }
    ])
    setIsOpen(false)
  }

  const handleRemove = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Lista responsabili selezionati */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((resp, index) => (
            <div
              key={`${resp.type}-${resp.id}`}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm border border-blue-200"
            >
              {resp.type === 'utente' ? (
                <User className="w-4 h-4" />
              ) : (
                <Users className="w-4 h-4" />
              )}
              <span className="font-medium">{resp.nome}</span>
              {resp.email && (
                <span className="text-xs text-blue-600">({resp.email})</span>
              )}
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="ml-1 hover:text-red-600"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Bottone aggiungi */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-4 py-2 border border-dashed border-gray-300 rounded-md hover:border-blue-400 hover:bg-blue-50 text-gray-600 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Aggiungi responsabile</span>
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown */}
        {isOpen && (
          <>
            <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-80 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-gray-500">
                  Caricamento...
                </div>
              ) : (
                <>
                  {/* Gruppi */}
                  {gruppi.length > 0 && (
                    <>
                      <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 sticky top-0">
                        Gruppi
                      </div>
                      {gruppi.map((gruppo) => {
                        const alreadySelected = value.some(r => r.type === 'gruppo' && r.id === gruppo.id)
                        return (
                          <button
                            key={gruppo.id}
                            type="button"
                            onClick={() => handleAddGruppo(gruppo)}
                            disabled={alreadySelected}
                            className={`w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 ${
                              alreadySelected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                            }`}
                          >
                            <div
                              className="h-3 w-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: gruppo.colore_hex }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900">{gruppo.nome}</div>
                              {gruppo.descrizione && (
                                <div className="text-xs text-gray-500 truncate">{gruppo.descrizione}</div>
                              )}
                            </div>
                            {alreadySelected && (
                              <span className="text-xs text-green-600 flex-shrink-0">✓ Selezionato</span>
                            )}
                          </button>
                        )
                      })}
                    </>
                  )}

                  {/* Utenti */}
                  {utenti.length > 0 && (
                    <>
                      <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 sticky top-0">
                        Utenti
                      </div>
                      {utenti.map((utente) => {
                        const alreadySelected = value.some(r => r.type === 'utente' && r.id === utente.id)
                        return (
                          <button
                            key={utente.id}
                            type="button"
                            onClick={() => handleAddUtente(utente)}
                            disabled={alreadySelected}
                            className={`w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 ${
                              alreadySelected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                            }`}
                          >
                            <User className="h-4 w-4 text-blue-600 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900">{utente.nome} {utente.cognome}</div>
                              <div className="text-xs text-gray-500 truncate">{utente.email}</div>
                            </div>
                            {alreadySelected && (
                              <span className="text-xs text-green-600 flex-shrink-0">✓ Selezionato</span>
                            )}
                          </button>
                        )
                      })}
                    </>
                  )}

                  {utenti.length === 0 && gruppi.length === 0 && (
                    <div className="p-4 text-center text-gray-500">
                      Nessun responsabile disponibile
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Overlay per chiudere */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
          </>
        )}
      </div>

      {value.length === 0 && (
        <p className="text-xs text-gray-500 italic">
          Nessun responsabile selezionato. Le notifiche non verranno inviate.
        </p>
      )}
    </div>
  )
}
