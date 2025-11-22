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

interface CalendarioSettimanaProps {
  scadenze: Scadenza[]
  onDayClick?: (date: Date) => void
}

export default function CalendarioSettimana({ scadenze, onDayClick }: CalendarioSettimanaProps) {
  const [currentDate, setCurrentDate] = useState(new Date())

  // Naviga settimana precedente/successiva
  const previousWeek = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(currentDate.getDate() - 7)
    setCurrentDate(newDate)
  }

  const nextWeek = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(currentDate.getDate() + 7)
    setCurrentDate(newDate)
  }

  // Calcola i giorni della settimana corrente
  const weekDays = useMemo(() => {
    const startOfWeek = new Date(currentDate)
    // Trova il lunedì di questa settimana
    const day = startOfWeek.getDay()
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1)
    startOfWeek.setDate(diff)

    const days = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek)
      date.setDate(startOfWeek.getDate() + i)
      days.push(date)
    }

    return days
  }, [currentDate])

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
      const dateStr = scadenza.data_scadenza

      let dateKey: string
      if (dateStr.includes('T')) {
        const scadenzaDate = new Date(dateStr)
        dateKey = formatDateKey(scadenzaDate)
      } else {
        dateKey = dateStr
      }

      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(scadenza)
    })

    return grouped
  }, [scadenze])

  const isToday = (date: Date) => {
    const today = new Date()
    return date.toDateString() === today.toDateString()
  }

  const getScadenzeForDay = (date: Date) => {
    const dateKey = formatDateKey(date)
    return scadenzePerGiorno[dateKey] || []
  }

  const getUrgencyColor = (urgenza: string, stato?: string) => {
    if (stato === 'completata') {
      return 'bg-green-500 opacity-60'
    }

    switch (urgenza) {
      case 'URGENTE': return 'bg-red-500'
      case 'IMMINENTE': return 'bg-orange-500'
      default: return 'bg-blue-500'
    }
  }

  const formatWeekRange = () => {
    const start = weekDays[0]
    const end = weekDays[6]

    if (start.getMonth() === end.getMonth()) {
      return `${start.getDate()} - ${end.getDate()} ${start.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}`
    } else {
      return `${start.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}`
    }
  }

  const dayNames = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header della settimana */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">
          {formatWeekRange()}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={previousWeek}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Settimana precedente"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <button
            onClick={nextWeek}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Settimana successiva"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Griglia settimanale */}
      <div className="grid grid-cols-7 gap-0 items-start">
        {weekDays.map((date, index) => {
          const scadenzeGiorno = getScadenzeForDay(date)
          const isTodayDay = isToday(date)
          const isWeekend = index >= 5

          return (
            <div
              key={index}
              className={`min-h-[400px] p-3 border-r border-gray-200 last:border-r-0 flex flex-col ${
                isWeekend ? 'bg-gray-50' : ''
              } ${isTodayDay ? 'bg-blue-50 ring-2 ring-blue-200' : ''} ${
                scadenzeGiorno.length > 0 && onDayClick ? 'cursor-pointer hover:bg-blue-50' : ''
              } transition-colors`}
              onClick={scadenzeGiorno.length > 0 && onDayClick ? () => onDayClick(date) : undefined}
            >
              {/* Header del giorno */}
              <div className="border-b border-gray-200 pb-2 mb-3 flex-shrink-0">
                <div className="text-sm font-medium text-gray-500">
                  {dayNames[index]}
                </div>
                <div className={`text-2xl font-bold ${
                  isTodayDay ? 'text-blue-600' : 'text-gray-900'
                }`}>
                  {date.getDate()}
                </div>
                <div className="text-xs text-gray-400">
                  {date.toLocaleDateString('it-IT', { month: 'short' }).toUpperCase()}
                </div>
              </div>

              {/* Scadenze del giorno */}
              <div className="space-y-2 flex-1">
                {scadenzeGiorno.map((scadenza) => (
                  <div
                    key={scadenza.id}
                    className={`text-xs p-2 rounded-md text-white cursor-pointer hover:opacity-80 transition-all duration-200 ${getUrgencyColor(scadenza.urgenza, scadenza.stato)} ${
                      scadenza.stato === 'completata' ? 'line-through' : ''
                    } hover:scale-105 hover:shadow-md`}
                    title={`${scadenza.titolo} - ${scadenza.cliente_nome || 'Cliente N/D'} ${scadenza.stato === 'completata' ? '(Completata)' : ''}`}
                  >
                    {/* Titolo scadenza */}
                    <div className="font-semibold mb-1 leading-tight">
                      {scadenza.titolo}
                    </div>

                    {/* Cliente */}
                    {scadenza.cliente_nome && (
                      <div className="opacity-90 truncate text-xs">
                        📄 {scadenza.cliente_nome}
                      </div>
                    )}

                    {/* Tipo e urgenza */}
                    <div className="flex items-center justify-between mt-1 text-xs">
                      <span className="opacity-80 truncate">
                        {scadenza.tipo_scadenza_nome}
                      </span>
                      {scadenza.giorni_rimanenti <= 3 && scadenza.giorni_rimanenti >= 0 && scadenza.stato !== 'completata' && (
                        <span className="bg-white bg-opacity-20 px-1 py-0.5 rounded text-xs font-bold">
                          {scadenza.giorni_rimanenti === 0 ? 'OGGI' : `${scadenza.giorni_rimanenti}g`}
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                {/* Messaggio quando non ci sono scadenze */}
                {scadenzeGiorno.length === 0 && (
                  <div className="text-gray-400 text-center py-8">
                    <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nessuna scadenza</p>
                  </div>
                )}
              </div>

              {/* Statistiche giornaliere */}
              {scadenzeGiorno.length > 0 && (
                <div className="mt-3 pt-2 border-t border-gray-200 flex-shrink-0">
                  <div className="flex items-center justify-center gap-2 text-xs">
                    <span className="text-gray-600">
                      {scadenzeGiorno.length} scadenz{scadenzeGiorno.length === 1 ? 'a' : 'e'}
                    </span>
                    {scadenzeGiorno.some(s => s.urgenza === 'URGENTE' && s.stato !== 'completata') && (
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" title="Urgenti presenti" />
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer con statistiche settimanali e legenda */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Statistiche settimanali */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-700">Statistiche Settimana</h4>
            <div className="flex flex-wrap gap-3 text-sm">
              {(() => {
                const weekScadenze = weekDays.flatMap(day => getScadenzeForDay(day))
                const totali = weekScadenze.length
                const completate = weekScadenze.filter(s => s.stato === 'completata').length
                const urgenti = weekScadenze.filter(s => s.urgenza === 'URGENTE' && s.stato !== 'completata').length
                const imminenti = weekScadenze.filter(s => s.urgenza === 'IMMINENTE' && s.stato !== 'completata').length

                return (
                  <>
                    <span className="text-gray-600">
                      <span className="font-medium">{totali}</span> totali
                    </span>
                    <span className="text-green-600">
                      <span className="font-medium">{completate}</span> completate
                    </span>
                    {urgenti > 0 && (
                      <span className="text-red-600">
                        <span className="font-medium">{urgenti}</span> urgenti
                      </span>
                    )}
                    {imminenti > 0 && (
                      <span className="text-orange-600">
                        <span className="font-medium">{imminenti}</span> imminenti
                      </span>
                    )}
                  </>
                )
              })()}
            </div>
          </div>

          {/* Legenda */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-700">Legenda</h4>
            <div className="flex flex-wrap gap-3 text-sm">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-red-500 rounded"></div>
                <span className="text-gray-600">Urgente</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-orange-500 rounded"></div>
                <span className="text-gray-600">Imminente</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-blue-500 rounded"></div>
                <span className="text-gray-600">Normale</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span className="text-gray-600">Completata</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}