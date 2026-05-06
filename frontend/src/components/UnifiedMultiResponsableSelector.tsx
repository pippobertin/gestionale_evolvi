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

// Type per MultipleResponsableSelector (con nome + colore)
export interface ResponsabileSelezionato {
  tipo: 'utente' | 'gruppo' | 'tutti'
  id: string
  nome: string
  colore?: string
}

// Type per MultiResponsableSelector (con email)
export interface Responsabile {
  type: 'utente' | 'gruppo'
  id: string
  nome: string
  email?: string
}

// Props per variante inline (chips dentro il dropdown)
interface InlineProps {
  variant?: 'inline'
  value?: ResponsabileSelezionato[]
  onChange: (responsabili: ResponsabileSelezionato[]) => void
}

// Props per variante external (chips fuori dal dropdown)
interface ExternalProps {
  variant: 'external'
  value: Responsabile[]
  onChange: (responsabili: Responsabile[]) => void
}

// Union type
type UnifiedMultiResponsableSelectorProps = (InlineProps | ExternalProps) & {
  className?: string
  placeholder?: string
  showTutti?: boolean
}

export default function UnifiedMultiResponsableSelector({
  variant = 'inline',
  value = [],
  onChange,
  className = '',
  placeholder = 'Seleziona responsabili...',
  showTutti = true
}: UnifiedMultiResponsableSelectorProps) {
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
    } catch (error: any) {
      console.error('Errore caricamento responsabili:', error?.message || error)
    } finally {
      setLoading(false)
    }
  }

  const getDisplayText = () => {
    const arrayValue = value as any[]
    if (arrayValue.length === 0) return placeholder
    if (arrayValue.length === 1) return arrayValue[0].nome
    return `${arrayValue.length} responsabili selezionati`
  }

  const isSelected = (tipo: string, id: string) => {
    const arrayValue = value as any[]
    if (variant === 'inline') {
      return arrayValue.some((r: ResponsabileSelezionato) => r.tipo === tipo && r.id === id)
    } else {
      return arrayValue.some((r: Responsabile) => r.type === tipo && r.id === id)
    }
  }

  const handleToggleSelection = (tipo: 'utente' | 'gruppo' | 'tutti', id: string) => {
    if (variant === 'inline') {
      const inlineValue = value as ResponsabileSelezionato[]
      const isCurrentlySelected = isSelected(tipo, id)
      const inlineOnChange = onChange as InlineProps['onChange']

      if (isCurrentlySelected) {
        // Rimuovi dalla selezione
        const updatedValue: ResponsabileSelezionato[] = inlineValue.filter(r => !(r.tipo === tipo && r.id === id))
        inlineOnChange(updatedValue)
      } else {
        // Aggiungi alla selezione
        if (tipo === 'tutti') {
          const resp: ResponsabileSelezionato = { tipo: 'tutti', id: 'tutti', nome: 'Tutti gli utenti' }
          // Se seleziono "tutti", rimuovi tutto il resto
          inlineOnChange([resp])
        } else if (tipo === 'gruppo') {
          const gruppo = gruppi.find(g => g.id === id)
          if (!gruppo) return
          const resp: ResponsabileSelezionato = {
            tipo: 'gruppo',
            id: gruppo.id,
            nome: gruppo.nome,
            colore: gruppo.colore_hex
          }
          // Rimuovi "tutti" se era selezionato
          const filtered: ResponsabileSelezionato[] = inlineValue.filter(r => r.tipo !== 'tutti')
          inlineOnChange([...filtered, resp])
        } else {
          const utente = utenti.find(u => u.id === id)
          if (!utente) return
          const resp: ResponsabileSelezionato = {
            tipo: 'utente',
            id: utente.id,
            nome: `${utente.nome} ${utente.cognome}`
          }
          // Rimuovi "tutti" se era selezionato
          const filtered: ResponsabileSelezionato[] = inlineValue.filter(r => r.tipo !== 'tutti')
          inlineOnChange([...filtered, resp])
        }
      }
    } else {
      // External variant: aggiungi solo, non toglie
      const externalValue = value as Responsabile[]
      const externalOnChange = onChange as ExternalProps['onChange']

      // Controlla se già presente
      if (isSelected(tipo, id)) {
        return
      }

      if (tipo === 'gruppo') {
        const gruppo = gruppi.find(g => g.id === id)
        if (!gruppo) return
        const resp: Responsabile = {
          type: 'gruppo',
          id: gruppo.id,
          nome: gruppo.nome
        }
        externalOnChange([...externalValue, resp])
      } else {
        const utente = utenti.find(u => u.id === id)
        if (!utente) return
        const resp: Responsabile = {
          type: 'utente',
          id: utente.id,
          nome: `${utente.nome} ${utente.cognome}`,
          email: utente.email
        }
        externalOnChange([...externalValue, resp])
      }

      setIsOpen(false)
    }
  }

  const handleRemove = (indexOrId: number | string) => {
    if (variant === 'inline') {
      const inlineValue = value as ResponsabileSelezionato[]
      const inlineOnChange = onChange as InlineProps['onChange']
      if (typeof indexOrId === 'string') {
        // Rimuovi per tipo+id
        const parts = indexOrId.split('-')
        const tipo = parts[0] as 'utente' | 'gruppo' | 'tutti'
        const id = parts.slice(1).join('-')
        const updatedValue: ResponsabileSelezionato[] = inlineValue.filter(r => !(r.tipo === tipo && r.id === id))
        inlineOnChange(updatedValue)
      }
    } else {
      const externalValue = value as Responsabile[]
      const externalOnChange = onChange as ExternalProps['onChange']
      if (typeof indexOrId === 'number') {
        const updatedValue: Responsabile[] = externalValue.filter((_, i) => i !== indexOrId)
        externalOnChange(updatedValue)
      }
    }
  }

  // External variant: chips esterni
  if (variant === 'external') {
    const externalValue = value as Responsabile[]

    return (
      <div className={`space-y-2 ${className}`}>
        {/* Lista responsabili selezionati */}
        {externalValue.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {externalValue.map((resp, index) => (
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

          {isOpen && (
            <>
              <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-80 overflow-y-auto">
                {loading ? (
                  <div className="p-4 text-center text-gray-500">Caricamento...</div>
                ) : (
                  <>
                    {/* Gruppi */}
                    {gruppi.length > 0 && (
                      <>
                        <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 sticky top-0">
                          Gruppi
                        </div>
                        {gruppi.map((gruppo) => {
                          const alreadySelected = isSelected('gruppo', gruppo.id)
                          return (
                            <button
                              key={gruppo.id}
                              type="button"
                              onClick={() => handleToggleSelection('gruppo', gruppo.id)}
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
                          const alreadySelected = isSelected('utente', utente.id)
                          return (
                            <button
                              key={utente.id}
                              type="button"
                              onClick={() => handleToggleSelection('utente', utente.id)}
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
              <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            </>
          )}
        </div>

        {externalValue.length === 0 && (
          <p className="text-xs text-gray-500 italic">
            Nessun responsabile selezionato. Le notifiche non verranno inviate.
          </p>
        )}
      </div>
    )
  }

  // Inline variant: chips dentro il button
  const inlineValue = value as ResponsabileSelezionato[]

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-left flex items-center justify-between hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 min-h-[40px]"
      >
        <div className="flex-1 flex flex-wrap gap-1">
          {inlineValue.length === 0 ? (
            <span className="text-gray-500">{placeholder}</span>
          ) : inlineValue.length <= 3 ? (
            // Mostra i chip singoli se sono pochi
            inlineValue.map((responsabile) => (
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
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemove(`${responsabile.tipo}-${responsabile.id}`)
                  }}
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
        <>
          <div className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
            {loading ? (
              <div className="p-3 text-center text-gray-500">Caricamento...</div>
            ) : (
              <>
                {showTutti && (
                  <button
                    onClick={() => handleToggleSelection('tutti', 'tutti')}
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
                )}

                {gruppi.length > 0 && (
                  <>
                    <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                      Gruppi
                    </div>
                    {gruppi.map((gruppo) => (
                      <button
                        key={gruppo.id}
                        onClick={() => handleToggleSelection('gruppo', gruppo.id)}
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

                {utenti.length > 0 && (
                  <>
                    <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                      Utenti
                    </div>
                    {utenti.map((utente) => (
                      <button
                        key={utente.id}
                        onClick={() => handleToggleSelection('utente', utente.id)}
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
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
        </>
      )}
    </div>
  )
}
