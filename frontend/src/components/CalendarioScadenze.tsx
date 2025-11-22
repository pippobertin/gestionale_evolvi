'use client'

import React, { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Calendar, Clock } from 'lucide-react'

interface Scadenza {
  id: string
  titolo: string
  data_scadenza: string
  stato: 'non_iniziata' | 'in_corso' | 'completata'
  urgenza: 'NORMALE' | 'IMMINENTE' | 'URGENTE'
  cliente_nome: string
  tipo_scadenza_nome: string
  giorni_rimanenti: number
}

interface CalendarioScadenzeProps {
  scadenze: Scadenza[]
  mesiDaVisualizzare?: number
  onDayClick?: (date: Date) => void
}

export default function CalendarioScadenze({ scadenze, mesiDaVisualizzare = 3, onDayClick }: CalendarioScadenzeProps) {
  const [currentDate, setCurrentDate] = useState(new Date())

  // Naviga mese precedente/successivo
  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  // Calcola i mesi da visualizzare
  const calendarData = useMemo(() => {
    const mesi = []

    for (let i = 0; i < mesiDaVisualizzare; i++) {
      const meseDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1)
      const year = meseDate.getFullYear()
      const month = meseDate.getMonth()

      // Primo e ultimo giorno del mese
      const firstDay = new Date(year, month, 1)
      const lastDay = new Date(year, month + 1, 0)

      // Primo lunedì da mostrare (può essere del mese precedente)
      const startDate = new Date(firstDay)
      startDate.setDate(startDate.getDate() - (startDate.getDay() === 0 ? 6 : startDate.getDay() - 1))

      // Ultimo giorno da mostrare (per completare la griglia)
      const endDate = new Date(lastDay)
      const daysToAdd = 7 - (endDate.getDay() === 0 ? 7 : endDate.getDay())
      endDate.setDate(endDate.getDate() + (daysToAdd === 7 ? 0 : daysToAdd))

      // Genera array di giorni per questo mese
      const days = []
      const current = new Date(startDate)

      while (current <= endDate) {
        days.push(new Date(current))
        current.setDate(current.getDate() + 1)
      }

      mesi.push({
        date: meseDate,
        days: days
      })
    }

    return mesi
  }, [currentDate, mesiDaVisualizzare])

  // Helper per normalizzare date evitando problemi di fuso orario
  const formatDateKey = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Raggruppa scadenze per data
  const scadenzePerGiorno = useMemo(() => {
    const grouped: { [key: string]: Scadenza[] } = {}

    scadenze.forEach(scadenza => {
      // Gestisci correttamente le date evitando problemi di fuso orario
      const dateStr = scadenza.data_scadenza

      // Se la data è solo YYYY-MM-DD, aggiungilo in formato locale
      let dateKey: string
      if (dateStr.includes('T')) {
        // Data con orario - usa la data così com'è
        const scadenzaDate = new Date(dateStr)
        dateKey = formatDateKey(scadenzaDate)
      } else {
        // Data senza orario - usa direttamente la stringa per evitare conversioni UTC
        dateKey = dateStr
      }

      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(scadenza)
    })

    return grouped
  }, [scadenze])

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
  }

  const isToday = (date: Date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  const isCurrentMonth = (date: Date, meseRiferimento: Date) => {
    return date.getMonth() === meseRiferimento.getMonth() && date.getFullYear() === meseRiferimento.getFullYear()
  }

  const getScadenzeForDay = (date: Date) => {
    const dateKey = formatDateKey(date)
    return scadenzePerGiorno[dateKey] || []
  }

  const getUrgencyColor = (urgenza: string, stato?: string) => {
    // Se è completata, usa sempre verde con opacità
    if (stato === 'completata') {
      return 'bg-green-500 opacity-60'
    }

    switch (urgenza) {
      case 'URGENTE': return 'bg-red-500'
      case 'IMMINENTE': return 'bg-orange-500'
      default: return 'bg-blue-500'
    }
  }

  // Determina se usare vista compatta
  const isCompactView = mesiDaVisualizzare > 1

  // Layout griglia per vista compatta
  const getGridLayout = () => {
    switch (mesiDaVisualizzare) {
      case 2: return 'grid-cols-1 lg:grid-cols-2'
      case 3: return 'grid-cols-1 lg:grid-cols-3'
      case 12: return 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
      default: return 'grid-cols-1'
    }
  }

  if (isCompactView) {
    return (
      <div className="bg-white rounded-lg shadow">
        {/* Header globale per vista compatta */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Panoramica {mesiDaVisualizzare === 12 ? 'Annuale' : `${mesiDaVisualizzare} Mesi`}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={previousMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Periodo precedente"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={nextMonth}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Periodo successivo"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Griglia compatta dei mesi */}
        <div className={`p-4 grid gap-4 ${getGridLayout()}`}>
          {calendarData.map((meseData) => (
            <div key={`${meseData.date.getFullYear()}-${meseData.date.getMonth()}`} className="border border-gray-200 rounded-lg">
              {/* Header compatto del mese */}
              <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
                <h3 className="text-sm font-medium text-gray-900 text-center">
                  {meseData.date.toLocaleDateString('it-IT', { month: 'short', year: 'numeric' }).toUpperCase()}
                </h3>
              </div>

              {/* Intestazioni giorni compatte */}
              <div className="grid grid-cols-7 gap-0 text-xs">
                {['L', 'M', 'M', 'G', 'V', 'S', 'D'].map((giorno, idx) => (
                  <div key={`${giorno}-${idx}`} className="p-1 text-center font-medium text-gray-400 bg-gray-50">
                    {giorno}
                  </div>
                ))}
              </div>

              {/* Griglia compatta del calendario */}
              <div className="grid grid-cols-7 gap-0">
                {meseData.days.map((date, index) => {
                  const scadenzeGiorno = getScadenzeForDay(date)
                  const isCurrentMonthDay = isCurrentMonth(date, meseData.date)
                  const isTodayDay = isToday(date)

                  // Raggruppa scadenze per urgenza e stato
                  const completate = scadenzeGiorno.filter(s => s.stato === 'completata').length
                  const urgenti = scadenzeGiorno.filter(s => s.urgenza === 'URGENTE' && s.stato !== 'completata').length
                  const imminenti = scadenzeGiorno.filter(s => s.urgenza === 'IMMINENTE' && s.stato !== 'completata').length
                  const normali = scadenzeGiorno.filter(s => s.urgenza === 'NORMALE' && s.stato !== 'completata').length
                  const totaleScadenze = scadenzeGiorno.length

                  // Determina lo stile enfatizzato per giorni con molte scadenze
                  const getIntensityStyle = (count: number) => {
                    if (count === 0) return ''
                    if (count === 1) return 'ring-1 ring-blue-200'
                    if (count <= 3) return 'ring-2 ring-blue-300 bg-blue-50'
                    if (count <= 5) return 'ring-2 ring-orange-300 bg-orange-50'
                    return 'ring-2 ring-red-300 bg-red-50'
                  }

                  return (
                    <div
                      key={index}
                      className={`aspect-square p-1 border-r border-b border-gray-100 last:border-r-0 relative group ${
                        scadenzeGiorno.length > 0 && onDayClick ? 'cursor-pointer' : ''
                      } ${!isCurrentMonthDay ? 'bg-gray-50' : ''} ${
                        isTodayDay ? 'bg-blue-50 ring-2 ring-blue-400' : getIntensityStyle(totaleScadenze)
                      } hover:bg-blue-50 transition-all duration-200`}
                      title={scadenzeGiorno.length > 0 ? scadenzeGiorno.map(s => `${s.titolo} - ${s.cliente_nome}`).join('\n') : ''}
                      onClick={scadenzeGiorno.length > 0 && onDayClick ? () => onDayClick(date) : undefined}
                    >
                      {/* Numero del giorno */}
                      <div className="text-xs font-medium text-center mb-1">
                        <span
                          className={`${
                            !isCurrentMonthDay
                              ? 'text-gray-300'
                              : isTodayDay
                              ? 'text-blue-600 font-bold'
                              : 'text-gray-700'
                          }`}
                        >
                          {date.getDate()}
                        </span>
                      </div>

                      {/* Indicatori scadenze compatti */}
                      {totaleScadenze > 0 && (
                        <div className="flex flex-col gap-0.5 items-center">
                          {/* Pallini per urgenza e stato */}
                          <div className="flex gap-0.5 justify-center">
                            {urgenti > 0 && (
                              <div className="w-2 h-2 bg-red-500 rounded-full" title={`${urgenti} urgenti`}></div>
                            )}
                            {imminenti > 0 && (
                              <div className="w-2 h-2 bg-orange-500 rounded-full" title={`${imminenti} imminenti`}></div>
                            )}
                            {normali > 0 && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full" title={`${normali} normali`}></div>
                            )}
                            {completate > 0 && (
                              <div className="w-2 h-2 bg-green-500 rounded-full" title={`${completate} completate`}></div>
                            )}
                          </div>

                          {/* Numero totale enfatizzato per molte scadenze */}
                          {totaleScadenze > 3 && (
                            <div className={`text-xs font-bold px-1 py-0.5 rounded ${
                              totaleScadenze <= 5
                                ? 'bg-orange-500 text-white'
                                : 'bg-red-500 text-white animate-pulse'
                            }`}>
                              {totaleScadenze}
                            </div>
                          )}
                          {totaleScadenze > 0 && totaleScadenze <= 3 && (
                            <span className="text-xs text-gray-700 font-semibold">
                              {totaleScadenze}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Tooltip dettagliato su hover per desktop */}
                      {scadenzeGiorno.length > 0 && (
                        <div className="hidden group-hover:block absolute z-10 top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-2 min-w-48 max-w-64">
                          <div className="text-xs font-medium text-gray-900 mb-1">
                            {date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                          </div>
                          <div className="space-y-1">
                            {scadenzeGiorno.slice(0, 5).map((scadenza) => (
                              <div key={scadenza.id} className="text-xs">
                                <div className={`inline-block w-2 h-2 rounded-full mr-1 ${getUrgencyColor(scadenza.urgenza, scadenza.stato)}`}></div>
                                <span className={`font-medium ${scadenza.stato === 'completata' ? 'line-through text-gray-500' : ''}`}>{scadenza.titolo}</span>
                                {scadenza.cliente_nome && (
                                  <span className="text-gray-500"> - {scadenza.cliente_nome}</span>
                                )}
                              </div>
                            ))}
                            {scadenzeGiorno.length > 5 && onDayClick && (
                              <button
                                onClick={() => onDayClick(date)}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium underline cursor-pointer"
                              >
                                +{scadenzeGiorno.length - 5} altre
                              </button>
                            )}
                            {scadenzeGiorno.length > 5 && !onDayClick && (
                              <div className="text-xs text-gray-500 font-medium">
                                +{scadenzeGiorno.length - 5} altre
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Legenda per vista compatta */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span className="text-gray-600">Legenda:</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded"></div>
              <span className="text-gray-600">Urgente</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-orange-500 rounded"></div>
              <span className="text-gray-600">Imminente</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded"></div>
              <span className="text-gray-600">Normale</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded"></div>
              <span className="text-gray-600">Completata</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Vista dettagliata per singolo mese
  return (
    <div className="space-y-6">
      {calendarData.map((meseData, meseIndex) => (
        <div key={`${meseData.date.getFullYear()}-${meseData.date.getMonth()}`} className="bg-white rounded-lg shadow">
          {/* Header del calendario */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 capitalize">
              {formatMonthYear(meseData.date)}
            </h2>
            {meseIndex === 0 && (
              <div className="flex gap-2">
                <button
                  onClick={previousMonth}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Periodo precedente"
                >
                  <ChevronLeft className="w-5 h-5 text-gray-600" />
                </button>
                <button
                  onClick={nextMonth}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  aria-label="Periodo successivo"
                >
                  <ChevronRight className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            )}
          </div>

          {/* Intestazioni giorni della settimana */}
          <div className="grid grid-cols-7 gap-0 border-b border-gray-200">
            {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map((giorno) => (
              <div key={giorno} className="p-3 text-center text-sm font-medium text-gray-500">
                {giorno}
              </div>
            ))}
          </div>

          {/* Griglia del calendario */}
          <div className="grid grid-cols-7 gap-0">
            {meseData.days.map((date, index) => {
              const scadenzeGiorno = getScadenzeForDay(date)
              const isCurrentMonthDay = isCurrentMonth(date, meseData.date)
              const isTodayDay = isToday(date)

              return (
                <div
                  key={index}
                  className={`min-h-[120px] p-2 border-r border-b border-gray-200 last:border-r-0 ${
                    !isCurrentMonthDay ? 'bg-gray-50' : ''
                  } ${isTodayDay ? 'bg-blue-50' : ''} ${
                    scadenzeGiorno.length > 0 && onDayClick ? 'cursor-pointer hover:bg-blue-50' : ''
                  }`}
                  onClick={scadenzeGiorno.length > 0 && onDayClick ? () => onDayClick(date) : undefined}
                >
                  {/* Numero del giorno */}
                  <div className="flex justify-between items-start mb-2">
                    <span
                      className={`text-sm font-medium ${
                        !isCurrentMonthDay
                          ? 'text-gray-400'
                          : isTodayDay
                          ? 'text-blue-600 font-bold'
                          : 'text-gray-900'
                      }`}
                    >
                      {date.getDate()}
                    </span>
                    {isTodayDay && (
                      <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    )}
                  </div>

                  {/* Scadenze del giorno */}
                  <div className="space-y-1">
                    {scadenzeGiorno.slice(0, 3).map((scadenza) => (
                      <div
                        key={scadenza.id}
                        className={`text-xs p-1 rounded text-white truncate cursor-pointer hover:opacity-80 transition-opacity ${getUrgencyColor(scadenza.urgenza, scadenza.stato)} ${
                          scadenza.stato === 'completata' ? 'line-through' : ''
                        }`}
                        title={`${scadenza.titolo} - ${scadenza.cliente_nome || 'Cliente N/D'} ${scadenza.stato === 'completata' ? '(Completata)' : ''}`}
                      >
                        <div className="truncate font-medium">
                          {scadenza.titolo}
                        </div>
                        {scadenza.cliente_nome && (
                          <div className="truncate opacity-90">
                            {scadenza.cliente_nome}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Indicatore per scadenze aggiuntive */}
                    {scadenzeGiorno.length > 3 && onDayClick && (
                      <button
                        onClick={() => onDayClick(date)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium underline cursor-pointer"
                      >
                        +{scadenzeGiorno.length - 3} altre
                      </button>
                    )}
                    {scadenzeGiorno.length > 3 && !onDayClick && (
                      <div className="text-xs text-gray-500 font-medium">
                        +{scadenzeGiorno.length - 3} altre
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Legenda per vista dettagliata */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="text-gray-600">Legenda:</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span className="text-gray-600">Urgente</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-orange-500 rounded"></div>
            <span className="text-gray-600">Imminente</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span className="text-gray-600">Normale</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span className="text-gray-600">Completata</span>
          </div>
        </div>
      </div>
    </div>
  )
}