'use client'

import { useState, useEffect } from 'react'
import { Clock, Users, BookOpen, Euro, AlertTriangle, ShieldCheck, Loader2 } from 'lucide-react'

interface PanoramicaData {
  oreFormazione12m: number
  partecipantiFormati12m: number
  pianiAttivi: number
  importoErogato: number
  orePerArea: Record<string, number>
  prossimeScadenze: Array<{ id: string; descrizione: string; data_scadenza: string; tipo: string }>
  certInScadenza: Array<{ id: string; tipo_obbligo: string; persona_nome: string; data_scadenza: string }>
  certScadute: Array<{ id: string; tipo_obbligo: string; persona_nome: string; data_scadenza: string }>
}

interface FormazionePanoramicaProps {
  clienteId: string
}

export default function FormazionePanoramica({ clienteId }: FormazionePanoramicaProps) {
  const [data, setData] = useState<PanoramicaData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPanoramica()
  }, [clienteId])

  const fetchPanoramica = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/clienti/${clienteId}/formazione/panoramica`)
      const json = await res.json()
      if (json.success) setData(json.data)
    } catch (err) {
      console.error('[FormazionePanoramica] Error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!data) {
    return <div className="text-gray-500 text-sm text-center py-8">Impossibile caricare la panoramica</div>
  }

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={Clock}
          label="Ore formazione (12 mesi)"
          value={data.oreFormazione12m.toString()}
          color="bg-blue-50 text-blue-600"
        />
        <KpiCard
          icon={Users}
          label="Partecipanti formati (12 mesi)"
          value={data.partecipantiFormati12m.toString()}
          color="bg-green-50 text-green-600"
        />
        <KpiCard
          icon={BookOpen}
          label="Piani attivi"
          value={data.pianiAttivi.toString()}
          color="bg-indigo-50 text-indigo-600"
        />
        <KpiCard
          icon={Euro}
          label="Importo FPI erogato"
          value={`€ ${data.importoErogato.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`}
          color="bg-amber-50 text-amber-600"
        />
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Prossime scadenze */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
            <AlertTriangle className="w-4 h-4 mr-2 text-amber-500" />
            Prossime scadenze formazione
          </h4>
          {data.prossimeScadenze.length === 0 ? (
            <p className="text-sm text-gray-500">Nessuna scadenza imminente</p>
          ) : (
            <ul className="space-y-2">
              {data.prossimeScadenze.map(s => {
                const daysLeft = Math.ceil((new Date(s.data_scadenza).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                const badgeColor = daysLeft <= 7 ? 'bg-red-100 text-red-700' :
                  daysLeft <= 30 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-700'

                return (
                  <li key={s.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 truncate flex-1 mr-2">{s.descrizione}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${badgeColor}`}>
                      {daysLeft <= 0 ? 'Scaduta' : `${daysLeft}gg`}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Certificazioni in scadenza */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
            <ShieldCheck className="w-4 h-4 mr-2 text-red-500" />
            Certificazioni in scadenza (90gg)
          </h4>
          {data.certScadute.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-red-600 mb-1">Scadute ({data.certScadute.length})</p>
              <ul className="space-y-1">
                {data.certScadute.slice(0, 3).map(c => (
                  <li key={c.id} className="text-sm text-red-700 bg-red-50 rounded px-2 py-1">
                    {TIPO_OBBLIGO_SHORT[c.tipo_obbligo] || c.tipo_obbligo}
                    {c.persona_nome ? ` - ${c.persona_nome}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.certInScadenza.length === 0 && data.certScadute.length === 0 ? (
            <p className="text-sm text-gray-500">Tutte le certificazioni sono in regola</p>
          ) : (
            <ul className="space-y-1">
              {data.certInScadenza.map(c => {
                const daysLeft = Math.ceil((new Date(c.data_scadenza).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                return (
                  <li key={c.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 truncate flex-1 mr-2">
                      {TIPO_OBBLIGO_SHORT[c.tipo_obbligo] || c.tipo_obbligo}
                      {c.persona_nome ? ` - ${c.persona_nome}` : ''}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 flex-shrink-0">
                      {daysLeft}gg
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Ore per area tematica */}
      {Object.keys(data.orePerArea).length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Ore per area tematica (ultimi 12 mesi)</h4>
          <div className="space-y-2">
            {Object.entries(data.orePerArea)
              .sort(([, a], [, b]) => b - a)
              .map(([area, ore]) => {
                const maxOre = Math.max(...Object.values(data.orePerArea))
                const pct = maxOre > 0 ? (ore / maxOre) * 100 : 0
                return (
                  <div key={area} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-32 truncate flex-shrink-0">{area}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                      <div
                        className="bg-teal-500 h-full rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-700 w-12 text-right flex-shrink-0">{ore}h</span>
                  </div>
                )
              })}
          </div>
        </div>
      )}
    </div>
  )
}

function KpiCard({ icon: Icon, label, value, color }: {
  icon: typeof Clock
  label: string
  value: string
  color: string
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-lg font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  )
}

const TIPO_OBBLIGO_SHORT: Record<string, string> = {
  FORMAZIONE_LAVORATORI_RISCHIO_BASSO: 'Form. rischio basso',
  FORMAZIONE_LAVORATORI_RISCHIO_MEDIO: 'Form. rischio medio',
  FORMAZIONE_LAVORATORI_RISCHIO_ALTO: 'Form. rischio alto',
  RSPP: 'RSPP',
  DIRIGENTI_SSL: 'Dirigenti SSL',
  PREPOSTI: 'Preposti',
  RLS: 'RLS',
  ANTINCENDIO_BASSO: 'Antincendio basso',
  ANTINCENDIO_MEDIO: 'Antincendio medio',
  ANTINCENDIO_ALTO: 'Antincendio alto',
  PRIMO_SOCCORSO: 'Primo soccorso',
  HACCP: 'HACCP',
  PRIVACY_GDPR: 'Privacy/GDPR',
  ANTIRICICLAGGIO: 'Antiriciclaggio',
  ALTRO: 'Altro',
}
