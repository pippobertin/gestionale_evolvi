'use client'

import { useCallback, useEffect, useState } from 'react'
import { Radar, RefreshCw, Plus, Trash2, ExternalLink, CheckCircle2, AlertTriangle, XCircle, FileText } from 'lucide-react'

/**
 * Scheda del bando, "Controllo della pagina": il gestionale legge ogni mattina
 * le pagine indicate e segnala i collegamenti nuovi che sembrano graduatorie.
 * Qui si vedono le pagine controllate con l'esito dell'ultima lettura, le
 * novità trovate, la modalità (automatico, sempre, mai) e "Controlla adesso".
 */
type Pagina = { id: string; url: string; etichetta: string | null; origine: string; attiva: boolean; collegamenti_noti: number; ultimo_controllo: string | null; esito: string | null; messaggio: string | null }
type Novita = { id: string; url: string; testo: string | null; tipo: string; parole: string[]; trovata_il: string; stato: string; scadenze_create: number }
type Stato = { modalita: string; controllato: boolean; link_ufficiale: string | null; pagine: Pagina[]; novita: Novita[] }

const ORIGINE: Record<string, string> = { link_ufficiale: 'pagina ufficiale', aggiunta: 'aggiunta', sottopagina: 'trovata in automatico' }
const STATO_NOVITA: Record<string, string> = { da_vedere: 'da vedere', graduatoria: 'è la graduatoria', non_interessa: 'non interessa' }
const quando = (d: string | null) => (d ? new Date(d).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'mai')

export default function ControlloPaginaBando({ bandoId, onApriDati }: { bandoId: string; onApriDati?: () => void }) {
  const [stato, setStato] = useState<Stato | null>(null)
  const [errore, setErrore] = useState('')
  const [messaggio, setMessaggio] = useState('')
  const [inCorso, setInCorso] = useState(false)
  const [nuova, setNuova] = useState({ url: '', etichetta: '' })

  const chiama = useCallback(async (metodo: string, corpo?: object, query = '') => {
    setErrore('')
    const r = await fetch(`/api/bandi/${bandoId}/controllo${query}`, {
      method: metodo, headers: corpo ? { 'Content-Type': 'application/json' } : undefined, body: corpo ? JSON.stringify(corpo) : undefined
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) { setErrore(d.error || 'Operazione non riuscita'); return null }
    setStato(d)
    return d
  }, [bandoId])
  useEffect(() => { chiama('GET') }, [chiama])

  const controllaAdesso = async () => {
    setInCorso(true); setMessaggio('')
    const d = await chiama('POST', { azione: 'controlla' })
    setInCorso(false)
    if (d?.risultato) {
      const r = d.risultato
      setMessaggio(r.pagine === 0 ? 'Nessuna pagina da controllare: indica il link ufficiale del bando o aggiungi una pagina.'
        : r.novita === 0 ? `Controllate ${r.pagine} pagine: nessun collegamento nuovo.`
        : `Controllate ${r.pagine} pagine: ${r.novita} novità${r.graduatorie ? `, di cui ${r.graduatorie} che sembrano graduatorie (${r.scadenze} scadenze create${r.calendario ? ', con l\'evento nel calendario' : ''})` : ''}.`)
    }
  }

  const aggiungi = async () => {
    if (!nuova.url.trim()) return
    if (await chiama('POST', { azione: 'aggiungi', ...nuova })) setNuova({ url: '', etichetta: '' })
  }

  if (!stato) return <div className="p-4 text-sm text-gray-500">{errore || 'Caricamento…'}</div>

  const campo = 'px-2 py-1.5 border border-gray-300 rounded-md text-sm'
  const IconaEsito = ({ esito }: { esito: string | null }) =>
    esito === 'ok' ? <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
      : esito === 'non_controllabile' ? <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
      : esito === 'errore' ? <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
      : <span className="w-4 h-4 rounded-full border border-gray-300 flex-shrink-0" />

  return (
    <div className="space-y-4 text-sm">
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-2 font-medium text-gray-900"><Radar className="w-4 h-4" /> Controllo automatico della pagina del bando</div>
        <p className="text-xs text-gray-600">
          Ogni mattina il gestionale legge le pagine qui sotto e confronta i collegamenti con quelli già visti. Se ne compare uno nuovo con parole come
          graduatoria, esiti o ammessi, i responsabili dei progetti in attesa del decreto ricevono la scadenza &quot;Controllare la graduatoria&quot; e la novità
          compare nel Cruscotto. Alcuni siti non si possono leggere in automatico (contenuti caricati con JavaScript, accesso con credenziali, blocchi anti-robot):
          per quelli resta il controllo a mano.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-xs text-gray-700 flex items-center gap-2">
            Controllo:
            <select className={campo} value={stato.modalita} onChange={e => chiama('PATCH', { modalita: e.target.value })}>
              <option value="auto">automatico (se ci sono progetti in attesa del decreto)</option>
              <option value="acceso">sempre</option>
              <option value="spento">mai</option>
            </select>
          </label>
          <span className={`text-xs px-2 py-0.5 rounded-full ${stato.controllato ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
            {stato.controllato ? 'controllato ogni mattina' : 'oggi non viene controllato'}
          </span>
          <button type="button" onClick={controllaAdesso} disabled={inCorso}
            className="ml-auto px-3 py-1.5 bg-blue-600 text-white rounded-md inline-flex items-center gap-1 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${inCorso ? 'animate-spin' : ''}`} /> {inCorso ? 'Controllo in corso…' : 'Controlla adesso'}
          </button>
        </div>
        {!stato.link_ufficiale && (
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1">
            Il bando non ha ancora il link ufficiale.{' '}
            {onApriDati
              ? <button type="button" onClick={onApriDati} className="underline font-medium">Inseriscilo nella scheda &quot;Dati Bando&quot;</button>
              : <>Inseriscilo nella scheda &quot;Dati Bando&quot;</>}
            , salva il bando e poi premi &quot;Controlla adesso&quot;: la pagina ufficiale entra da sola tra quelle controllate.
            Le pagine aggiunte qui sotto servono per altre pagine dell&apos;ente, per esempio Notizie o Esiti.
          </p>
        )}
        {messaggio && <p className="text-xs text-green-800 bg-green-50 border border-green-200 rounded px-2 py-1">{messaggio}</p>}
        {errore && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">{errore}</p>}
      </div>

      <div>
        <h4 className="font-medium text-gray-900 mb-1">Pagine controllate</h4>
        <div className="bg-white border border-gray-200 rounded-lg divide-y">
          {stato.pagine.length === 0 && <div className="p-3 text-gray-500">Nessuna pagina: si aggiunge da sola quando il bando ha il link ufficiale.</div>}
          {stato.pagine.map(p => (
            <div key={p.id} className={`px-3 py-2 flex items-start gap-2 ${p.attiva ? '' : 'opacity-60'}`}>
              <IconaEsito esito={p.esito} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 min-w-0">
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline truncate">{p.etichetta || p.url}</a>
                  <ExternalLink className="w-3 h-3 text-gray-400 flex-shrink-0" />
                </div>
                <div className="text-xs text-gray-500">
                  {ORIGINE[p.origine] || p.origine} · ultima lettura {quando(p.ultimo_controllo)}{p.messaggio ? ` · ${p.messaggio}` : ''}
                </div>
              </div>
              <label className="text-xs text-gray-600 flex items-center gap-1 whitespace-nowrap">
                <input type="checkbox" checked={p.attiva} onChange={e => chiama('PATCH', { paginaId: p.id, attiva: e.target.checked })} /> controlla
              </label>
              {p.origine !== 'link_ufficiale' && (
                <button type="button" title="Togli la pagina" onClick={() => { if (confirm('Togliere questa pagina dal controllo?')) chiama('DELETE', undefined, `?pagina=${p.id}`) }}
                  className="p-1 text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              )}
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2 items-center">
          <input className={`${campo} flex-1 min-w-[16rem]`} placeholder="Indirizzo di un'altra pagina dell'ente (per esempio Notizie o Esiti)" value={nuova.url} onChange={e => setNuova({ ...nuova, url: e.target.value })} />
          <input className={`${campo} w-48`} placeholder="Nome (facoltativo)" value={nuova.etichetta} onChange={e => setNuova({ ...nuova, etichetta: e.target.value })} />
          <button type="button" onClick={aggiungi} className="px-3 py-1.5 border border-gray-300 rounded-md inline-flex items-center gap-1 hover:bg-gray-50"><Plus className="w-4 h-4" /> Aggiungi pagina</button>
        </div>
      </div>

      <div>
        <h4 className="font-medium text-gray-900 mb-1">Novità trovate</h4>
        <div className="bg-white border border-gray-200 rounded-lg divide-y">
          {stato.novita.length === 0 && <div className="p-3 text-gray-500">Nessuna novità finora. Alla prima lettura i collegamenti presenti vengono registrati come già visti.</div>}
          {stato.novita.map(n => (
            <div key={n.id} className="px-3 py-2 flex items-start gap-2">
              {n.tipo === 'graduatoria' ? <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" /> : <FileText className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />}
              <div className="flex-1 min-w-0">
                <a href={n.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline break-words">{n.testo || n.url}</a>
                <div className="text-xs text-gray-500">
                  {quando(n.trovata_il)} · {n.tipo === 'graduatoria' ? `possibile graduatoria (${n.parole.join(', ')})` : 'nuovo documento'}
                  {n.scadenze_create > 0 && ` · ${n.scadenze_create} scadenze create`} · {STATO_NOVITA[n.stato] || n.stato}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
