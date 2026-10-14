'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, Loader2, Lock, AlertCircle, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  FORMA_LABEL, STATO_LABEL, CAMPI_EREDITATI_DA_PROGETTO,
  type ContributoWithJoins, type ContributoForma, type ContributoStato
} from '@/lib/contributi/types'

interface ContributoFormModalProps {
  clienteId: string
  contributo: ContributoWithJoins | null   // null = nuovo contributo
  onClose: () => void
  onSaved: () => void
}

type BandoOpzione = { id: string; nome: string; codice_bando: string | null; ente_erogatore: string | null }

// Valori del form come stringhe (input controllati); la conversione la fa l'API
type FormState = {
  anno_competenza: string
  bando_mode: 'catalogo' | 'manuale'
  bando_id: string
  bando_denominazione_manuale: string
  ente_erogatore: string
  forma_contributo: ContributoForma
  stato: ContributoStato
  importo_progetto: string
  importo_contributo: string
  esl: string
  intensita_aiuto_pct: string
  regime_aiuto: string
  rna_codice_concessione: string
  rna_url: string
  data_concessione: string
  data_erogazione: string
  note: string
}

const str = (v: string | number | null | undefined) => (v == null ? '' : String(v))

function statoIniziale(c: ContributoWithJoins | null): FormState {
  return {
    anno_competenza: str(c?.anno_competenza ?? new Date().getFullYear()),
    bando_mode: c && !c.bando_id ? 'manuale' : 'catalogo',
    bando_id: str(c?.bando_id),
    bando_denominazione_manuale: str(c?.bando_denominazione_manuale),
    ente_erogatore: str(c?.ente_erogatore),
    forma_contributo: c?.forma_contributo ?? 'FONDO_PERDUTO',
    stato: c?.stato ?? 'AMMESSO',
    importo_progetto: str(c?.importo_progetto),
    importo_contributo: str(c?.importo_contributo),
    esl: str(c?.esl),
    intensita_aiuto_pct: str(c?.intensita_aiuto_pct),
    regime_aiuto: str(c?.regime_aiuto),
    rna_codice_concessione: str(c?.rna_codice_concessione),
    rna_url: str(c?.rna_url),
    data_concessione: str(c?.data_concessione),
    data_erogazione: str(c?.data_erogazione),
    note: str(c?.note),
  }
}

const REGIMI_SUGGERITI = [
  'De minimis (Reg. UE 2023/2831)',
  'GBER (Reg. UE 651/2014)',
  'Temporary Framework',
  'Notificato',
]

const inputCls = 'w-full text-sm border border-gray-300 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100 disabled:text-gray-500'
const labelCls = 'block text-xs font-medium text-gray-700 mb-1'

export default function ContributoFormModal({ clienteId, contributo, onClose, onSaved }: ContributoFormModalProps) {
  const isEdit = contributo !== null
  // Righe orfane (progetto cancellato, progetto_id NULL) tornano completamente modificabili
  const daProgetto = contributo?.origine === 'DA_PROGETTO' && contributo?.progetto_id !== null
  // Su righe DA_PROGETTO i campi ereditati si modificano dal progetto (l'API li ignora)
  const bloccato = (campo: string) => daProgetto && (CAMPI_EREDITATI_DA_PROGETTO as readonly string[]).includes(campo)

  const [form, setForm] = useState<FormState>(() => statoIniziale(contributo))
  const [bandi, setBandi] = useState<BandoOpzione[]>([])
  const [loadingBandi, setLoadingBandi] = useState(true)
  const [cercaBando, setCercaBando] = useState('')
  const [saving, setSaving] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  const set = <K extends keyof FormState>(campo: K, valore: FormState[K]) =>
    setForm(prev => ({ ...prev, [campo]: valore }))

  // Catalogo bandi per il select (lettura diretta, come ProgettoForm)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('scadenze_bandi_bandi')
        .select('id, nome, codice_bando, ente_erogatore')
        .order('nome')
      if (cancelled) return
      if (error) console.error('[ContributoFormModal] Errore caricamento bandi:', error)
      setBandi((data as BandoOpzione[]) || [])
      setLoadingBandi(false)
    })()
    return () => { cancelled = true }
  }, [])

  // Chiusura con Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !saving) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, saving])

  const bandiFiltrati = useMemo(() => {
    const q = cercaBando.trim().toLowerCase()
    const lista = q
      ? bandi.filter(b => b.nome.toLowerCase().includes(q) || b.codice_bando?.toLowerCase().includes(q))
      : bandi
    // Il bando selezionato resta sempre tra le opzioni anche se escluso dalla ricerca
    const selezionato = bandi.find(b => b.id === form.bando_id)
    return selezionato && !lista.includes(selezionato) ? [selezionato, ...lista] : lista
  }, [bandi, cercaBando, form.bando_id])

  const bandoSelezionato = bandi.find(b => b.id === form.bando_id) ?? contributo?.bando ?? null

  // Suggerimenti di calcolo
  const contributoNum = parseFloat(form.importo_contributo)
  const eslNum = parseFloat(form.esl)
  const progettoNum = parseFloat(form.importo_progetto)
  const puoCopiareEsl = form.forma_contributo === 'FONDO_PERDUTO' && Number.isFinite(contributoNum) && form.esl !== form.importo_contributo
  const intensitaCalcolata = Number.isFinite(eslNum) && Number.isFinite(progettoNum) && progettoNum > 0
    ? Math.round((eslNum / progettoNum) * 10000) / 100
    : null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrore(null)

    // Validazioni minime lato client (le stesse sono ripetute dall'API)
    const anno = Number(form.anno_competenza)
    if (!bloccato('anno_competenza') && (!Number.isInteger(anno) || anno < 1990 || anno > 2100)) {
      setErrore('Anno di competenza non valido (1990-2100)')
      return
    }
    const usaCatalogo = form.bando_mode === 'catalogo'
    if (!bloccato('bando_id')) {
      if (usaCatalogo && !form.bando_id) { setErrore('Seleziona un bando dal catalogo'); return }
      if (!usaCatalogo && !form.bando_denominazione_manuale.trim()) {
        setErrore('Indica la denominazione del bando'); return
      }
    }

    const etichetteImporti: Array<[keyof FormState, string]> = [
      ['importo_progetto', 'Importo progetto'],
      ['importo_contributo', 'Contributo'],
      ['esl', 'ESL'],
    ]
    for (const [campo, etichetta] of etichetteImporti) {
      if (bloccato(campo) || form[campo] === '') continue
      if (Number(form[campo]) < 0) { setErrore(`${etichetta}: non può essere negativo`); return }
    }
    if (form.intensita_aiuto_pct !== '') {
      const pct = Number(form.intensita_aiuto_pct)
      if (pct < 0 || pct > 100) { setErrore('Intensità di aiuto: deve essere tra 0 e 100'); return }
    }
    const rnaUrl = form.rna_url.trim()
    if (rnaUrl && !/^https?:\/\//i.test(rnaUrl)) {
      setErrore('Link RNA: deve iniziare con http:// o https://'); return
    }

    const payload: Record<string, unknown> = {
      anno_competenza: anno,
      bando_id: usaCatalogo ? form.bando_id : null,
      bando_denominazione_manuale: usaCatalogo ? null : form.bando_denominazione_manuale,
      ente_erogatore: form.ente_erogatore,
      forma_contributo: form.forma_contributo,
      stato: form.stato,
      importo_progetto: form.importo_progetto,
      importo_contributo: form.importo_contributo,
      esl: form.esl,
      intensita_aiuto_pct: form.intensita_aiuto_pct,
      regime_aiuto: form.regime_aiuto,
      rna_codice_concessione: form.rna_codice_concessione,
      rna_url: form.rna_url,
      data_concessione: form.data_concessione,
      data_erogazione: form.data_erogazione,
      note: form.note,
    }
    if (daProgetto) {
      // Non inviare i campi gestiti dal progetto; la denominazione manuale
      // resta modificabile solo se il progetto non ha un bando collegato
      for (const campo of CAMPI_EREDITATI_DA_PROGETTO) delete payload[campo]
      if (contributo?.bando_id) delete payload.bando_denominazione_manuale
      else payload.bando_denominazione_manuale = form.bando_denominazione_manuale
    }

    try {
      setSaving(true)
      const res = await fetch(
        isEdit ? `/api/clienti/${clienteId}/contributi/${contributo.id}` : `/api/clienti/${clienteId}/contributi`,
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      )
      const json = await res.json()
      if (!json.success) {
        setErrore(json.error || 'Errore nel salvataggio')
        return
      }
      onSaved()
    } catch (err) {
      console.error('[ContributoFormModal] Errore salvataggio:', err)
      setErrore('Errore di rete')
    } finally {
      setSaving(false)
    }
  }

  const rifProgetto = contributo?.progetto?.codice_progetto || contributo?.progetto?.titolo_progetto

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h3 className="text-base font-semibold text-gray-900">
            {isEdit ? 'Modifica contributo' : 'Nuovo contributo'}
          </h3>
          <button onClick={onClose} disabled={saving} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-5">
            {daProgetto && (
              <div className="flex items-start gap-2 bg-primary-50 border border-primary-200 rounded-md p-3">
                <Lock className="w-4 h-4 text-primary-700 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-primary-800">
                  Contributo derivato dal progetto <strong>{rifProgetto || 'collegato'}</strong>.{' '}
                  Anno, bando, importi e data di concessione si gestiscono dal progetto; qui puoi completare
                  forma, ESL, intensità, regime di aiuto, dati RNA, stato ed erogazione.
                </p>
              </div>
            )}

            {/* Bando */}
            <section>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Bando</h4>
              {bloccato('bando_id') ? (
                contributo?.bando_id ? (
                  <div className="text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-md px-2.5 py-1.5">
                    {bandoSelezionato?.nome || '—'}
                  </div>
                ) : (
                  <div>
                    <label className={labelCls}>Denominazione bando</label>
                    <input
                      className={inputCls}
                      value={form.bando_denominazione_manuale}
                      onChange={e => set('bando_denominazione_manuale', e.target.value)}
                    />
                  </div>
                )
              ) : (
                <>
                  <div className="flex items-center gap-4 mb-2">
                    <label className="flex items-center gap-1.5 text-xs text-gray-700">
                      <input
                        type="radio"
                        checked={form.bando_mode === 'catalogo'}
                        onChange={() => set('bando_mode', 'catalogo')}
                      />
                      Dal catalogo bandi
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-gray-700">
                      <input
                        type="radio"
                        checked={form.bando_mode === 'manuale'}
                        onChange={() => set('bando_mode', 'manuale')}
                      />
                      Non in catalogo (inserimento libero)
                    </label>
                  </div>
                  {form.bando_mode === 'catalogo' ? (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          className={`${inputCls} pl-8`}
                          placeholder="Cerca per nome o codice bando…"
                          value={cercaBando}
                          onChange={e => setCercaBando(e.target.value)}
                        />
                      </div>
                      <select
                        className={inputCls}
                        value={form.bando_id}
                        onChange={e => {
                          const b = bandi.find(x => x.id === e.target.value)
                          set('bando_id', e.target.value)
                          // Precompila l'ente se vuoto
                          if (b?.ente_erogatore && !form.ente_erogatore) set('ente_erogatore', b.ente_erogatore)
                        }}
                        disabled={loadingBandi}
                      >
                        <option value="">{loadingBandi ? 'Caricamento bandi…' : '— Seleziona un bando —'}</option>
                        {bandiFiltrati.map(b => (
                          <option key={b.id} value={b.id}>
                            {b.nome}{b.codice_bando ? ` (${b.codice_bando})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <input
                      className={inputCls}
                      placeholder="Es. Bando Digitalizzazione PMI Regione Marche 2023"
                      value={form.bando_denominazione_manuale}
                      onChange={e => set('bando_denominazione_manuale', e.target.value)}
                    />
                  )}
                </>
              )}
              <div className="mt-3">
                <label className={labelCls}>Ente erogatore</label>
                <input
                  className={inputCls}
                  placeholder={bandoSelezionato?.ente_erogatore || 'Es. Regione Marche, MIMIT, Invitalia'}
                  value={form.ente_erogatore}
                  onChange={e => set('ente_erogatore', e.target.value)}
                />
              </div>
            </section>

            {/* Classificazione */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Anno di competenza *</label>
                <input
                  type="number"
                  min={1990}
                  max={2100}
                  className={inputCls}
                  value={form.anno_competenza}
                  onChange={e => set('anno_competenza', e.target.value)}
                  disabled={bloccato('anno_competenza')}
                />
              </div>
              <div>
                <label className={labelCls}>Forma del contributo</label>
                <select
                  className={inputCls}
                  value={form.forma_contributo}
                  onChange={e => set('forma_contributo', e.target.value as ContributoForma)}
                >
                  {Object.entries(FORMA_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Stato</label>
                <select
                  className={inputCls}
                  value={form.stato}
                  onChange={e => set('stato', e.target.value as ContributoStato)}
                >
                  {Object.entries(STATO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </section>

            {/* Importi */}
            <section>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Importi (€)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Importo progetto</label>
                  <input
                    type="number" step="0.01" min={0}
                    className={inputCls}
                    value={form.importo_progetto}
                    onChange={e => set('importo_progetto', e.target.value)}
                    disabled={bloccato('importo_progetto')}
                  />
                </div>
                <div>
                  <label className={labelCls}>Contributo</label>
                  <input
                    type="number" step="0.01" min={0}
                    className={inputCls}
                    value={form.importo_contributo}
                    onChange={e => set('importo_contributo', e.target.value)}
                    disabled={bloccato('importo_contributo')}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className={labelCls}>ESL – Equivalente Sovvenzione Lordo</label>
                    {puoCopiareEsl && (
                      <button
                        type="button"
                        onClick={() => set('esl', form.importo_contributo)}
                        className="text-[11px] text-primary-600 hover:underline mb-1"
                      >
                        = contributo
                      </button>
                    )}
                  </div>
                  <input
                    type="number" step="0.01" min={0}
                    className={inputCls}
                    value={form.esl}
                    onChange={e => set('esl', e.target.value)}
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    Per il fondo perduto coincide con il contributo; per finanziamenti e garanzie è inferiore.
                  </p>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className={labelCls}>Intensità di aiuto (%)</label>
                    {intensitaCalcolata !== null && String(intensitaCalcolata) !== form.intensita_aiuto_pct && (
                      <button
                        type="button"
                        onClick={() => set('intensita_aiuto_pct', String(intensitaCalcolata))}
                        className="text-[11px] text-primary-600 hover:underline mb-1"
                        title="ESL / importo progetto"
                      >
                        calcola: {intensitaCalcolata.toLocaleString('it-IT')}%
                      </button>
                    )}
                  </div>
                  <input
                    type="number" step="0.01" min={0} max={100}
                    className={inputCls}
                    value={form.intensita_aiuto_pct}
                    onChange={e => set('intensita_aiuto_pct', e.target.value)}
                  />
                </div>
              </div>
            </section>

            {/* Aiuti di Stato / RNA */}
            <section>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Aiuti di Stato / RNA</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Regime di aiuto</label>
                  <input
                    className={inputCls}
                    list="contributo-regimi"
                    value={form.regime_aiuto}
                    onChange={e => set('regime_aiuto', e.target.value)}
                  />
                  <datalist id="contributo-regimi">
                    {REGIMI_SUGGERITI.map(r => <option key={r} value={r} />)}
                  </datalist>
                </div>
                <div>
                  <label className={labelCls}>Codice concessione RNA (COR)</label>
                  <input
                    className={inputCls}
                    value={form.rna_codice_concessione}
                    onChange={e => set('rna_codice_concessione', e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <label className={labelCls}>Link RNA</label>
                  <input
                    type="url"
                    className={inputCls}
                    placeholder="https://www.rna.gov.it/…"
                    value={form.rna_url}
                    onChange={e => set('rna_url', e.target.value)}
                  />
                </div>
              </div>
            </section>

            {/* Date */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Data concessione</label>
                <input
                  type="date"
                  className={inputCls}
                  value={form.data_concessione}
                  onChange={e => set('data_concessione', e.target.value)}
                  disabled={bloccato('data_concessione')}
                />
              </div>
              <div>
                <label className={labelCls}>Data erogazione</label>
                <input
                  type="date"
                  className={inputCls}
                  value={form.data_erogazione}
                  onChange={e => set('data_erogazione', e.target.value)}
                />
              </div>
            </section>

            <div>
              <label className={labelCls}>Note</label>
              <textarea
                rows={3}
                className={inputCls}
                value={form.note}
                onChange={e => set('note', e.target.value)}
              />
            </div>

            {errore && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-md p-2.5">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                <span className="text-xs text-red-700">{errore}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-3 sticky bottom-0 bg-white">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-60 flex items-center gap-1.5"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isEdit ? 'Salva modifiche' : 'Crea contributo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
