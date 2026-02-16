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

// Type per ResponsableSelector (object-based)
export interface ResponsabileData {
  tipo: 'utente' | 'gruppo' | 'tutti'
  utente_id?: string
  gruppo_id?: string
}

// Props per variante standard
interface StandardProps {
  variant?: 'standard'
  value?: ResponsabileData
  onChange: (responsabile: ResponsabileData | undefined) => void
}

// Props per variante simple (string-based)
interface SimpleProps {
  variant: 'simple'
  value?: string
  onChange: (email: string) => void
}

// Union type
type UnifiedResponsableSelectorProps = (StandardProps | SimpleProps) & {
  className?: string
  placeholder?: string
  showTutti?: boolean
}

export default function UnifiedResponsableSelector({
  variant = 'standard',
  value,
  onChange,
  className = '',
  placeholder = 'Seleziona responsabile...',
  showTutti = true
}: UnifiedResponsableSelectorProps) {
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

      if (utentiError) {
        console.warn('Tabella scadenze_bandi_utenti non trovata:', utentiError)
        setUtenti([])
      } else {
        setUtenti(utentiData || [])
      }

      // Carica gruppi
      const { data: gruppiData, error: gruppiError } = await supabase
        .from('scadenze_bandi_gruppi_utenti')
        .select('*')
        .eq('attivo', true)
        .order('nome')

      if (gruppiError) {
        console.warn('Tabella scadenze_bandi_gruppi_utenti non trovata:', gruppiError)
        setGruppi([])
      } else {
        setGruppi(gruppiData || [])
      }

    } catch (error) {
      console.error('Errore caricamento responsabili:', error)
    } finally {
      setLoading(false)
    }
  }

  const getDisplayText = () => {
    if (!value) return placeholder

    if (variant === 'simple') {
      // Simple variant: value è una stringa
      const stringValue = value as string

      if (stringValue === 'TUTTI') return 'Tutti gli utenti'

      // Cerca tra utenti
      const utente = utenti.find(u => u.email === stringValue)
      if (utente) return `${utente.nome} ${utente.cognome}`

      // Cerca tra gruppi (formato GRUPPO:nome)
      if (stringValue.startsWith('GRUPPO:')) {
        const gruppoNome = stringValue.replace('GRUPPO:', '')
        const gruppo = gruppi.find(g => g.nome === gruppoNome)
        if (gruppo) return gruppo.nome
      }

      return stringValue
    } else {
      // Standard variant: value è un oggetto ResponsabileData
      const objValue = value as ResponsabileData

      if (objValue.tipo === 'tutti') return 'Tutti gli utenti'

      if (objValue.tipo === 'utente' && objValue.utente_id) {
        const utente = utenti.find(u => u.id === objValue.utente_id)
        return utente ? `${utente.nome} ${utente.cognome}` : 'Utente non trovato'
      }

      if (objValue.tipo === 'gruppo' && objValue.gruppo_id) {
        const gruppo = gruppi.find(g => g.id === objValue.gruppo_id)
        return gruppo ? gruppo.nome : 'Gruppo non trovato'
      }

      return placeholder
    }
  }

  const handleSelect = (tipo: 'utente' | 'gruppo' | 'tutti', id?: string) => {
    if (variant === 'simple') {
      // Simple variant: restituisci stringa
      if (tipo === 'tutti') {
        (onChange as SimpleProps['onChange'])('TUTTI')
      } else if (tipo === 'utente' && id) {
        const utente = utenti.find(u => u.id === id)
        if (utente) (onChange as SimpleProps['onChange'])(utente.email)
      } else if (tipo === 'gruppo' && id) {
        const gruppo = gruppi.find(g => g.id === id)
        if (gruppo) (onChange as SimpleProps['onChange'])(`GRUPPO:${gruppo.nome}`)
      }
    } else {
      // Standard variant: restituisci oggetto
      const responsabile: ResponsabileData = {
        tipo,
        ...(tipo === 'utente' && id && { utente_id: id }),
        ...(tipo === 'gruppo' && id && { gruppo_id: id })
      };
      (onChange as StandardProps['onChange'])(responsabile)
    }
    setIsOpen(false)
  }

  const handleClear = () => {
    if (variant === 'simple') {
      (onChange as SimpleProps['onChange'])('')
    } else {
      (onChange as StandardProps['onChange'])(undefined)
    }
    setIsOpen(false)
  }

  // Render input field per simple variant
  if (variant === 'simple') {
    return (
      <div className={`relative ${className}`}>
        <div className="flex">
          <input
            type="email"
            value={value as string || ''}
            onChange={(e) => (onChange as SimpleProps['onChange'])(e.target.value)}
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
          <>
            <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
              {loading ? (
                <div className="p-3 text-center text-gray-500">Caricamento...</div>
              ) : (
                <>
                  {showTutti && (
                    <div
                      onClick={() => handleSelect('tutti')}
                      className="px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center space-x-2 border-b border-gray-100"
                    >
                      <Users className="h-4 w-4 text-purple-600" />
                      <span>Tutti gli utenti</span>
                    </div>
                  )}

                  {gruppi.length > 0 && (
                    <>
                      <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                        Gruppi
                      </div>
                      {gruppi.map((gruppo) => (
                        <div
                          key={gruppo.id}
                          onClick={() => handleSelect('gruppo', gruppo.id)}
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

                  {utenti.length > 0 && (
                    <>
                      <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                        Utenti
                      </div>
                      {utenti.map((utente) => (
                        <div
                          key={utente.id}
                          onClick={() => handleSelect('utente', utente.id)}
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
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          </>
        )}
      </div>
    )
  }

  // Render button dropdown per standard variant
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
            <div
              onClick={(e) => {
                e.stopPropagation()
                handleClear()
              }}
              className="p-1 hover:bg-gray-100 rounded cursor-pointer"
            >
              <X className="h-3 w-3 text-gray-400" />
            </div>
          )}
          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {isOpen && (
        <>
          <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
            {loading ? (
              <div className="p-3 text-center text-gray-500">Caricamento...</div>
            ) : (
              <>
                {showTutti && (
                  <button
                    onClick={() => handleSelect('tutti')}
                    className="w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center space-x-2 border-b border-gray-100"
                  >
                    <Users className="h-4 w-4 text-purple-600" />
                    <span>Tutti gli utenti</span>
                  </button>
                )}

                {gruppi.length > 0 && (
                  <>
                    <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                      Gruppi
                    </div>
                    {gruppi.map((gruppo) => (
                      <button
                        key={gruppo.id}
                        onClick={() => handleSelect('gruppo', gruppo.id)}
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

                {utenti.length > 0 && (
                  <>
                    <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                      Utenti
                    </div>
                    {utenti.map((utente) => (
                      <button
                        key={utente.id}
                        onClick={() => handleSelect('utente', utente.id)}
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
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
        </>
      )}
    </div>
  )
}
