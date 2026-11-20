'use client'

import { useEffect, useState } from 'react'
import { Database, Download, ShieldCheck, ClipboardCheck, AlertTriangle, CheckCircle, XCircle, ExternalLink } from 'lucide-react'
import { LoadingSpinner } from './shared'

/**
 * Backup del gestionale (Modello 231): esportazione mensile automatica su Drive,
 * esportazione manuale, prova di leggibilità e registro delle prove di ripristino.
 */

type RigaRegistro = {
  id: string
  tipo: 'esportazione' | 'prova_ripristino'
  eseguito_il: string
  origine: 'automatica' | 'manuale' | null
  esito: 'ok' | 'errore' | 'parziale'
  file_nome: string | null
  file_drive_id: string | null
  dimensione_byte: number | null
  sha256: string | null
  conteggi: Record<string, number> | null
  backup_id: string | null
  cosa: string | null
  note: string | null
  errore: string | null
  utente: { nome: string; cognome: string } | null
}

type EsitoVerifica = {
  ok: boolean
  impronta_corretta: boolean
  formato_corretto: boolean
  tabelle: number
  righe: number
  differenze: { tabella: string; attese: number; trovate: number }[]
  errore?: string
}

const oggi = () => new Date().toISOString().slice(0, 10)

function formatData(iso: string, conOra = true) {
  return new Date(iso).toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    ...(conOra ? { hour: '2-digit', minute: '2-digit' } : {})
  })
}

function formatByte(n: number | null) {
  if (!n) return ''
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function totaleRighe(c: Record<string, number> | null) {
  return c ? Object.values(c).reduce((a, b) => a + b, 0) : 0
}

function BadgeEsito({ esito }: { esito: RigaRegistro['esito'] }) {
  const stile = esito === 'ok'
    ? 'bg-green-100 text-green-800'
    : esito === 'parziale' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
  const testo = esito === 'ok' ? 'Riuscita' : esito === 'parziale' ? 'Parziale' : 'Non riuscita'
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${stile}`}>{testo}</span>
}

export default function BackupGestionale() {
  const [registro, setRegistro] = useState<RigaRegistro[]>([])
  const [destinazione, setDestinazione] = useState('')
  const [caricamento, setCaricamento] = useState(true)
  const [inCorso, setInCorso] = useState<string | null>(null)
  const [errore, setErrore] = useState('')
  const [messaggio, setMessaggio] = useState('')
  const [verifiche, setVerifiche] = useState<Record<string, EsitoVerifica>>({})
  const [prova, setProva] = useState({ data_prova: oggi(), backup_id: '', cosa: '', esito: 'ok', note: '' })
  const [mostraProva, setMostraProva] = useState(false)

  const carica = async () => {
    try {
      const r = await fetch('/api/backup')
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Registro non disponibile')
      setRegistro(d.registro || [])
      setDestinazione(d.destinazione || '')
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Errore')
    } finally {
      setCaricamento(false)
    }
  }

  useEffect(() => { carica() }, [])

  const esportaOra = async () => {
    setInCorso('esporta'); setErrore(''); setMessaggio('')
    try {
      const r = await fetch('/api/backup', { method: 'POST' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Esportazione non riuscita')
      setMessaggio(`Esportazione completata: ${d.riga.file_nome}`)
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Errore')
    } finally {
      setInCorso(null)
      carica()
    }
  }

  const verifica = async (riga: RigaRegistro) => {
    setInCorso(`verifica-${riga.id}`); setErrore('')
    try {
      const r = await fetch(`/api/backup/${riga.id}/verifica`, { method: 'POST' })
      const d: EsitoVerifica = await r.json()
      setVerifiche(v => ({ ...v, [riga.id]: d }))
      // Precompila la registrazione della prova con l'esito ottenuto
      setProva({
        data_prova: oggi(),
        backup_id: riga.id,
        cosa: `Verifica di leggibilità dell'esportazione ${riga.file_nome}: download da Drive, impronta SHA-256, decompressione e confronto delle righe di ${d.tabelle} tabelle (${d.righe} righe).`,
        esito: d.ok ? 'ok' : 'errore',
        note: d.ok ? '' : (d.errore || d.differenze.map(x => `${x.tabella}: attese ${x.attese}, trovate ${x.trovate}`).join('; '))
      })
      setMostraProva(true)
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Errore')
    } finally {
      setInCorso(null)
    }
  }

  const registraProva = async () => {
    setInCorso('prova'); setErrore(''); setMessaggio('')
    try {
      const r = await fetch('/api/backup/prove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prova)
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Registrazione non riuscita')
      setMessaggio('Prova di ripristino registrata')
      setMostraProva(false)
      setProva({ data_prova: oggi(), backup_id: '', cosa: '', esito: 'ok', note: '' })
      carica()
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Errore')
    } finally {
      setInCorso(null)
    }
  }

  const esportazioni = registro.filter(r => r.tipo === 'esportazione')
  const prove = registro.filter(r => r.tipo === 'prova_ripristino')
  const ultimaOk = esportazioni.find(r => r.esito === 'ok')
  const ultimaProva = prove[0]
  const giorniDaUltima = ultimaOk ? Math.floor((Date.now() - new Date(ultimaOk.eseguito_il).getTime()) / 86400000) : null
  const provaVecchia = !ultimaProva || (Date.now() - new Date(ultimaProva.eseguito_il).getTime()) > 365 * 86400000

  if (caricamento) return <div className="p-6"><LoadingSpinner /></div>

  return (
    <div className="space-y-3">
      <div className="flex items-center space-x-3 mb-4">
        <div className="w-6 h-6 bg-green-100 rounded-lg flex items-center justify-center">
          <Database className="w-4 h-4 text-green-600" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-gray-900">Backup del gestionale</h1>
          <p className="text-gray-600 text-sm">
            Esportazione automatica il primo giorno di ogni mese in {destinazione || 'Drive'}. Password, token e
            sessioni restano fuori dal file.
          </p>
        </div>
      </div>

      {errore && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{errore}</div>}
      {messaggio && <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">{messaggio}</div>}

      {/* Stato sintetico */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className={`p-3 rounded-lg border ${giorniDaUltima !== null && giorniDaUltima <= 35 ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
          <div className="text-xs text-gray-600">Ultima esportazione riuscita</div>
          <div className="text-sm font-semibold text-gray-900">
            {ultimaOk ? `${formatData(ultimaOk.eseguito_il)} (${giorniDaUltima} giorni fa)` : 'Nessuna'}
          </div>
        </div>
        <div className={`p-3 rounded-lg border ${provaVecchia ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}`}>
          <div className="text-xs text-gray-600">Ultima prova di ripristino (almeno una all&apos;anno)</div>
          <div className="text-sm font-semibold text-gray-900">
            {ultimaProva ? formatData(ultimaProva.eseguito_il, false) : 'Nessuna registrata'}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={esportaOra}
          disabled={inCorso !== null}
          className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {inCorso === 'esporta' ? <LoadingSpinner size="small" /> : <Download className="w-4 h-4" />}
          Esporta adesso
        </button>
        <button
          onClick={() => setMostraProva(true)}
          disabled={inCorso !== null}
          className="px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2"
        >
          <ClipboardCheck className="w-4 h-4" />
          Registra una prova di ripristino
        </button>
      </div>

      {/* Registrazione prova */}
      {mostraProva && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">Prova di ripristino</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Data</label>
              <input type="date" value={prova.data_prova}
                onChange={e => setProva({ ...prova, data_prova: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Esportazione usata</label>
              <select value={prova.backup_id}
                onChange={e => setProva({ ...prova, backup_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="">Nessuna o esterna al gestionale</option>
                {esportazioni.filter(r => r.esito === 'ok').map(r => (
                  <option key={r.id} value={r.id}>{r.file_nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Esito</label>
              <select value={prova.esito}
                onChange={e => setProva({ ...prova, esito: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="ok">Riuscita</option>
                <option value="parziale">Parziale</option>
                <option value="errore">Non riuscita</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Cosa è stato ripristinato o verificato</label>
            <textarea value={prova.cosa} rows={3}
              onChange={e => setProva({ ...prova, cosa: e.target.value })}
              placeholder="Esempio: ripristino della posta di una casella Workspace di prova; verifica dell'esportazione di novembre"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Note (facoltative)</label>
            <textarea value={prova.note} rows={2}
              onChange={e => setProva({ ...prova, note: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <p className="text-xs text-gray-500">Chi registra la prova viene annotato in automatico.</p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setMostraProva(false)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Annulla</button>
            <button onClick={registraProva} disabled={inCorso !== null || prova.cosa.trim().length < 3}
              className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              Registra
            </button>
          </div>
        </div>
      )}

      {/* Esportazioni */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-2 border-b border-gray-200 text-sm font-semibold text-gray-900">Esportazioni</div>
        {esportazioni.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">Nessuna esportazione ancora. La prima automatica partirà il primo del mese; puoi farne una adesso.</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-3 py-1.5 text-left">Data</th>
                <th className="px-3 py-1.5 text-left">Tipo</th>
                <th className="px-3 py-1.5 text-left">Esito</th>
                <th className="px-3 py-1.5 text-left">File</th>
                <th className="px-3 py-1.5 text-left">Righe</th>
                <th className="px-3 py-1.5 text-right">Verifica</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {esportazioni.map(r => {
                const v = verifiche[r.id]
                return (
                  <tr key={r.id} className="align-top">
                    <td className="px-3 py-1.5 whitespace-nowrap">{formatData(r.eseguito_il)}</td>
                    <td className="px-3 py-1.5 whitespace-nowrap text-gray-600">
                      {r.origine === 'automatica' ? 'Automatica' : `Manuale${r.utente ? `, ${r.utente.nome} ${r.utente.cognome}` : ''}`}
                    </td>
                    <td className="px-3 py-1.5"><BadgeEsito esito={r.esito} /></td>
                    <td className="px-3 py-1.5">
                      {r.file_drive_id ? (
                        <a href={`https://drive.google.com/file/d/${r.file_drive_id}/view`} target="_blank" rel="noreferrer"
                          className="text-blue-600 hover:underline inline-flex items-center gap-1">
                          {r.file_nome} <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="text-red-600">{r.errore}</span>
                      )}
                      {r.dimensione_byte ? <span className="text-gray-400 ml-2">{formatByte(r.dimensione_byte)}</span> : null}
                      {v && (
                        <div className={`mt-1 text-xs flex items-start gap-1 ${v.ok ? 'text-green-700' : 'text-red-700'}`}>
                          {v.ok ? <CheckCircle className="w-3.5 h-3.5 mt-px" /> : <XCircle className="w-3.5 h-3.5 mt-px" />}
                          {v.ok
                            ? `File integro e leggibile: ${v.tabelle} tabelle, ${v.righe} righe, impronta corrispondente.`
                            : v.errore || [
                                !v.impronta_corretta && 'impronta diversa',
                                !v.formato_corretto && 'formato non riconosciuto',
                                v.differenze.length > 0 && `${v.differenze.length} tabelle con righe diverse`
                              ].filter(Boolean).join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-1.5 whitespace-nowrap text-gray-600">{r.conteggi ? totaleRighe(r.conteggi).toLocaleString('it-IT') : ''}</td>
                    <td className="px-3 py-1.5 text-right">
                      {r.esito === 'ok' && (
                        <button onClick={() => verifica(r)} disabled={inCorso !== null}
                          className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 inline-flex items-center gap-1 disabled:opacity-50"
                          title="Scarica il file da Drive e controlla che sia integro e leggibile">
                          {inCorso === `verifica-${r.id}` ? <LoadingSpinner size="small" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                          Verifica
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Prove di ripristino */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-4 py-2 border-b border-gray-200 text-sm font-semibold text-gray-900">Registro delle prove di ripristino</div>
        {prove.length === 0 ? (
          <p className="p-4 text-sm text-gray-500 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Nessuna prova registrata. Il consulente chiede almeno una prova all&apos;anno.
          </p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-3 py-1.5 text-left">Data</th>
                <th className="px-3 py-1.5 text-left">Chi</th>
                <th className="px-3 py-1.5 text-left">Cosa</th>
                <th className="px-3 py-1.5 text-left">Esito</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {prove.map(r => (
                <tr key={r.id} className="align-top">
                  <td className="px-3 py-1.5 whitespace-nowrap">{formatData(r.eseguito_il, false)}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap">{r.utente ? `${r.utente.nome} ${r.utente.cognome}` : ''}</td>
                  <td className="px-3 py-1.5">
                    {r.cosa}
                    {r.note && <div className="text-xs text-gray-500 mt-0.5">{r.note}</div>}
                  </td>
                  <td className="px-3 py-1.5"><BadgeEsito esito={r.esito} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
