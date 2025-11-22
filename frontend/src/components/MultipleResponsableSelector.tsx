'use client'

import { useState, useEffect } from 'react'
import { User, Users, ChevronDown, X, Plus, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Utente {
  id: string
  nome: string
  cognome: string
  email: string
  ruolo: string
  gruppo_id?: string
}

interface Gruppo {
  id: string
  nome: string
  descrizione?: string
  colore_hex: string
}

interface ResponsabileSelezionato {
  tipo: 'utente' | 'gruppo' | 'tutti'
  id: string
  nome: string
  colore?: string
}

interface MultipleResponsableSelectorProps {
  value?: ResponsabileSelezionato[]
  onChange: (responsabili: ResponsabileSelezionato[]) => void
  className?: string
  placeholder?: string
}

export default function MultipleResponsableSelector({
  value = [],
  onChange,
  className = '',
  placeholder = 'Seleziona responsabili...'
}: MultipleResponsableSelectorProps) {
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
        .select('*')
        .order('nome')

      if (utentiError) throw utentiError

      // Carica gruppi
      const { data: gruppiData, error: gruppiError } = await supabase
        .from('scadenze_bandi_gruppi_utenti')
        .select('*')
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

  const getDisplayText = () => {
    if (value.length === 0) return placeholder

    if (value.length === 1) {
      return value[0].nome
    }

    return `${value.length} responsabili selezionati`
  }

  const isSelected = (tipo: 'utente' | 'gruppo' | 'tutti', id: string) => {
    return value.some(r => r.tipo === tipo && r.id === id)
  }

  const toggleSelection = (responsabile: ResponsabileSelezionato) => {
    const isCurrentlySelected = isSelected(responsabile.tipo, responsabile.id)

    if (isCurrentlySelected) {
      // Rimuovi dalla selezione
      const newValue = value.filter(r => !(r.tipo === responsabile.tipo && r.id === responsabile.id))
      onChange(newValue)
    } else {
      // Aggiungi alla selezione
      if (responsabile.tipo === 'tutti') {
        // Se seleziono "tutti", rimuovi tutto il resto
        onChange([responsabile])
      } else {
        // Rimuovi "tutti" se era selezionato, poi aggiungi il nuovo
        const newValue = value.filter(r => r.tipo !== 'tutti')
        onChange([...newValue, responsabile])
      }
    }
  }

  const removeSelection = (responsabile: ResponsabileSelezionato, event: React.MouseEvent) => {
    event.stopPropagation()
    const newValue = value.filter(r => !(r.tipo === responsabile.tipo && r.id === responsabile.id))
    onChange(newValue)
  }

  const handleTuttiSelection = () => {
    const tutti: ResponsabileSelezionato = {
      tipo: 'tutti',
      id: 'tutti',
      nome: 'Tutti gli utenti'
    }

    if (isSelected('tutti', 'tutti')) {
      onChange([])
    } else {
      onChange([tutti])
    }
  }

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-left flex items-center justify-between hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[40px]"
      >
        <div className="flex-1 flex flex-wrap gap-1">
          {value.length === 0 ? (
            <span className="text-gray-500">{placeholder}</span>
          ) : value.length <= 3 ? (
            // Mostra i chip singoli se sono pochi
            value.map((responsabile) => (
              <span
                key={`${responsabile.tipo}-${responsabile.id}`}
                className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs"
                style={responsabile.colore ? { backgroundColor: `${responsabile.colore}20`, color: responsabile.colore } : {}}
              >
                {responsabile.tipo === 'gruppo' && (
                  <div
                    className="w-2 h-2 rounded-full mr-1"
                    style={{ backgroundColor: responsabile.colore }}
                  />
                )}
                {responsabile.nome}
                <span
                  onClick={(e) => removeSelection(responsabile, e)}
                  className="ml-1 hover:text-red-600 cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </span>
              </span>
            ))
          ) : (
            // Mostra il conteggio se sono molti
            <span className="text-gray-900">{getDisplayText()}</span>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {loading ? (
            <div className="p-3 text-center text-gray-500">
              Caricamento...
            </div>
          ) : (
            <>
              {/* Opzione "Tutti" */}
              <button
                onClick={handleTuttiSelection}
                className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center justify-between border-b border-gray-100"
              >
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-purple-600" />
                  <span>Tutti gli utenti</span>
                </div>
                {isSelected('tutti', 'tutti') && (
                  <Check className="h-4 w-4 text-green-600" />
                )}
              </button>

              {/* Gruppi */}
              {gruppi.length > 0 && (
                <>
                  <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                    Gruppi
                  </div>
                  {gruppi.map((gruppo) => (
                    <button
                      key={gruppo.id}
                      onClick={() => toggleSelection({
                        tipo: 'gruppo',
                        id: gruppo.id,
                        nome: gruppo.nome,
                        colore: gruppo.colore_hex
                      })}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: gruppo.colore_hex }}
                        />
                        <div>
                          <div className="font-medium">{gruppo.nome}</div>
                          {gruppo.descrizione && (
                            <div className="text-xs text-gray-500">{gruppo.descrizione}</div>
                          )}
                        </div>
                      </div>
                      {isSelected('gruppo', gruppo.id) && (
                        <Check className="h-4 w-4 text-green-600" />
                      )}
                    </button>
                  ))}
                </>
              )}

              {/* Utenti */}
              {utenti.length > 0 && (
                <>
                  <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                    Utenti
                  </div>
                  {utenti.map((utente) => (
                    <button
                      key={utente.id}
                      onClick={() => toggleSelection({
                        tipo: 'utente',
                        id: utente.id,
                        nome: `${utente.nome} ${utente.cognome}`
                      })}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-blue-600" />
                        <div>
                          <div className="font-medium">{utente.nome} {utente.cognome}</div>
                          <div className="text-xs text-gray-500">{utente.email} ({utente.ruolo})</div>
                        </div>
                      </div>
                      {isSelected('utente', utente.id) && (
                        <Check className="h-4 w-4 text-green-600" />
                      )}
                    </button>
                  ))}
                </>
              )}

              {utenti.length === 0 && gruppi.length === 0 && (
                <div className="p-3 text-center text-gray-500">
                  Nessun responsabile disponibile
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Overlay per chiudere quando si clicca fuori */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}