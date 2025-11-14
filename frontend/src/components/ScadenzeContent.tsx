'use client'

import React, { useState, useEffect } from 'react'
import { Calendar, List, Clock, AlertTriangle, CheckCircle, Plus, Filter } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import CalendarioScadenze from './CalendarioScadenze'
import ScadenzaForm from './ScadenzaForm'

interface Scadenza {
  id: string
  titolo: string
  data_scadenza: string
  stato: 'non_iniziata' | 'in_corso' | 'completata'
  priorita: 'bassa' | 'media' | 'alta'
  responsabile_email: string
  note: string
  giorni_rimanenti: number
  urgenza: 'NORMALE' | 'IMMINENTE' | 'URGENTE'
  cliente_nome: string
  cliente_email: string
  tipo_scadenza_nome: string
  progetto_id: string
  progetto_titolo: string
  progetto_codice: string
  bando_nome: string
  bando_id: string
}

type ViewMode = 'lista' | 'calendario'

export default function ScadenzeContent() {
  const [scadenze, setScadenze] = useState<Scadenza[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('calendario')
  const [filtroUrgenza, setFiltroUrgenza] = useState<string>('tutti')
  const [filtroStato, setFiltroStato] = useState<string>('tutti')
  const [filtroCliente, setFiltroCliente] = useState<string>('tutti')
  const [filtroBando, setFiltroBando] = useState<string>('tutti')
  const [filtroProgetto, setFiltroProgetto] = useState<string>('tutti')
  const [showNuovaScadenza, setShowNuovaScadenza] = useState(false)
  const [showCompletaModal, setShowCompletaModal] = useState(false)
  const [scadenzaDaCompletare, setScadenzaDaCompletare] = useState<Scadenza | null>(null)
  const [noteCompletamento, setNoteCompletamento] = useState('')
  const [calendarioMesi, setCalendarioMesi] = useState<number>(1) // 1, 2, 3, 12 mesi
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showDayModal, setShowDayModal] = useState(false)

  // Carica scadenze
  useEffect(() => {
    fetchScadenze()
  }, [])

  const fetchScadenze = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('scadenze_bandi_scadenze')
        .select(`
          id,
          titolo,
          data_scadenza,
          stato,
          priorita,
          responsabile_email,
          note,
          progetto_id,
          bando_id,
          cliente_id,
          scadenze_bandi_progetti:progetto_id (
            titolo_progetto,
            codice_progetto
          ),
          scadenze_bandi_bandi:bando_id (
            nome
          ),
          scadenze_bandi_clienti:cliente_id (
            denominazione,
            email
          )
        `)
        .order('data_scadenza', { ascending: true })

      if (error) throw error

      // Processa i dati per calcolare urgenza e giorni rimanenti
      const scadenzeProcessate = (data || []).map(item => {
        const today = new Date()
        const dataScadenza = new Date(item.data_scadenza)
        const diffTime = dataScadenza.getTime() - today.getTime()
        const giorni_rimanenti = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

        let urgenza: 'NORMALE' | 'IMMINENTE' | 'URGENTE' = 'NORMALE'
        if (giorni_rimanenti < 0) urgenza = 'URGENTE'
        else if (giorni_rimanenti <= 7) urgenza = 'IMMINENTE'

        return {
          ...item,
          giorni_rimanenti,
          urgenza,
          cliente_nome: item.scadenze_bandi_clienti?.denominazione || 'N/D',
          cliente_email: item.scadenze_bandi_clienti?.email || 'N/D',
          progetto_titolo: item.scadenze_bandi_progetti?.titolo_progetto || 'N/D',
          progetto_codice: item.scadenze_bandi_progetti?.codice_progetto || 'N/D',
          bando_nome: item.scadenze_bandi_bandi?.nome || 'N/D',
          tipo_scadenza_nome: item.titolo
        }
      })

      setScadenze(scadenzeProcessate)
    } catch (err: any) {
      console.error('Errore nel caricamento scadenze:', err)
      setError('Errore nel caricamento delle scadenze')
    } finally {
      setLoading(false)
    }
  }

  // Filtra scadenze
  const scadenzeFiltrate = scadenze.filter(scadenza => {
    if (filtroUrgenza !== 'tutti' && scadenza.urgenza !== filtroUrgenza) {
      return false
    }
    if (filtroStato !== 'tutti' && scadenza.stato !== filtroStato) {
      return false
    }
    if (filtroCliente !== 'tutti' && scadenza.cliente_nome !== filtroCliente) {
      return false
    }
    if (filtroBando !== 'tutti' && scadenza.bando_nome !== filtroBando) {
      return false
    }
    if (filtroProgetto !== 'tutti' && scadenza.progetto_codice !== filtroProgetto) {
      return false
    }
    return true
  })

  // Ottieni valori unici per i filtri
  const clientiUnici = [...new Set(scadenze.map(s => s.cliente_nome).filter(Boolean))].sort()
  const bandiUnici = [...new Set(scadenze.map(s => s.bando_nome).filter(Boolean))].sort()
  const progettiUnici = [...new Set(scadenze.map(s => s.progetto_codice).filter(Boolean))].sort()

  // Raggruppa scadenze per urgenza
  const urgenti = scadenzeFiltrate.filter(s => s.urgenza === 'URGENTE')
  const imminenti = scadenzeFiltrate.filter(s => s.urgenza === 'IMMINENTE')
  const normali = scadenzeFiltrate.filter(s => s.urgenza === 'NORMALE')

  const getPriorityColor = (urgenza: string) => {
    switch (urgenza) {
      case 'URGENTE': return 'bg-red-100 border-red-500 text-red-800'
      case 'IMMINENTE': return 'bg-orange-100 border-orange-500 text-orange-800'
      default: return 'bg-gray-100 border-gray-300 text-gray-700'
    }
  }

  const getStatoColor = (stato: string) => {
    switch (stato) {
      case 'completata': return 'bg-green-100 text-green-800'
      case 'in_corso': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-600'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const handleScadenzaCreata = () => {
    fetchScadenze() // Ricarica la lista scadenze
    setShowNuovaScadenza(false) // Chiude il modale
  }

  // Gestione cambio stato scadenza
  const handleStatoChange = async (scadenza: Scadenza, nuovoStato: string) => {
    if (nuovoStato === 'completata') {
      setScadenzaDaCompletare(scadenza)
      setShowCompletaModal(true)
    } else {
      await updateScadenzaStato(scadenza.id, nuovoStato)
    }
  }

  // Aggiorna stato scadenza con cascata
  const updateScadenzaStato = async (scadenzaId: string, nuovoStato: string, note?: string) => {
    try {
      const updateData: any = {
        stato: nuovoStato
      }

      if (nuovoStato === 'completata') {
        updateData.completata_il = new Date().toISOString()
        if (note) updateData.note_completamento = note
      }

      const { error } = await supabase
        .from('scadenze_bandi_scadenze')
        .update(updateData)
        .eq('id', scadenzaId)

      if (error) throw error

      // Aggiorna le scadenze locali
      setScadenze(prev => prev.map(s =>
        s.id === scadenzaId
          ? { ...s, stato: nuovoStato as any }
          : s
      ))

      // Gestisci aggiornamenti a cascata
      await handleCascadeUpdates(scadenzaId, nuovoStato)

    } catch (error) {
      console.error('Errore aggiornamento stato scadenza:', error)
    }
  }

  // Aggiornamenti a cascata per progetto/cliente
  const handleCascadeUpdates = async (scadenzaId: string, nuovoStato: string) => {
    try {
      const scadenza = scadenze.find(s => s.id === scadenzaId)
      if (!scadenza) return

      // Caso 1: Scadenza di progetto - controlla se tutte completate
      if (scadenza.progetto_id) {
        const scadenzeProgetto = scadenze.filter(s => s.progetto_id === scadenza.progetto_id)
        const tutteCompletate = scadenzeProgetto.every(s =>
          s.id === scadenzaId ? nuovoStato === 'completata' : s.stato === 'completata'
        )

        if (tutteCompletate) {
          console.log(`🎉 Tutte le scadenze del progetto ${scadenza.progetto_codice} completate!`)
          // Aggiorna stato progetto se necessario
          await supabase
            .from('scadenze_bandi_progetti')
            .update({ stato: 'COMPLETATO' })
            .eq('id', scadenza.progetto_id)
        }
      }

      // Caso 2: Scadenza tipo "contratto" - aggiorna cliente
      if (scadenza.titolo.toLowerCase().includes('contratto') && nuovoStato === 'completata') {
        console.log(`📋 Contratto completato per cliente ${scadenza.cliente_nome}`)
        // Qui puoi aggiungere logiche specifiche per il cliente
      }

    } catch (error) {
      console.error('Errore aggiornamenti a cascata:', error)
    }
  }

  // Completa scadenza con note
  const completaScadenza = async () => {
    if (!scadenzaDaCompletare) return

    await updateScadenzaStato(scadenzaDaCompletare.id, 'completata', noteCompletamento)

    setShowCompletaModal(false)
    setScadenzaDaCompletare(null)
    setNoteCompletamento('')
  }

  // Gestione modal giorno
  const openDayModal = (date: Date) => {
    setSelectedDate(date.toISOString().split('T')[0])
    setShowDayModal(true)
  }

  const closeDayModal = () => {
    setSelectedDate(null)
    setShowDayModal(false)
  }

  // Ottieni scadenze per la data selezionata
  const getSelectedDateScadenze = () => {
    if (!selectedDate) return []
    return scadenzeFiltrate.filter(s =>
      new Date(s.data_scadenza).toISOString().split('T')[0] === selectedDate
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Gestione Scadenze</h1>
        <button
          onClick={() => setShowNuovaScadenza(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nuova Scadenza
        </button>
      </div>

      {/* Statistiche Rapide */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-600">Urgenti</p>
              <p className="text-2xl font-bold text-red-900">{urgenti.length}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
        </div>

        <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-600">Imminenti</p>
              <p className="text-2xl font-bold text-orange-900">{imminenti.length}</p>
            </div>
            <Clock className="w-8 h-8 text-orange-600" />
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Normali</p>
              <p className="text-2xl font-bold text-gray-900">{normali.length}</p>
            </div>
            <Calendar className="w-8 h-8 text-gray-600" />
          </div>
        </div>

        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">Completate</p>
              <p className="text-2xl font-bold text-green-900">
                {scadenze.filter(s => s.stato === 'completata').length}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>
      </div>

      {/* Controlli Vista e Filtri */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        {/* Toggle Vista */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('lista')}
            className={`px-4 py-2 rounded-md flex items-center gap-2 transition-colors ${
              viewMode === 'lista'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-blue-600'
            }`}
          >
            <List className="w-4 h-4" />
            Lista
          </button>
          <button
            onClick={() => setViewMode('calendario')}
            className={`px-4 py-2 rounded-md flex items-center gap-2 transition-colors ${
              viewMode === 'calendario'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-blue-600'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Calendario
          </button>
        </div>

        {/* Filtri */}
        <div className="flex gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={filtroUrgenza}
              onChange={(e) => setFiltroUrgenza(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1 text-sm"
            >
              <option value="tutti">Tutte le urgenze</option>
              <option value="URGENTE">Solo urgenti</option>
              <option value="IMMINENTE">Solo imminenti</option>
              <option value="NORMALE">Solo normali</option>
            </select>
          </div>

          <select
            value={filtroStato}
            onChange={(e) => setFiltroStato(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm"
          >
            <option value="tutti">Tutti gli stati</option>
            <option value="non_iniziata">Da fare</option>
            <option value="in_corso">In corso</option>
            <option value="completata">Completate</option>
          </select>

          <select
            value={filtroCliente}
            onChange={(e) => setFiltroCliente(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm"
          >
            <option value="tutti">Tutti i clienti</option>
            {clientiUnici.map(cliente => (
              <option key={cliente} value={cliente}>{cliente}</option>
            ))}
          </select>

          <select
            value={filtroBando}
            onChange={(e) => setFiltroBando(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm"
          >
            <option value="tutti">Tutti i bandi</option>
            {bandiUnici.map(bando => (
              <option key={bando} value={bando}>{bando}</option>
            ))}
          </select>

          <select
            value={filtroProgetto}
            onChange={(e) => setFiltroProgetto(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm"
          >
            <option value="tutti">Tutti i progetti</option>
            {progettiUnici.map(progetto => (
              <option key={progetto} value={progetto}>{progetto}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Vista Lista */}
      {viewMode === 'lista' && (
        <div className="bg-white rounded-lg shadow">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Scadenza
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Progetto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bando
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Giorni Rim.
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Urgenza
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stato
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {scadenzeFiltrate.map((scadenza) => (
                  <tr key={scadenza.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {scadenza.titolo || scadenza.note}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {scadenza.cliente_nome || 'N/D'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        <div className="font-medium">{scadenza.progetto_titolo || 'N/D'}</div>
                        <div className="text-gray-500 text-xs truncate max-w-32">
                          {scadenza.progetto_codice || 'N/D'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {scadenza.bando_nome || 'N/D'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(scadenza.data_scadenza)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium ${
                        scadenza.giorni_rimanenti < 0 ? 'text-red-600' :
                        scadenza.giorni_rimanenti <= 2 ? 'text-red-600' :
                        scadenza.giorni_rimanenti <= 7 ? 'text-orange-600' :
                        'text-gray-900'
                      }`}>
                        {scadenza.giorni_rimanenti < 0
                          ? `${Math.abs(scadenza.giorni_rimanenti)} gg fa`
                          : `${scadenza.giorni_rimanenti} gg`
                        }
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(scadenza.urgenza)}`}>
                        {scadenza.urgenza}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={scadenza.stato}
                        onChange={(e) => handleStatoChange(scadenza, e.target.value)}
                        className={`text-xs font-semibold rounded px-2 py-1 border-0 ${getStatoColor(scadenza.stato)}`}
                      >
                        <option value="non_iniziata">Da fare</option>
                        <option value="in_corso">In corso</option>
                        <option value="completata">Completata</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {scadenzeFiltrate.length === 0 && (
            <div className="text-center py-12">
              <Clock className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Nessuna scadenza</h3>
              <p className="mt-1 text-sm text-gray-500">
                Non ci sono scadenze che corrispondono ai filtri selezionati.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Vista Calendario */}
      {viewMode === 'calendario' && (
        <div className="space-y-4">
          {/* Selettore durata calendario */}
          <div className="flex justify-end items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Visualizza:</span>
            <select
              value={calendarioMesi}
              onChange={(e) => setCalendarioMesi(Number(e.target.value))}
              className="border border-gray-300 rounded-md px-3 py-1 text-sm"
            >
              <option value={1}>1 mese</option>
              <option value={2}>2 mesi</option>
              <option value={3}>3 mesi</option>
              <option value={12}>Anno intero</option>
            </select>
          </div>

          <CalendarioScadenze
            scadenze={scadenzeFiltrate}
            mesiDaVisualizzare={calendarioMesi}
            onDayClick={openDayModal}
          />
        </div>
      )}

      {/* Form Nuova Scadenza */}
      {showNuovaScadenza && (
        <ScadenzaForm
          onClose={() => setShowNuovaScadenza(false)}
          onScadenzaCreata={handleScadenzaCreata}
        />
      )}
      {/* Modal Completamento Scadenza */}
      {showCompletaModal && scadenzaDaCompletare && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Completa Scadenza</h3>
              <button
                onClick={() => setShowCompletaModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                Stai per contrassegnare come completata:
              </p>
              <p className="font-medium">{scadenzaDaCompletare.titolo}</p>
              <p className="text-sm text-gray-500">
                {scadenzaDaCompletare.cliente_nome} - {scadenzaDaCompletare.progetto_codice}
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Note completamento (opzionale)
              </label>
              <textarea
                value={noteCompletamento}
                onChange={(e) => setNoteCompletamento(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Aggiungi eventuali note sul completamento..."
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowCompletaModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Annulla
              </button>
              <button
                onClick={completaScadenza}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
              >
                ✅ Completa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Scadenze del Giorno */}
      {showDayModal && selectedDate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                Scadenze del {new Date(selectedDate + 'T12:00:00').toLocaleDateString('it-IT', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </h3>
              <button
                onClick={closeDayModal}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-96">
              {getSelectedDateScadenze().length > 0 ? (
                <div className="space-y-4">
                  {getSelectedDateScadenze().map((scadenza) => (
                    <div key={scadenza.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              scadenza.urgenza === 'URGENTE' ? 'bg-red-100 border-red-500 text-red-800' :
                              scadenza.urgenza === 'IMMINENTE' ? 'bg-orange-100 border-orange-500 text-orange-800' :
                              'bg-gray-100 border-gray-300 text-gray-700'
                            }`}>
                              {scadenza.urgenza}
                            </span>
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${getStatoColor(scadenza.stato)}`}>
                              {scadenza.stato === 'non_iniziata' ? 'Da fare' :
                               scadenza.stato === 'in_corso' ? 'In corso' : 'Completata'}
                            </span>
                          </div>

                          <h4 className="font-medium text-gray-900 mb-1">
                            {scadenza.titolo}
                          </h4>

                          <div className="text-sm text-gray-600 space-y-1">
                            <div><strong>Cliente:</strong> {scadenza.cliente_nome}</div>
                            <div><strong>Progetto:</strong> {scadenza.progetto_titolo} ({scadenza.progetto_codice})</div>
                            <div><strong>Bando:</strong> {scadenza.bando_nome}</div>
                            <div><strong>Responsabile:</strong> {scadenza.responsabile_email}</div>
                            {scadenza.note && (
                              <div><strong>Note:</strong> {scadenza.note}</div>
                            )}
                          </div>
                        </div>

                        <div className="ml-4">
                          <select
                            value={scadenza.stato}
                            onChange={(e) => handleStatoChange(scadenza, e.target.value)}
                            className={`text-xs font-semibold rounded px-2 py-1 border-0 ${getStatoColor(scadenza.stato)}`}
                          >
                            <option value="non_iniziata">Da fare</option>
                            <option value="in_corso">In corso</option>
                            <option value="completata">Completata</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Nessuna scadenza per questa data
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={closeDayModal}
                className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}