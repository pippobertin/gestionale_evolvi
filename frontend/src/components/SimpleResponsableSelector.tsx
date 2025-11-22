'use client'

import { useState, useEffect } from 'react'
import { User, Users, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Utente {
  id: string
  nome: string
  cognome: string
  email: string
  ruolo: string
}

interface Gruppo {
  id: string
  nome: string
  descrizione?: string
  colore_hex: string
}

interface SimpleResponsableSelectorProps {
  value?: string
  onChange: (email: string) => void
  className?: string
  placeholder?: string
}

export default function SimpleResponsableSelector({
  value = '',
  onChange,
  className = '',
  placeholder = 'Seleziona responsabile...'
}: SimpleResponsableSelectorProps) {
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
    if (!value) return placeholder

    // Cerca tra gli utenti
    const utente = utenti.find(u => u.email === value)
    if (utente) return `${utente.nome} ${utente.cognome}`

    // Cerca tra i gruppi
    const gruppo = gruppi.find(g => g.nome === value)
    if (gruppo) return gruppo.nome

    // Casi speciali
    if (value === 'TUTTI') return 'Tutti gli utenti'

    // Fallback: mostra l'email
    return value
  }

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue)
    setIsOpen(false)
  }

  return (
    <div className={`relative ${className}`}>
      <div className="flex">
        <input
          type="email"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="px-3 py-2 border border-l-0 border-gray-300 rounded-r-md bg-gray-50 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {loading ? (
            <div className="p-3 text-center text-gray-500">
              Caricamento...
            </div>
          ) : (
            <>
              {/* Opzione "Tutti" */}
              <div
                onClick={() => handleSelect('TUTTI')}
                className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center space-x-2 border-b border-gray-100"
              >
                <Users className="h-4 w-4 text-purple-600" />
                <span>Tutti gli utenti</span>
              </div>

              {/* Gruppi */}
              {gruppi.length > 0 && (
                <>
                  <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                    Gruppi
                  </div>
                  {gruppi.map((gruppo) => (
                    <div
                      key={gruppo.id}
                      onClick={() => handleSelect(`GRUPPO:${gruppo.nome}`)}
                      className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center space-x-2"
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
                    </div>
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
                    <div
                      key={utente.id}
                      onClick={() => handleSelect(utente.email)}
                      className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center space-x-2"
                    >
                      <User className="h-4 w-4 text-blue-600" />
                      <div>
                        <div className="font-medium">{utente.nome} {utente.cognome}</div>
                        <div className="text-xs text-gray-500">{utente.email} ({utente.ruolo})</div>
                      </div>
                    </div>
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