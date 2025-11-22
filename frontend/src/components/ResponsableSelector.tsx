'use client'

import { useState, useEffect } from 'react'
import { User, Users, ChevronDown, X } from 'lucide-react'
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

interface ResponsabileData {
  tipo: 'utente' | 'gruppo' | 'tutti'
  utente_id?: string
  gruppo_id?: string
}

interface ResponsableSelectorProps {
  value?: ResponsabileData
  onChange: (responsabile: ResponsabileData | null) => void
  className?: string
}

export default function ResponsableSelector({ value, onChange, className = '' }: ResponsableSelectorProps) {
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
        .eq('attivo', true)
        .order('nome')

      if (gruppiError) throw gruppiError

      setUtenti(utentiData || [])
      setGruppi(gruppiData || [])
    } catch (error) {
      console.error('Errore caricamento responsabili:', error)
    } finally {
      setLoading(false)
    }
  }

  const getDisplayText = () => {
    if (!value) return 'Seleziona responsabile...'

    if (value.tipo === 'tutti') return 'Tutti gli utenti'

    if (value.tipo === 'utente' && value.utente_id) {
      const utente = utenti.find(u => u.id === value.utente_id)
      return utente ? `${utente.nome} ${utente.cognome}` : 'Utente non trovato'
    }

    if (value.tipo === 'gruppo' && value.gruppo_id) {
      const gruppo = gruppi.find(g => g.id === value.gruppo_id)
      return gruppo ? gruppo.nome : 'Gruppo non trovato'
    }

    return 'Seleziona responsabile...'
  }

  const handleSelect = (responsabile: ResponsabileData) => {
    onChange(responsabile)
    setIsOpen(false)
  }

  const handleClear = () => {
    onChange(null)
    setIsOpen(false)
  }

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-left flex items-center justify-between hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        <span className={value ? 'text-gray-900' : 'text-gray-500'}>
          {getDisplayText()}
        </span>
        <div className="flex items-center space-x-2">
          {value && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleClear()
              }}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X className="h-3 w-3 text-gray-400" />
            </button>
          )}
          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
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
                onClick={() => handleSelect({ tipo: 'tutti' })}
                className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center space-x-2 border-b border-gray-100"
              >
                <Users className="h-4 w-4 text-purple-600" />
                <span>Tutti gli utenti</span>
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
                      onClick={() => handleSelect({ tipo: 'gruppo', gruppo_id: gruppo.id })}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center space-x-2"
                    >
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
                      onClick={() => handleSelect({ tipo: 'utente', utente_id: utente.id })}
                      className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center space-x-2"
                    >
                      <User className="h-4 w-4 text-blue-600" />
                      <div>
                        <div className="font-medium">{utente.nome} {utente.cognome}</div>
                        <div className="text-xs text-gray-500">{utente.email} ({utente.ruolo})</div>
                      </div>
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