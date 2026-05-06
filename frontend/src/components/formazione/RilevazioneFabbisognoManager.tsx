'use client'

import { useState, useEffect, useCallback, Fragment } from 'react'
import {
  ClipboardList, Plus, RefreshCw, Loader2, X, Send, Copy, Mail,
  CheckCircle, Clock, AlertTriangle, Archive, ChevronRight, FileText
} from 'lucide-react'

interface Rilevazione {
  id: string
  cliente_id: string
  titolo: string
  anno_riferimento: number
  token: string
  token_scadenza: string | null
  stato: 'BOZZA' | 'INVIATA' | 'IN_COMPILAZIONE' | 'COMPLETATA' | 'SCADUTA' | 'ARCHIVIATA'
  stato_effettivo?: string
  data_invio: string | null
  data_prima_apertura: string | null
  data_ultima_modifica: string | null
  data_completamento: string | null
  ultimo_step_visitato: number
  referente_nome: string | null
  referente_ruolo: string | null
  ateco_dichiarato: string | null
  ccnl_dichiarato: string | null
  numero_dipendenti_dichiarato: number | null
  // ... altri campi disponibili nel dettaglio
}

interface RilevazioneFabbisognoManagerProps {
  clienteId: string
}

const STATO_LABELS: Record<string, string> = {
  BOZZA: 'Bozza',
  INVIATA: 'Inviata',
  IN_COMPILAZIONE: 'In compilazione',
  COMPLETATA: 'Completata',
  SCADUTA: 'Scaduta',
  ARCHIVIATA: 'Archiviata',
}

const STATO_COLORS: Record<string, string> = {
  BOZZA: 'bg-gray-100 text-gray-700',
  INVIATA: 'bg-amber-100 text-amber-700',
  IN_COMPILAZIONE: 'bg-blue-100 text-blue-700',
  COMPLETATA: 'bg-green-100 text-green-700',
  SCADUTA: 'bg-red-100 text-red-700',
  ARCHIVIATA: 'bg-gray-100 text-gray-500',
}

export default function RilevazioneFabbisognoManager({ clienteId }: RilevazioneFabbisognoManagerProps) {
  const [rilevazioni, setRilevazioni] = useState<Rilevazione[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showSendModal, setShowSendModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [activeRilevazione, setActiveRilevazione] = useState<Rilevazione | null>(null)
  const [openedDetail, setOpenedDetail] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2200)
  }

  const loadRilevazioni = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/clienti/${clienteId}/formazione/fabbisogno`)
      const json = await res.json()
      if (json.success) setRilevazioni(json.data)
    } catch (err) {
      console.error('[RilevazioneFabbisognoManager] Error:', err)
    } finally {
      setLoading(false)
    }
  }, [clienteId])

  useEffect(() => { loadRilevazioni() }, [loadRilevazioni])

  // ----------------------------------------------------------------
  // Crea nuova rilevazione
  // ----------------------------------------------------------------
  const [formNuova, setFormNuova] = useState({
    titolo: '',
    anno_riferimento: new Date().getFullYear(),
    giorni_validita_token: 90,
  })

  const apriCreazione = () => {
    setFormNuova({
      titolo: `Rilevazione ${new Date().getFullYear()}`,
      anno_riferimento: new Date().getFullYear(),
      giorni_validita_token: 90,
    })
    setShowCreateModal(true)
  }

  const creaRilevazione = async () => {
    setCreating(true)
    try {
      const res = await fetch(`/api/clienti/${clienteId}/formazione/fabbisogno`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formNuova),
      })
      const json = await res.json()
      if (!json.success) {
        showToast(json.error || 'Errore nella creazione')
        return
      }
      setShowCreateModal(false)
      await loadRilevazioni()
      // Apri direttamente il modale di invio email
      setActiveRilevazione(json.data)
      apriInvioEmail(json.data)
    } catch (err) {
      console.error(err)
      showToast('Errore di rete')
    } finally {
      setCreating(false)
    }
  }

  // ----------------------------------------------------------------
  // Invio email (primo invio o sollecito)
  // ----------------------------------------------------------------
  const [formEmail, setFormEmail] = useState({
    destinatario_email: '',
    messaggio_personale: '',
    eh_sollecito: false,
  })
  const [sending, setSending] = useState(false)

  const apriInvioEmail = (ril: Rilevazione, sollecito = false) => {
    setActiveRilevazione(ril)
    setFormEmail({
      destinatario_email: '',
      messaggio_personale: sollecito
        ? `Le ricordiamo che è ancora aperto il questionario di rilevazione fabbisogni formativi. Sarebbe importante riceverne la compilazione entro le prossime settimane per definire il piano formativo.`
        : '',
      eh_sollecito: sollecito,
    })
    setShowSendModal(true)
  }

  const inviaEmail = async () => {
    if (!activeRilevazione) return
    setSending(true)
    try {
      const body: Record<string, unknown> = {
        eh_sollecito: formEmail.eh_sollecito,
      }
      if (formEmail.destinatario_email.trim()) {
        body.destinatario_email = formEmail.destinatario_email.trim()
      }
      if (formEmail.messaggio_personale.trim()) {
        body.messaggio_personale = formEmail.messaggio_personale.trim()
      }
      const res = await fetch(
        `/api/clienti/${clienteId}/formazione/fabbisogno/${activeRilevazione.id}/send-email`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      )
      const json = await res.json()
      if (!json.success) {
        showToast(json.error || 'Errore nell\'invio')
        return
      }
      showToast(`Email inviata a ${json.data.email.to}`)
      setShowSendModal(false)
      await loadRilevazioni()
    } catch (err) {
      console.error(err)
      showToast('Errore di rete')
    } finally {
      setSending(false)
    }
  }

  // ----------------------------------------------------------------
  // Azioni di riga
  // ----------------------------------------------------------------
  const copiaLink = (token: string) => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
    const link = `${baseUrl.replace(/\/$/, '')}/fabbisogno/${token}`
    navigator.clipboard.writeText(link)
    showToast('Link copiato negli appunti')
  }

  const archivia = async (ril: Rilevazione) => {
    if (!confirm(`Archiviare la rilevazione "${ril.titolo}"? Non sara' piu' visibile nella lista (puoi recuperarla disattivando il filtro).`)) return
    try {
      const res = await fetch(`/api/clienti/${clienteId}/formazione/fabbisogno/${ril.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stato: 'ARCHIVIATA' }),
      })
      const json = await res.json()
      if (!json.success) {
        showToast(json.error || 'Errore nell\'archiviazione')
        return
      }
      await loadRilevazioni()
      showToast('Rilevazione archiviata')
    } catch (err) {
      console.error(err)
      showToast('Errore di rete')
    }
  }

  // ----------------------------------------------------------------
  // KPI
  // ----------------------------------------------------------------
  const kpi = {
    totali: rilevazioni.length,
    inAttesa: rilevazioni.filter(r => ['INVIATA', 'IN_COMPILAZIONE'].includes(r.stato_effettivo || r.stato)).length,
    completate: rilevazioni.filter(r => r.stato === 'COMPLETATA').length,
    ultima: rilevazioni
      .filter(r => r.data_completamento)
      .sort((a, b) => new Date(b.data_completamento!).getTime() - new Date(a.data_completamento!).getTime())[0]
      ?.data_completamento,
  }

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={ClipboardList} label="Rilevazioni totali" value={kpi.totali.toString()} color="bg-blue-50 text-blue-600" />
        <KpiCard icon={Clock} label="In attesa di compilazione" value={kpi.inAttesa.toString()} color="bg-amber-50 text-amber-600" />
        <KpiCard icon={CheckCircle} label="Completate" value={kpi.completate.toString()} color="bg-green-50 text-green-600" />
        <KpiCard
          icon={FileText}
          label="Ultima compilazione"
          value={kpi.ultima ? new Date(kpi.ultima).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—'}
          color="bg-indigo-50 text-indigo-600"
        />
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Storico rilevazioni</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={loadRilevazioni}
            className="text-xs px-2 py-1.5 border border-gray-300 rounded text-gray-600 hover:bg-gray-50 inline-flex items-center"
            title="Aggiorna"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={apriCreazione}
            className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium px-3 py-2 rounded-md inline-flex items-center space-x-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuova rilevazione</span>
          </button>
        </div>
      </div>

      {/* Lista */}
      {rilevazioni.length === 0 ? (
        <EmptyState onCreate={apriCreazione} />
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Titolo</th>
                <th className="px-4 py-2 text-left font-medium">Inviata</th>
                <th className="px-4 py-2 text-left font-medium">Completata</th>
                <th className="px-4 py-2 text-left font-medium">Stato</th>
                <th className="px-4 py-2 text-left font-medium">Step</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rilevazioni.map(ril => {
                const stato = ril.stato_effettivo || ril.stato
                const isOpen = openedDetail === ril.id
                return (
                  <Fragment key={ril.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{ril.titolo}</div>
                        <div className="text-xs text-gray-500">Anno {ril.anno_riferimento}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {ril.data_invio ? new Date(ril.data_invio).toLocaleDateString('it-IT') : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {ril.data_completamento ? new Date(ril.data_completamento).toLocaleDateString('it-IT') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STATO_COLORS[stato] || ''}`}>
                          {STATO_LABELS[stato] || stato}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {ril.stato === 'COMPLETATA' ? 'Tutti' : `${ril.ultimo_step_visitato + 1} / 7`}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center space-x-2">
                          {ril.stato === 'BOZZA' && (
                            <button onClick={() => apriInvioEmail(ril)} className="text-xs text-teal-700 font-medium hover:underline inline-flex items-center">
                              <Mail className="w-3 h-3 mr-1" /> Invia
                            </button>
                          )}
                          {['INVIATA', 'IN_COMPILAZIONE'].includes(stato) && (
                            <>
                              <button onClick={() => copiaLink(ril.token)} className="text-xs text-gray-600 font-medium hover:underline inline-flex items-center">
                                <Copy className="w-3 h-3 mr-1" /> Copia link
                              </button>
                              <button onClick={() => apriInvioEmail(ril, true)} className="text-xs text-teal-700 font-medium hover:underline inline-flex items-center">
                                <Send className="w-3 h-3 mr-1" /> Sollecita
                              </button>
                            </>
                          )}
                          {ril.stato === 'COMPLETATA' && (
                            <button onClick={() => setOpenedDetail(isOpen ? null : ril.id)} className="text-xs text-teal-700 font-medium hover:underline inline-flex items-center">
                              {isOpen ? 'Chiudi' : 'Apri'} <ChevronRight className={`w-3 h-3 ml-0.5 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                            </button>
                          )}
                          {ril.stato !== 'ARCHIVIATA' && (
                            <button onClick={() => archivia(ril)} className="text-xs text-gray-400 hover:text-red-500" title="Archivia">
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-gray-50">
                        <td colSpan={6} className="px-4 py-4">
                          <DettaglioRilevazione clienteId={clienteId} rilevazioneId={ril.id} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Banner informativo */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-start space-x-2">
          <AlertTriangle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">Il link al questionario è personale e collegato al cliente.</p>
            <p className="mt-1">Anagrafica, CCNL e stato delle certificazioni obbligatorie sono pre-compilati dai dati del gestionale e proposti al cliente come base da confermare o correggere.</p>
          </div>
        </div>
      </div>

      {/* Modale crea */}
      {showCreateModal && (
        <Modal onClose={() => !creating && setShowCreateModal(false)} title="Nuova rilevazione fabbisogno">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Titolo</label>
              <input
                type="text"
                value={formNuova.titolo}
                onChange={e => setFormNuova({ ...formNuova, titolo: e.target.value })}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
                placeholder="Es. Rilevazione 2026 — Annuale"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Anno di riferimento</label>
                <input
                  type="number"
                  value={formNuova.anno_riferimento}
                  onChange={e => setFormNuova({ ...formNuova, anno_riferimento: parseInt(e.target.value, 10) || new Date().getFullYear() })}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Validita\' link (giorni)</label>
                <input
                  type="number"
                  value={formNuova.giorni_validita_token}
                  onChange={e => setFormNuova({ ...formNuova, giorni_validita_token: Math.max(7, Math.min(365, parseInt(e.target.value, 10) || 90)) })}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded p-3 text-xs text-gray-600">
              Dopo la creazione si aprira\' il dialogo di invio email al cliente. Puoi anche annullare e inviarla in un secondo momento.
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button onClick={() => setShowCreateModal(false)} className="text-sm px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50" disabled={creating}>Annulla</button>
              <button onClick={creaRilevazione} className="text-sm px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-md font-medium inline-flex items-center" disabled={creating || !formNuova.titolo.trim()}>
                {creating ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Plus className="w-4 h-4 mr-1.5" />}
                Crea e prepara invio
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modale invio email */}
      {showSendModal && activeRilevazione && (
        <Modal onClose={() => !sending && setShowSendModal(false)} title={formEmail.eh_sollecito ? 'Sollecito al cliente' : 'Invia il questionario al cliente'}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Destinatario email <span className="text-gray-400 font-normal">(opzionale)</span>
              </label>
              <input
                type="email"
                value={formEmail.destinatario_email}
                onChange={e => setFormEmail({ ...formEmail, destinatario_email: e.target.value })}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Lascia vuoto per usare l\'email registrata del cliente"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Messaggio personalizzato <span className="text-gray-400 font-normal">(opzionale)</span>
              </label>
              <textarea
                rows={5}
                value={formEmail.messaggio_personale}
                onChange={e => setFormEmail({ ...formEmail, messaggio_personale: e.target.value })}
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Lascia vuoto per usare il messaggio standard. Se compilato, sostituisce l\'introduzione del template."
              />
              <p className="text-xs text-gray-500 mt-1">Il template grafico (header, dettagli, pulsante, firma) viene comunque applicato.</p>
            </div>
            <div className="bg-teal-50 border border-teal-200 rounded p-3 text-xs text-teal-800">
              <p className="font-medium">Anteprima link che riceve il cliente:</p>
              <p className="mt-1 font-mono break-all">{(process.env.NEXT_PUBLIC_APP_URL || window.location.origin).replace(/\/$/, '')}/fabbisogno/{activeRilevazione.token}</p>
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button onClick={() => setShowSendModal(false)} className="text-sm px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50" disabled={sending}>Annulla</button>
              <button onClick={inviaEmail} className="text-sm px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-md font-medium inline-flex items-center" disabled={sending}>
                {sending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Send className="w-4 h-4 mr-1.5" />}
                {formEmail.eh_sollecito ? 'Invia sollecito' : 'Invia email'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------------------
// Sub-componenti
// ----------------------------------------------------------------

function KpiCard({ icon: Icon, label, value, color }: { icon: typeof ClipboardList; label: string; value: string; color: string }) {
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

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="bg-white rounded-lg border border-dashed border-gray-300 p-8 text-center">
      <ClipboardList className="w-10 h-10 text-gray-300 mx-auto mb-3" />
      <h4 className="text-sm font-semibold text-gray-900">Nessuna rilevazione ancora attiva</h4>
      <p className="text-sm text-gray-500 mt-1 mb-4">Crea una nuova rilevazione per inviare al cliente il questionario di rilevazione fabbisogni.</p>
      <button onClick={onCreate} className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium px-3 py-2 rounded-md inline-flex items-center space-x-1.5">
        <Plus className="w-3.5 h-3.5" />
        <span>Crea la prima rilevazione</span>
      </button>
    </div>
  )
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

interface DettaglioData {
  rilevazione: Rilevazione & {
    obiettivi_strategici: string | null
    cambiamenti_previsti: string[] | null
    aree_gap_competenze: string[] | null
    figure_prioritarie: string[] | null
    modalita_erogazione: string[] | null
    budget_annuo: string | null
    vincoli_organizzativi: string[] | null
    picchi_operativita: number[] | null
    orizzonte_temporale: string | null
    strategicita_formazione: number | null
    livello_competenze_attuali: number | null
    note_libere: string | null
    altri_fabbisogni: string | null
    altri_obblighi_settore: string | null
    scadenze_imminenti: string | null
    misurazione_efficacia: string[] | null
    popolazione_target: string[] | null
    popolazione_target_specifica: string | null
    piano_formazione_esistente: string | null
    popolazione: Array<{ id: string; area: string; numero_dipendenti: number | null; note: string | null; ordine: number }>
    inserimenti_previsti: Array<{ id: string; area: string; numero_inserimenti: number | null; periodo: string | null }>
    obblighi_dichiarati: Array<{ id: string; tipo_obbligo: string; stato_dichiarato: string; stato_precompilato: string | null }>
  }
}

function DettaglioRilevazione({ clienteId, rilevazioneId }: { clienteId: string; rilevazioneId: string }) {
  const [data, setData] = useState<DettaglioData['rilevazione'] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/clienti/${clienteId}/formazione/fabbisogno/${rilevazioneId}`)
      .then(r => r.json())
      .then(j => { if (j.success) setData(j.data) })
      .finally(() => setLoading(false))
  }, [clienteId, rilevazioneId])

  if (loading) return <div className="py-4 text-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400 mx-auto" /></div>
  if (!data) return <p className="text-sm text-gray-500">Impossibile caricare il dettaglio.</p>

  const totalePopolazione = data.popolazione.reduce((acc, r) => acc + (r.numero_dipendenti || 0), 0)
  const discrepanze = data.obblighi_dichiarati.filter(o => o.stato_precompilato && o.stato_precompilato !== o.stato_dichiarato)

  return (
    <div className="space-y-3 text-sm">

      {/* Sezione A — anagrafica */}
      <DetailCard title="A — Anagrafica e contesto" letter="A">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="Referente" value={data.referente_nome ? `${data.referente_nome}${data.referente_ruolo ? ' (' + ROLE_LABELS[data.referente_ruolo] + ')' : ''}` : '—'} />
          <Field label="ATECO" value={data.ateco_dichiarato || '—'} />
          <Field label="CCNL" value={data.ccnl_dichiarato || '—'} />
          <Field label="Dipendenti" value={data.numero_dipendenti_dichiarato?.toString() || '—'} />
          <Field label="Compila per" value={data.popolazione_target?.length ? data.popolazione_target.join(', ') : '—'} />
        </div>
        {data.popolazione.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-700 mb-2">Popolazione mappata (totale: {totalePopolazione})</p>
            <div className="flex flex-wrap gap-1.5">
              {data.popolazione.map(p => (
                <span key={p.id} className="text-xs bg-gray-100 px-2 py-1 rounded">
                  {p.area}: <span className="font-medium">{p.numero_dipendenti ?? '?'}</span>
                </span>
              ))}
            </div>
          </div>
        )}
        {data.inserimenti_previsti.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-700 mb-2">Inserimenti previsti</p>
            <ul className="text-xs text-gray-700 space-y-0.5">
              {data.inserimenti_previsti.map(i => (
                <li key={i.id}>• {i.area} — {i.numero_inserimenti ?? '?'} {i.periodo ? `(${i.periodo})` : ''}</li>
              ))}
            </ul>
          </div>
        )}
      </DetailCard>

      {/* Sezione B */}
      <DetailCard title="B — Strategia formativa" letter="B">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Piano esistente" value={PIANO_LABELS[data.piano_formazione_esistente || ''] || '—'} />
          <Field label="Cambiamenti previsti" value={data.cambiamenti_previsti?.join(' · ') || '—'} />
        </div>
        {data.obiettivi_strategici && (
          <div className="mt-2"><p className="text-xs text-gray-500">Obiettivi strategici</p><p className="text-gray-900">{data.obiettivi_strategici}</p></div>
        )}
      </DetailCard>

      {/* Sezione C — obblighi con discrepanze evidenziate */}
      {data.obblighi_dichiarati.length > 0 && (
        <DetailCard title="C — Formazione obbligatoria" letter="C">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-gray-500">
                <tr>
                  <th className="text-left px-2 py-1">Tipologia</th>
                  <th className="text-left px-2 py-1">Stato dichiarato</th>
                  <th className="text-left px-2 py-1">Pre-compilato</th>
                  <th className="text-left px-2 py-1">Match</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.obblighi_dichiarati.map(o => {
                  const haDiscrepanza = o.stato_precompilato && o.stato_precompilato !== o.stato_dichiarato
                  return (
                    <tr key={o.id}>
                      <td className="px-2 py-1.5 text-gray-700">{TIPO_OBBLIGO_LABELS[o.tipo_obbligo] || o.tipo_obbligo}</td>
                      <td className="px-2 py-1.5"><span className={`px-1.5 py-0.5 rounded ${STATO_DICH_COLORS[o.stato_dichiarato]}`}>{STATO_DICH_LABELS[o.stato_dichiarato]}</span></td>
                      <td className="px-2 py-1.5 text-gray-500">{o.stato_precompilato ? STATO_DICH_LABELS[o.stato_precompilato] : '—'}</td>
                      <td className="px-2 py-1.5">{haDiscrepanza ? <span className="text-amber-700">⚠ discrepanza</span> : '✓'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {discrepanze.length > 0 && (
            <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
              <strong>{discrepanze.length} discrepanza/e</strong> rispetto a quanto risulta nel gestionale. Verifica con il cliente.
            </div>
          )}
        </DetailCard>
      )}

      {/* Sezione D */}
      <DetailCard title="D — Fabbisogni non obbligatori" letter="D">
        <div className="space-y-2">
          {data.aree_gap_competenze?.length ? (
            <div>
              <p className="text-xs text-gray-500 mb-1">Aree di gap</p>
              <div className="flex flex-wrap gap-1.5">
                {data.aree_gap_competenze.map(a => (
                  <span key={a} className="px-2 py-0.5 text-xs rounded-full bg-teal-50 text-teal-700 border border-teal-200">{a}</span>
                ))}
              </div>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Livello attuale (1-5)" value={data.livello_competenze_attuali?.toString() || '—'} />
            <Field label="Figure prioritarie" value={data.figure_prioritarie?.join(' · ') || '—'} />
          </div>
          {data.altri_fabbisogni && <Field label="Altri fabbisogni" value={data.altri_fabbisogni} />}
        </div>
      </DetailCard>

      {/* Sezione E */}
      <DetailCard title="E — Modalita\' e budget" letter="E">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Modalita\'" value={data.modalita_erogazione?.join(' · ') || '—'} />
          <Field label="Budget" value={BUDGET_LABELS[data.budget_annuo || ''] || '—'} />
          <Field label="Vincoli" value={data.vincoli_organizzativi?.join(' · ') || '—'} />
          <Field label="Picchi operativita\'" value={data.picchi_operativita?.length ? data.picchi_operativita.map(m => MESI[m - 1]).join(' · ') : '—'} />
        </div>
      </DetailCard>

      {/* Sezione F */}
      <DetailCard title="F — Priorita\' e valutazione" letter="F">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Orizzonte" value={ORIZZONTE_LABELS[data.orizzonte_temporale || ''] || '—'} />
          <Field label="Strategicita\' (1-5)" value={data.strategicita_formazione?.toString() || '—'} />
        </div>
        {data.note_libere && (
          <div className="mt-3"><p className="text-xs text-gray-500">Note libere</p><p className="text-gray-700 italic">«{data.note_libere}»</p></div>
        )}
      </DetailCard>
    </div>
  )
}

function DetailCard({ title, letter, children }: { title: string; letter: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <h4 className="text-xs font-semibold text-gray-900 flex items-center mb-2">
        <span className="w-5 h-5 rounded bg-teal-50 text-teal-700 text-xs font-bold flex items-center justify-center mr-2">{letter}</span>
        {title}
      </h4>
      <div className="text-sm">{children}</div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm text-gray-900 font-medium">{value}</p>
    </div>
  )
}

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------

const ROLE_LABELS: Record<string, string> = {
  TITOLARE_AMMINISTRATORE: 'Titolare/Amministratore',
  DIRETTORE_GENERALE: 'Direttore Generale',
  HR_MANAGER: 'HR Manager',
  RESPONSABILE_FUNZIONE: 'Resp. di funzione',
  RESPONSABILE_STABILIMENTO: 'Resp. di stabilimento',
  ALTRO: 'Altro',
}

const PIANO_LABELS: Record<string, string> = {
  SI_AGGIORNATO: 'Sì, aggiornato annualmente',
  SI_NON_AGGIORNATO: 'Sì, non aggiornato di recente',
  NO_CASO_PER_CASO: 'No, caso per caso',
  NO_PRIMA_VOLTA: 'No, prima volta',
}

const BUDGET_LABELS: Record<string, string> = {
  FINO_3000: 'Fino a 3.000 €',
  '3001_10000': '3.001 — 10.000 €',
  '10001_30000': '10.001 — 30.000 €',
  OLTRE_30000: 'Oltre 30.000 €',
  NON_DEFINITO: 'Non definito',
}

const ORIZZONTE_LABELS: Record<string, string> = {
  ENTRO_3_MESI: 'Entro 3 mesi (urgente)',
  ENTRO_6_MESI: 'Entro 6 mesi',
  ENTRO_FINE_ANNO: 'Entro fine anno',
  PLURIENNALE: 'Pianificazione pluriennale',
}

const STATO_DICH_LABELS: Record<string, string> = {
  ADEMPIUTO: 'Adempiuto',
  DA_RINNOVARE: 'Da rinnovare',
  NON_SVOLTO: 'Non svolto',
  NON_APPLICABILE: 'Non applicabile',
}

const STATO_DICH_COLORS: Record<string, string> = {
  ADEMPIUTO: 'bg-green-50 text-green-700',
  DA_RINNOVARE: 'bg-amber-50 text-amber-700',
  NON_SVOLTO: 'bg-red-50 text-red-700',
  NON_APPLICABILE: 'bg-gray-100 text-gray-600',
}

const TIPO_OBBLIGO_LABELS: Record<string, string> = {
  FORMAZIONE_LAVORATORI_RISCHIO_BASSO: 'Form. lavoratori rischio basso',
  FORMAZIONE_LAVORATORI_RISCHIO_MEDIO: 'Form. lavoratori rischio medio',
  FORMAZIONE_LAVORATORI_RISCHIO_ALTO: 'Form. lavoratori rischio alto',
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
  RESPONSABILITA_AMMINISTRATIVA_231: 'D.Lgs. 231/01',
  USO_ATTREZZATURE: 'Uso attrezzature',
  ALTRO: 'Altro',
}

const MESI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']
