'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  Loader2, AlertCircle, CheckCircle, ArrowLeft, ArrowRight, Save, Send,
  ClipboardList, Trash2, Plus, Zap
} from 'lucide-react'

// =================================================================
// TIPI E COSTANTI
// =================================================================

interface CategoriaObbligo {
  id: string
  label: string
  tipo_obbligo: string
  stato_precompilato: string | null
}
interface ClientePrecompilato {
  denominazione: string
  partita_iva: string | null
  ateco: string | null
  ateco_descrizione: string | null
  ccnl: string | null
  numero_dipendenti: number | null
}
interface ApiData {
  rilevazione: any
  cliente_precompilato: ClientePrecompilato | null
  categorie_obblighi_c: CategoriaObbligo[]
  readonly: boolean
}

interface PopolazioneRow { area: string; numero_dipendenti: number | null; note: string | null; ordine: number }
interface InserimentoRow { area: string; numero_inserimenti: number | null; periodo: string | null; ordine: number }
interface ObbligoRow { tipo_obbligo: string; stato_dichiarato: string; stato_precompilato: string | null }

interface FormState {
  // A
  referente_nome: string
  referente_ruolo: string
  ateco_dichiarato: string
  ccnl_dichiarato: string
  numero_dipendenti_dichiarato: number | ''
  popolazione_target: string[]
  popolazione_target_specifica: string
  popolazione: PopolazioneRow[]
  inserimenti_previsti: InserimentoRow[]
  // B
  piano_formazione_esistente: string
  obiettivi_strategici: string
  cambiamenti_previsti: string[]
  // C
  scadenze_imminenti: string
  altri_obblighi_settore: string
  obblighi_dichiarati: ObbligoRow[]
  // D
  aree_gap_competenze: string[]
  altri_fabbisogni: string
  livello_competenze_attuali: number | ''
  figure_prioritarie: string[]
  // E
  modalita_erogazione: string[]
  budget_annuo: string
  vincoli_organizzativi: string[]
  picchi_operativita: number[]
  // F
  orizzonte_temporale: string
  strategicita_formazione: number | ''
  misurazione_efficacia: string[]
  note_libere: string
  // meta
  ultimo_step_visitato: number
}

const RUOLI = [
  { v: 'TITOLARE_AMMINISTRATORE', l: 'Titolare / Amministratore' },
  { v: 'DIRETTORE_GENERALE', l: 'Direttore Generale' },
  { v: 'HR_MANAGER', l: 'HR Manager / Responsabile del personale' },
  { v: 'RESPONSABILE_FUNZIONE', l: 'Responsabile di funzione / area' },
  { v: 'RESPONSABILE_STABILIMENTO', l: 'Responsabile di stabilimento / sede' },
  { v: 'ALTRO', l: 'Altro' },
]
const POPOLAZIONE_TARGET = [
  { v: 'TUTTA_AZIENDA', l: "Tutta l'azienda" },
  { v: 'FUNZIONE_SPECIFICA', l: 'Una specifica funzione / reparto' },
  { v: 'OPERATIVI', l: 'Solo figure operative / operai' },
  { v: 'IMPIEGATI', l: 'Solo figure impiegatizie' },
  { v: 'QUADRI_DIRIGENTI', l: 'Solo quadri e dirigenti' },
  { v: 'NEOASSUNTI', l: 'Neoassunti / nuove risorse' },
]
const PIANO_OPTS = [
  { v: 'SI_AGGIORNATO', l: 'Sì, aggiornato annualmente' },
  { v: 'SI_NON_AGGIORNATO', l: 'Sì, ma non aggiornato di recente' },
  { v: 'NO_CASO_PER_CASO', l: 'No, si pianifica caso per caso' },
  { v: 'NO_PRIMA_VOLTA', l: 'No, è la prima volta' },
]
const CAMBIAMENTI = [
  { v: 'TECNOLOGIE', l: 'Nuove tecnologie / software' },
  { v: 'RIORGANIZZAZIONE', l: 'Riorganizzazione interna' },
  { v: 'COMMERCIALE', l: 'Espansione commerciale / nuovi mercati' },
  { v: 'NORMATIVE', l: 'Nuove normative / adempimenti' },
  { v: 'CRESCITA', l: 'Crescita personale / nuove assunzioni' },
  { v: 'NESSUNO', l: 'Nessun cambiamento rilevante' },
]
const AREE_GAP = [
  { v: 'TECNICHE_RUOLO', l: 'Competenze tecniche di ruolo' },
  { v: 'DIGITALI_IA', l: 'Competenze digitali / IA' },
  { v: 'LINGUE', l: 'Lingue straniere' },
  { v: 'LEADERSHIP', l: 'Leadership e gestione collaboratori' },
  { v: 'COMUNICAZIONE', l: 'Comunicazione e teamwork' },
  { v: 'VENDITA', l: 'Vendita e gestione cliente' },
  { v: 'PROJECT_MGMT', l: 'Project management' },
  { v: 'LEAN_QUALITA', l: 'Qualità, lean, miglioramento continuo' },
  { v: 'CONTROLLO_GESTIONE', l: 'Controllo di gestione' },
  { v: 'COMPLIANCE', l: 'Compliance e contrattualistica' },
  { v: 'BENESSERE', l: 'Salute, benessere, gestione stress' },
  { v: 'ALTRO', l: 'Altro' },
]
const FIGURE_PRIORITARIE = [
  { v: 'OPERAI', l: 'Operai / personale operativo' },
  { v: 'IMPIEGATI_AMM', l: 'Impiegati amministrativi' },
  { v: 'TECNICI', l: 'Tecnici specializzati' },
  { v: 'COMMERCIALI', l: 'Commerciali / agenti' },
  { v: 'QUADRI', l: 'Quadri / responsabili intermedi' },
  { v: 'DIRIGENTI', l: 'Dirigenti / management' },
  { v: 'NEOASSUNTI', l: 'Neoassunti' },
  { v: 'TUTTE', l: 'Tutte le figure in egual misura' },
]
const MODALITA = [
  { v: 'AULA_SEDE', l: 'Aula in sede' },
  { v: 'AULA_ESTERNA', l: 'Aula esterna / ente formativo' },
  { v: 'WEBINAR', l: 'Webinar / FAD sincrona' },
  { v: 'BLENDED', l: 'Blended (online + presenza)' },
  { v: 'ON_THE_JOB', l: 'Affiancamento on the job' },
  { v: 'COACHING', l: 'Coaching / mentoring individuale' },
]
const BUDGET = [
  { v: 'FINO_3000', l: 'Fino a 3.000 €' },
  { v: '3001_10000', l: '3.001 — 10.000 €' },
  { v: '10001_30000', l: '10.001 — 30.000 €' },
  { v: 'OLTRE_30000', l: 'Oltre 30.000 €' },
  { v: 'NON_DEFINITO', l: 'Non definito' },
]
const VINCOLI = [
  { v: 'LIBERARE_PERSONE', l: 'Difficoltà a liberare le persone' },
  { v: 'TURNI_RIGIDI', l: 'Turni / orari rigidi' },
  { v: 'SEDI_DISTACCATE', l: 'Sedi distaccate / personale disperso' },
  { v: 'BUDGET', l: 'Budget limitato' },
  { v: 'MOTIVAZIONE', l: 'Scarsa motivazione del personale' },
  { v: 'NESSUNO', l: 'Nessun vincolo rilevante' },
]
const ORIZZONTE = [
  { v: 'ENTRO_3_MESI', l: 'Entro 3 mesi (urgente)' },
  { v: 'ENTRO_6_MESI', l: 'Entro 6 mesi' },
  { v: 'ENTRO_FINE_ANNO', l: 'Entro fine anno' },
  { v: 'PLURIENNALE', l: 'Pianificazione pluriennale' },
]
const MISURAZIONE = [
  { v: 'TEST', l: 'Test / verifiche di apprendimento' },
  { v: 'FEEDBACK', l: 'Feedback partecipanti' },
  { v: 'PERFORMANCE', l: 'Valutazione performance post-formazione' },
  { v: 'KPI', l: 'Indicatori KPI aziendali' },
  { v: 'NON_MISURATA', l: 'Non viene misurata' },
  { v: 'ALTRO', l: 'Altro' },
]
const STATI_OBBLIGHI = [
  { v: 'ADEMPIUTO', l: 'Adempiuto' },
  { v: 'DA_RINNOVARE', l: 'Da rinnovare' },
  { v: 'NON_SVOLTO', l: 'Non svolto' },
  { v: 'NON_APPLICABILE', l: 'N/A' },
]
const SCADENZE_IMMINENTI = [
  { v: 'SI', l: 'Sì' },
  { v: 'NO', l: 'No' },
  { v: 'DA_VERIFICARE', l: 'Da verificare' },
]
const MESI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

const STEPS = [
  { id: 0, letter: 'A', label: 'Anagrafica' },
  { id: 1, letter: 'B', label: 'Strategia' },
  { id: 2, letter: 'C', label: 'Obbligatoria' },
  { id: 3, letter: 'D', label: 'Fabbisogni' },
  { id: 4, letter: 'E', label: 'Modalità' },
  { id: 5, letter: 'F', label: 'Priorità' },
  { id: 6, letter: '✓', label: 'Riepilogo' },
]
const TOTAL_STEPS = STEPS.length

function emptyForm(): FormState {
  return {
    referente_nome: '', referente_ruolo: '', ateco_dichiarato: '',
    ccnl_dichiarato: '', numero_dipendenti_dichiarato: '',
    popolazione_target: [], popolazione_target_specifica: '',
    popolazione: [], inserimenti_previsti: [],
    piano_formazione_esistente: '', obiettivi_strategici: '',
    cambiamenti_previsti: [],
    scadenze_imminenti: '', altri_obblighi_settore: '', obblighi_dichiarati: [],
    aree_gap_competenze: [], altri_fabbisogni: '', livello_competenze_attuali: '',
    figure_prioritarie: [],
    modalita_erogazione: [], budget_annuo: '', vincoli_organizzativi: [],
    picchi_operativita: [],
    orizzonte_temporale: '', strategicita_formazione: '', misurazione_efficacia: [],
    note_libere: '',
    ultimo_step_visitato: 0,
  }
}

function buildInitialForm(api: ApiData): FormState {
  const r = api.rilevazione
  const f = emptyForm()

  // Carica i campi gia' salvati (modifica precedente)
  for (const k of Object.keys(f) as (keyof FormState)[]) {
    const val = (r as any)[k]
    if (val !== null && val !== undefined) {
      ;(f as any)[k] = Array.isArray(val) ? [...val] : val
    }
  }

  // Pre-compilazione dai dati cliente — solo se i campi non sono ancora valorizzati
  const cp = api.cliente_precompilato
  if (cp) {
    if (!f.ateco_dichiarato && cp.ateco) {
      f.ateco_dichiarato = cp.ateco_descrizione
        ? `${cp.ateco} — ${cp.ateco_descrizione}`
        : cp.ateco
    }
    if (!f.ccnl_dichiarato && cp.ccnl) f.ccnl_dichiarato = cp.ccnl
    if (!f.numero_dipendenti_dichiarato && cp.numero_dipendenti) {
      f.numero_dipendenti_dichiarato = cp.numero_dipendenti
    }
  }

  // Tabelle figlie
  f.popolazione = (r.popolazione || []).map((x: any) => ({
    area: x.area, numero_dipendenti: x.numero_dipendenti, note: x.note, ordine: x.ordine,
  }))
  f.inserimenti_previsti = (r.inserimenti_previsti || []).map((x: any) => ({
    area: x.area, numero_inserimenti: x.numero_inserimenti, periodo: x.periodo, ordine: x.ordine,
  }))

  // Pre-compilazione obblighi: se la rilevazione non ha ancora dichiarazioni,
  // usiamo le pre-compilazioni del backend come default
  if (r.obblighi_dichiarati && r.obblighi_dichiarati.length > 0) {
    f.obblighi_dichiarati = r.obblighi_dichiarati.map((o: any) => ({
      tipo_obbligo: o.tipo_obbligo,
      stato_dichiarato: o.stato_dichiarato,
      stato_precompilato: o.stato_precompilato,
    }))
  } else {
    f.obblighi_dichiarati = api.categorie_obblighi_c
      .filter(c => c.stato_precompilato)
      .map(c => ({
        tipo_obbligo: c.tipo_obbligo,
        stato_dichiarato: c.stato_precompilato!,
        stato_precompilato: c.stato_precompilato,
      }))
  }

  return f
}

// =================================================================
// HOOK STATO PRINCIPALE
// =================================================================

function useFabbisognoForm(token: string) {
  const [data, setData] = useState<ApiData | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [step, setStepInternal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Caricamento iniziale
  useEffect(() => {
    let cancelled = false
    fetch(`/api/fabbisogno/${token}`)
      .then(async (r) => {
        const j = await r.json()
        if (cancelled) return
        if (!j.success) {
          setError(j.error || 'Errore di caricamento')
          return
        }
        setData(j.data)
        setForm(buildInitialForm(j.data))
        if (j.data.rilevazione.stato === 'COMPLETATA') {
          setSubmitted(true)
        }
        const s = j.data.rilevazione.ultimo_step_visitato || 0
        setStepInternal(Math.max(0, Math.min(TOTAL_STEPS - 1, s)))
      })
      .catch(() => {
        if (!cancelled) setError('Errore di rete')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [token])

  // Autosave debounce 1.5s
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isDirty = useRef(false)

  const autosave = useCallback(async (): Promise<boolean> => {
    if (submitted || !data) return true
    setSaving(true)
    try {
      const body: Record<string, unknown> = { ...form, ultimo_step_visitato: step }
      // Trasforma '' in null per i numeric
      for (const k of ['numero_dipendenti_dichiarato', 'livello_competenze_attuali', 'strategicita_formazione'] as const) {
        if (body[k] === '') body[k] = null
      }
      const res = await fetch(`/api/fabbisogno/${token}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const j = await res.json().catch(() => ({ success: false, error: 'Risposta non valida dal server' }))
      if (j.success) {
        setSavedAt(new Date())
        setSaveError(null)
        isDirty.current = false
        return true
      }
      setSaveError(j.error || 'Errore di salvataggio sconosciuto')
      return false
    } catch (e) {
      console.error('autosave error', e)
      setSaveError('Errore di rete: controlla la connessione e riprova')
      return false
    } finally {
      setSaving(false)
    }
  }, [token, form, step, submitted, data])

  useEffect(() => {
    if (!data || submitted) return
    isDirty.current = true
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => { autosave() }, 1500)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form])

  const goToStep = useCallback((n: number) => {
    if (n < 0 || n >= TOTAL_STEPS) return
    setStepInternal(n)
    // Salva subito il cambio step
    if (data && !submitted) {
      if (saveTimer.current) clearTimeout(saveTimer.current)
      // Forza il salvataggio del nuovo step
      setTimeout(() => autosave(), 0)
    }
    // Scorre in alto
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [data, submitted, autosave])

  const submit = useCallback(async () => {
    setSubmitting(true)
    try {
      // Salva tutto prima. Se l'autosave fallisce, blocca l'invio:
      // il banner mostrera' l'errore e l'utente puo' ritentare.
      const saved = await autosave()
      if (!saved) return
      const res = await fetch(`/api/fabbisogno/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const j = await res.json()
      if (j.success) setSubmitted(true)
      else setError(j.error || 'Errore nell\'invio')
    } catch {
      setError('Errore di rete in invio')
    } finally {
      setSubmitting(false)
    }
  }, [token, autosave])

  return {
    data, form, setForm, step, goToStep,
    loading, error, savedAt, saving, saveError,
    retrySave: autosave,
    submitting, submitted, submit,
  }
}

// =================================================================
// UI HELPERS
// =================================================================

const optBox = "flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer transition-all text-sm text-gray-700 border-gray-200 hover:border-teal-300 hover:bg-teal-50/40"
const optBoxActive = "bg-teal-50 border-teal-500 text-teal-700 font-medium"

function RadioOptions<T extends string>({ value, onChange, options, cols = 2 }: {
  value: T | ''; onChange: (v: T) => void; options: Array<{ v: T; l: string }>; cols?: number
}) {
  const grid = cols === 1 ? 'grid-cols-1' : cols === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-2 md:grid-cols-3'
  return (
    <div className={`grid ${grid} gap-2`}>
      {options.map(o => {
        const active = value === o.v
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            className={`${optBox} ${active ? optBoxActive : ''}`}
          >
            <span className={`w-3.5 h-3.5 rounded-full border ${active ? 'border-teal-600 bg-teal-600 ring-2 ring-white' : 'border-gray-300'}`} />
            <span className="text-left">{o.l}</span>
          </button>
        )
      })}
    </div>
  )
}

function CheckOptions<T extends string>({ value, onChange, options, cols = 2, max }: {
  value: T[]; onChange: (v: T[]) => void; options: Array<{ v: T; l: string }>; cols?: number; max?: number
}) {
  const grid = cols === 1 ? 'grid-cols-1' : cols === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-2 md:grid-cols-3'
  const toggle = (v: T) => {
    if (value.includes(v)) onChange(value.filter(x => x !== v))
    else if (!max || value.length < max) onChange([...value, v])
  }
  return (
    <div className={`grid ${grid} gap-2`}>
      {options.map(o => {
        const active = value.includes(o.v)
        const disabled = !active && max != null && value.length >= max
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => toggle(o.v)}
            disabled={disabled}
            className={`${optBox} ${active ? optBoxActive : ''} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${active ? 'border-teal-600 bg-teal-600' : 'border-gray-300'}`}>
              {active && <CheckCircle className="w-2.5 h-2.5 text-white" />}
            </span>
            <span className="text-left">{o.l}</span>
          </button>
        )
      })}
    </div>
  )
}

function ScaleInput({ value, onChange, leftLabel, rightLabel }: {
  value: number | ''; onChange: (v: number) => void; leftLabel: string; rightLabel: string
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-gray-500 min-w-[5rem]">{leftLabel}</span>
      {[1, 2, 3, 4, 5].map(n => {
        const active = value === n
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`w-12 h-12 rounded-lg border font-semibold transition-all ${active ? 'bg-teal-600 text-white border-teal-600 scale-105' : 'border-gray-200 text-gray-500 hover:border-teal-300'}`}
          >
            {n}
          </button>
        )
      })}
      <span className="text-xs text-gray-500 min-w-[5rem] text-right">{rightLabel}</span>
    </div>
  )
}

function PrefilledBadge() {
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 font-medium inline-flex items-center gap-1">
      <Zap className="w-3 h-3" /> Pre-compilato
    </span>
  )
}

function FieldLabel({ children, required, prefilled }: { children: React.ReactNode; required?: boolean; prefilled?: boolean }) {
  return (
    <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
      <label className="block text-sm font-medium text-gray-700">
        {children} {required && <span className="text-red-500">*</span>}
      </label>
      {prefilled && <PrefilledBadge />}
    </div>
  )
}

const inputCls = "w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"
const inputPrefilled = "w-full text-sm border rounded-lg px-3 py-2 bg-teal-50/40 border-teal-300 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none"

// =================================================================
// SECTION HEADER
// =================================================================

function SectionHeader({ letter, title, subtitle }: { letter: string; title: string; subtitle?: string }) {
  return (
    <header className="px-4 md:px-5 py-3 bg-gradient-to-r from-teal-50 to-white border-b border-gray-200">
      <div className="flex items-center space-x-3">
        <span className="w-7 h-7 rounded-full bg-teal-600 text-white text-sm font-bold flex items-center justify-center">{letter}</span>
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
      </div>
    </header>
  )
}

// =================================================================
// PAGINA PRINCIPALE
// =================================================================

export default function Page() {
  const params = useParams()
  const token = (params?.token as string) || ''
  if (!token) return null
  return <FabbisognoForm token={token} />
}

function FabbisognoForm({ token }: { token: string }) {
  const fb = useFabbisognoForm(token)

  if (fb.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    )
  }

  if (fb.error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white border border-red-200 rounded-xl shadow-sm p-6 max-w-md text-center">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-gray-900">Link non disponibile</h2>
          <p className="text-sm text-gray-600 mt-1">{fb.error}</p>
        </div>
      </div>
    )
  }

  if (fb.submitted) {
    return <ThankYou data={fb.data!} />
  }

  return <FabbisognoLayout fb={fb} />
}

// =================================================================
// LAYOUT (header + sidebar + main + footer)
// =================================================================

interface FbHook {
  data: ApiData | null
  form: FormState
  setForm: React.Dispatch<React.SetStateAction<FormState>>
  step: number
  goToStep: (n: number) => void
  savedAt: Date | null
  saving: boolean
  saveError: string | null
  retrySave: () => Promise<boolean>
  submitting: boolean
  submit: () => Promise<void>
}

function FabbisognoLayout({ fb }: { fb: FbHook }) {
  const [retrying, setRetrying] = useState(false)
  if (!fb.data) return null
  const { data, form, setForm, step, goToStep, savedAt, saving, saveError, retrySave, submitting, submit } = fb
  const pct = Math.round(((step + 1) / TOTAL_STEPS) * 100)
  const handleRetry = async () => {
    setRetrying(true)
    try { await retrySave() } finally { setRetrying(false) }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white pb-24">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold flex-shrink-0">E</div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500 truncate">Rilevazione fabbisogni · {data.rilevazione.anno_riferimento}</p>
                <h1 className="text-sm md:text-base font-semibold text-gray-900 truncate">{data.cliente_precompilato?.denominazione || data.rilevazione.titolo}</h1>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs text-gray-500">{step + 1} / {TOTAL_STEPS}</p>
              <p className="text-sm font-semibold text-teal-700">{pct}%</p>
            </div>
          </div>
          <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-teal-500 rounded-full transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </header>

      {saveError && (
        <div className="sticky top-[72px] z-10 bg-red-50 border-b border-red-200">
          <div className="max-w-5xl mx-auto px-4 md:px-6 py-2.5 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-900">Errore di salvataggio</p>
              <p className="text-xs text-red-700 mt-0.5">
                Le tue ultime modifiche potrebbero non essere state salvate. Riprova o ricarica la pagina prima di inviare.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRetry}
              disabled={retrying || saving}
              className="text-xs px-3 py-1.5 bg-white border border-red-300 text-red-700 hover:bg-red-100 rounded-md font-medium inline-flex items-center gap-1.5 disabled:opacity-60 flex-shrink-0"
            >
              {retrying || saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Riprova</span>
            </button>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 md:px-6 pt-6">
        <div className="flex gap-6">
          {/* Sidebar */}
          <aside className="hidden md:block w-56 flex-shrink-0">
            <div className="sticky top-28 space-y-1 bg-white rounded-xl border border-gray-200 p-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-2 mb-2">Sezioni</p>
              {STEPS.map(s => {
                const isActive = step === s.id
                const isDone = step > s.id
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => goToStep(s.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${isActive ? 'bg-teal-50 text-teal-700 font-semibold' : isDone ? 'text-emerald-600 hover:bg-gray-50' : 'text-gray-500 hover:bg-gray-50'}`}
                  >
                    <span className={`w-5.5 h-5.5 rounded-full text-xs font-bold flex items-center justify-center min-w-[22px] ${isActive ? 'bg-teal-600 text-white' : isDone ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                      {s.letter}
                    </span>
                    <span>{s.label}</span>
                  </button>
                )
              })}
            </div>
          </aside>

          {/* Main */}
          <main className="flex-1 min-w-0 space-y-5">
            {step === 0 && <IntroBox />}
            {step === 0 && <StepA data={data} form={form} setForm={setForm} />}
            {step === 1 && <StepB form={form} setForm={setForm} />}
            {step === 2 && <StepC data={data} form={form} setForm={setForm} />}
            {step === 3 && <StepD form={form} setForm={setForm} />}
            {step === 4 && <StepE form={form} setForm={setForm} />}
            {step === 5 && <StepF form={form} setForm={setForm} />}
            {step === 6 && <StepReview data={data} form={form} goToStep={goToStep} />}
          </main>
        </div>
      </div>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-20">
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2 text-xs flex-shrink-0">
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                <span className="hidden sm:inline text-gray-500">Salvataggio…</span>
              </>
            ) : saveError ? (
              <>
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="hidden sm:inline text-red-700 font-medium">Non salvato</span>
                <span className="sm:hidden text-red-700 font-medium">Errore</span>
              </>
            ) : savedAt ? (
              <>
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="hidden sm:inline text-gray-500">Salvato {savedAt.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="sm:hidden text-gray-500">Salvato</span>
              </>
            ) : (
              <span className="hidden sm:inline text-gray-400">Pronto</span>
            )}
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => goToStep(step - 1)}
              disabled={step === 0}
              className="text-xs px-3 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center space-x-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Indietro</span>
            </button>
            {step === TOTAL_STEPS - 1 ? (
              <button
                type="button"
                onClick={submit}
                disabled={submitting || !!saveError}
                title={saveError ? 'Risolvi prima l\'errore di salvataggio cliccando su Riprova' : undefined}
                className="text-xs px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-md font-medium inline-flex items-center space-x-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Invia il questionario</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => goToStep(step + 1)}
                className="text-xs px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-md font-medium inline-flex items-center space-x-1.5"
              >
                <span>Avanti</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  )
}

function IntroBox() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5 shadow-sm">
      <div className="flex items-start space-x-3">
        <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center flex-shrink-0">
          <Zap className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base md:text-lg font-semibold text-gray-900">Ci aiuti a costruire il vostro Piano Formazione</h2>
          <p className="text-sm text-gray-600 mt-1 leading-relaxed">
            Circa 15 minuti, suddivisi in 6 sezioni più un riepilogo finale. Le risposte sono salvate in automatico:
            può chiudere e riprendere dallo stesso link in qualsiasi momento. Alcuni dati sono già pre-compilati a
            partire dai nostri archivi: le chiediamo di confermarli o correggerli.
          </p>
        </div>
      </div>
    </div>
  )
}

// =================================================================
// STEPS
// =================================================================

function StepCard({ children }: { children: React.ReactNode }) {
  return <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">{children}</section>
}

function StepA({ data, form, setForm }: { data: ApiData; form: FormState; setForm: (f: FormState) => void }) {
  const cp = data.cliente_precompilato
  const set = (patch: Partial<FormState>) => setForm({ ...form, ...patch })
  const tot = form.popolazione.reduce((acc, p) => acc + (p.numero_dipendenti || 0), 0)

  return (
    <StepCard>
      <SectionHeader letter="A" title="Anagrafica referente e contesto aziendale" subtitle="9 domande · alcuni campi pre-compilati" />
      <div className="p-4 md:p-5 space-y-5">
        <div>
          <FieldLabel>A1. Nome e cognome del referente <span className="text-gray-400 font-normal">(facoltativo)</span></FieldLabel>
          <input type="text" value={form.referente_nome} onChange={e => set({ referente_nome: e.target.value })} className={inputCls} placeholder="Es. Mario Rossi" />
        </div>

        <div>
          <FieldLabel required>A2. Ruolo / funzione ricoperta</FieldLabel>
          <RadioOptions value={form.referente_ruolo as any} onChange={v => set({ referente_ruolo: v })} options={RUOLI} />
        </div>

        <div>
          <FieldLabel required prefilled={!!cp?.ateco}>A3. Settore / attività e codice ATECO</FieldLabel>
          <input type="text" value={form.ateco_dichiarato} onChange={e => set({ ateco_dichiarato: e.target.value })} className={cp?.ateco ? inputPrefilled : inputCls} />
          <p className="text-xs text-gray-500 mt-1">Confermi o corregga se non è aggiornato.</p>
        </div>

        <div>
          <FieldLabel required prefilled={!!cp?.ccnl}>A4. CCNL applicato</FieldLabel>
          <input type="text" value={form.ccnl_dichiarato} onChange={e => set({ ccnl_dichiarato: e.target.value })} className={cp?.ccnl ? inputPrefilled : inputCls} placeholder="Es. Metalmeccanica industria" />
        </div>

        <div>
          <FieldLabel required prefilled={!!cp?.numero_dipendenti}>A5. Numero dipendenti totali</FieldLabel>
          <input type="number" value={form.numero_dipendenti_dichiarato} onChange={e => set({ numero_dipendenti_dichiarato: e.target.value === '' ? '' : parseInt(e.target.value, 10) })} className={`w-32 ${cp?.numero_dipendenti ? inputPrefilled : inputCls}`} />
        </div>

        <div>
          <FieldLabel required>A6. Mappatura popolazione aziendale</FieldLabel>
          <p className="text-xs text-gray-500 mb-2">Suddivisione numerica per dipartimento. Il totale viene calcolato automaticamente.</p>
          <div className="border border-gray-200 rounded-lg overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                <tr><th className="px-3 py-2 text-left font-medium">Area</th><th className="px-3 py-2 text-left font-medium w-24">N.</th><th className="px-3 py-2 text-left font-medium">Note</th><th className="w-10"></th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {form.popolazione.map((p, idx) => (
                  <tr key={idx}>
                    <td className="px-2"><input type="text" value={p.area} onChange={e => { const np = [...form.popolazione]; np[idx] = { ...p, area: e.target.value }; set({ popolazione: np }) }} className="w-full border-0 px-2 py-1.5 text-sm focus:ring-1 focus:ring-teal-500 rounded" placeholder="Es. Produzione" /></td>
                    <td className="px-2"><input type="number" value={p.numero_dipendenti ?? ''} onChange={e => { const np = [...form.popolazione]; np[idx] = { ...p, numero_dipendenti: e.target.value === '' ? null : parseInt(e.target.value, 10) }; set({ popolazione: np }) }} className="w-20 border-0 px-2 py-1.5 text-sm focus:ring-1 focus:ring-teal-500 rounded" /></td>
                    <td className="px-2"><input type="text" value={p.note ?? ''} onChange={e => { const np = [...form.popolazione]; np[idx] = { ...p, note: e.target.value || null }; set({ popolazione: np }) }} className="w-full border-0 px-2 py-1.5 text-sm focus:ring-1 focus:ring-teal-500 rounded" placeholder="opzionale" /></td>
                    <td><button type="button" onClick={() => { const np = form.popolazione.filter((_, i) => i !== idx); set({ popolazione: np }) }} className="text-gray-400 hover:text-red-500 px-2"><Trash2 className="w-3.5 h-3.5" /></button></td>
                  </tr>
                ))}
                <tr className="bg-gray-50">
                  <td className="px-3 py-1.5 font-medium text-gray-900">TOTALE</td>
                  <td colSpan={3} className="px-3 py-1.5 font-semibold text-teal-700">{tot} dipendenti</td>
                </tr>
              </tbody>
            </table>
          </div>
          <button type="button" onClick={() => set({ popolazione: [...form.popolazione, { area: '', numero_dipendenti: null, note: null, ordine: form.popolazione.length }] })} className="mt-2 text-xs text-teal-700 font-medium hover:underline inline-flex items-center"><Plus className="w-3 h-3 mr-1" /> Aggiungi area</button>
        </div>

        <div>
          <FieldLabel>A7. Inserimenti previsti nei prossimi 6-12 mesi</FieldLabel>
          <p className="text-xs text-gray-500 mb-2">Aggiunga una riga per ogni assunzione pianificata.</p>
          {form.inserimenti_previsti.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-x-auto">
              <table className="w-full text-sm min-w-[480px]">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr><th className="px-3 py-2 text-left font-medium">Area</th><th className="px-3 py-2 text-left font-medium w-20">N.</th><th className="px-3 py-2 text-left font-medium">Periodo</th><th className="w-10"></th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {form.inserimenti_previsti.map((p, idx) => (
                    <tr key={idx}>
                      <td className="px-2"><input type="text" value={p.area} onChange={e => { const np = [...form.inserimenti_previsti]; np[idx] = { ...p, area: e.target.value }; set({ inserimenti_previsti: np }) }} className="w-full border-0 px-2 py-1.5 text-sm focus:ring-1 focus:ring-teal-500 rounded" placeholder="Es. Commerciale" /></td>
                      <td className="px-2"><input type="number" value={p.numero_inserimenti ?? ''} onChange={e => { const np = [...form.inserimenti_previsti]; np[idx] = { ...p, numero_inserimenti: e.target.value === '' ? null : parseInt(e.target.value, 10) }; set({ inserimenti_previsti: np }) }} className="w-20 border-0 px-2 py-1.5 text-sm focus:ring-1 focus:ring-teal-500 rounded" /></td>
                      <td className="px-2"><input type="text" value={p.periodo ?? ''} onChange={e => { const np = [...form.inserimenti_previsti]; np[idx] = { ...p, periodo: e.target.value || null }; set({ inserimenti_previsti: np }) }} className="w-full border-0 px-2 py-1.5 text-sm focus:ring-1 focus:ring-teal-500 rounded" placeholder="Es. Settembre 2026" /></td>
                      <td><button type="button" onClick={() => { const np = form.inserimenti_previsti.filter((_, i) => i !== idx); set({ inserimenti_previsti: np }) }} className="text-gray-400 hover:text-red-500 px-2"><Trash2 className="w-3.5 h-3.5" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <button type="button" onClick={() => set({ inserimenti_previsti: [...form.inserimenti_previsti, { area: '', numero_inserimenti: null, periodo: null, ordine: form.inserimenti_previsti.length }] })} className="mt-2 text-xs text-teal-700 font-medium hover:underline inline-flex items-center"><Plus className="w-3 h-3 mr-1" /> Aggiungi inserimento</button>
        </div>

        <div>
          <FieldLabel required>A8. Per quale popolazione si compila il questionario?</FieldLabel>
          <p className="text-xs text-gray-500 mb-2">Selezione multipla.</p>
          <CheckOptions value={form.popolazione_target as any} onChange={v => set({ popolazione_target: v })} options={POPOLAZIONE_TARGET} />
        </div>

        {form.popolazione_target.includes('FUNZIONE_SPECIFICA') && (
          <div className="border-l-2 border-teal-300 pl-3 ml-1">
            <FieldLabel>A9. Indichi quale funzione/reparto</FieldLabel>
            <input type="text" value={form.popolazione_target_specifica} onChange={e => set({ popolazione_target_specifica: e.target.value })} className={inputCls} placeholder="Es. Produzione, IT…" />
          </div>
        )}
      </div>
    </StepCard>
  )
}

function StepB({ form, setForm }: { form: FormState; setForm: (f: FormState) => void }) {
  const set = (patch: Partial<FormState>) => setForm({ ...form, ...patch })
  return (
    <StepCard>
      <SectionHeader letter="B" title="Contesto e strategia formativa" subtitle="3 domande" />
      <div className="p-4 md:p-5 space-y-5">
        <div>
          <FieldLabel required>B1. L&apos;azienda ha già un piano formazione strutturato?</FieldLabel>
          <RadioOptions value={form.piano_formazione_esistente as any} onChange={v => set({ piano_formazione_esistente: v })} options={PIANO_OPTS} />
        </div>
        <div>
          <FieldLabel>B2. Obiettivi strategici per i prossimi 12 mesi</FieldLabel>
          <p className="text-xs text-gray-500 mb-2">Indichi al massimo 3 priorità.</p>
          <textarea rows={3} value={form.obiettivi_strategici} onChange={e => set({ obiettivi_strategici: e.target.value })} className={inputCls} placeholder="Es. espansione in nuovi mercati, digitalizzazione…" />
        </div>
        <div>
          <FieldLabel>B3. Cambiamenti organizzativi o di mercato previsti</FieldLabel>
          <CheckOptions value={form.cambiamenti_previsti as any} onChange={v => set({ cambiamenti_previsti: v })} options={CAMBIAMENTI} />
        </div>
      </div>
    </StepCard>
  )
}

function StepC({ data, form, setForm }: { data: ApiData; form: FormState; setForm: (f: FormState) => void }) {
  const set = (patch: Partial<FormState>) => setForm({ ...form, ...patch })
  const setObbligo = (cat: CategoriaObbligo, stato: string) => {
    const list = [...form.obblighi_dichiarati]
    const idx = list.findIndex(o => o.tipo_obbligo === cat.tipo_obbligo)
    if (idx >= 0) list[idx] = { ...list[idx], stato_dichiarato: stato }
    else list.push({ tipo_obbligo: cat.tipo_obbligo, stato_dichiarato: stato, stato_precompilato: cat.stato_precompilato })
    set({ obblighi_dichiarati: list })
  }
  const getStato = (cat: CategoriaObbligo) => form.obblighi_dichiarati.find(o => o.tipo_obbligo === cat.tipo_obbligo)?.stato_dichiarato || ''

  return (
    <StepCard>
      <SectionHeader letter="C" title="Formazione obbligatoria" subtitle="Stato dei corsi previsti per legge / CCNL" />
      <div className="p-4 md:p-5 space-y-5">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
          <p className="font-medium">Alcuni stati sono già pre-compilati dai documenti caricati in passato.</p>
          <p className="mt-1">Verifichi e aggiorni se la situazione è cambiata.</p>
        </div>
        <div className="border border-gray-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-gray-50 text-xs text-gray-500"><tr><th className="text-left px-3 py-2 font-medium">Tipologia</th>{STATI_OBBLIGHI.map(s => <th key={s.v} className="px-2 py-2 font-medium text-center">{s.l}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">
              {data.categorie_obblighi_c.map(cat => {
                const cur = getStato(cat)
                const isPrefilled = !!cat.stato_precompilato
                return (
                  <tr key={cat.id} className={isPrefilled ? 'bg-teal-50/30' : ''}>
                    <td className="px-3 py-2">
                      <span className="text-gray-800">{cat.label}</span>
                      {isPrefilled && <div className="mt-0.5"><PrefilledBadge /></div>}
                    </td>
                    {STATI_OBBLIGHI.map(s => (
                      <td key={s.v} className="px-2 py-2 text-center">
                        <input type="radio" name={`obb-${cat.id}`} checked={cur === s.v} onChange={() => setObbligo(cat, s.v)} className="accent-teal-600 w-4 h-4 cursor-pointer" />
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div>
          <FieldLabel>C2. Scadenze imminenti (entro 6 mesi) per corsi obbligatori?</FieldLabel>
          <RadioOptions value={form.scadenze_imminenti as any} onChange={v => set({ scadenze_imminenti: v })} options={SCADENZE_IMMINENTI} cols={3} />
        </div>
        <div>
          <FieldLabel>C3. Altri obblighi formativi specifici di settore</FieldLabel>
          <input type="text" value={form.altri_obblighi_settore} onChange={e => set({ altri_obblighi_settore: e.target.value })} className={inputCls} placeholder="Es. HACCP, patentini, abilitazioni…" />
        </div>
      </div>
    </StepCard>
  )
}

function StepD({ form, setForm }: { form: FormState; setForm: (f: FormState) => void }) {
  const set = (patch: Partial<FormState>) => setForm({ ...form, ...patch })
  return (
    <StepCard>
      <SectionHeader letter="D" title="Fabbisogni formativi non obbligatori" subtitle="Aree di sviluppo competenze" />
      <div className="p-4 md:p-5 space-y-5">
        <div>
          <FieldLabel required>D1. Aree di gap competenza</FieldLabel>
          <p className="text-xs text-gray-500 mb-2">Selezioni al massimo 5 opzioni.</p>
          <CheckOptions value={form.aree_gap_competenze as any} onChange={v => set({ aree_gap_competenze: v })} options={AREE_GAP} max={5} />
        </div>
        <div>
          <FieldLabel>D2. Altri fabbisogni non elencati</FieldLabel>
          <textarea rows={2} value={form.altri_fabbisogni} onChange={e => set({ altri_fabbisogni: e.target.value })} className={inputCls} />
        </div>
        <div>
          <FieldLabel required>D3. Livello competenza attuale del personale nelle aree critiche</FieldLabel>
          <ScaleInput value={form.livello_competenze_attuali} onChange={v => set({ livello_competenze_attuali: v })} leftLabel="Molto basso" rightLabel="Molto alto" />
        </div>
        <div>
          <FieldLabel required>D4. Figure professionali prioritarie</FieldLabel>
          <CheckOptions value={form.figure_prioritarie as any} onChange={v => set({ figure_prioritarie: v })} options={FIGURE_PRIORITARIE} />
        </div>
      </div>
    </StepCard>
  )
}

function StepE({ form, setForm }: { form: FormState; setForm: (f: FormState) => void }) {
  const set = (patch: Partial<FormState>) => setForm({ ...form, ...patch })
  return (
    <StepCard>
      <SectionHeader letter="E" title="Modalità, budget e vincoli" />
      <div className="p-4 md:p-5 space-y-5">
        <div>
          <FieldLabel required>E1. Modalità di erogazione compatibili</FieldLabel>
          <CheckOptions value={form.modalita_erogazione as any} onChange={v => set({ modalita_erogazione: v })} options={MODALITA} />
        </div>
        <div>
          <FieldLabel>E2. Budget annuo indicativo (formazione non obbligatoria)</FieldLabel>
          <RadioOptions value={form.budget_annuo as any} onChange={v => set({ budget_annuo: v })} options={BUDGET} cols={3} />
        </div>
        <div>
          <FieldLabel>E3. Vincoli organizzativi alla formazione</FieldLabel>
          <CheckOptions value={form.vincoli_organizzativi as any} onChange={v => set({ vincoli_organizzativi: v })} options={VINCOLI} />
        </div>
        <div>
          <FieldLabel>E4. Picchi di operatività (mesi da evitare)</FieldLabel>
          <div className="grid grid-cols-4 md:grid-cols-6 gap-1.5">
            {MESI.map((m, i) => {
              const month = i + 1
              const active = form.picchi_operativita.includes(month)
              return (
                <button key={month} type="button" onClick={() => set({ picchi_operativita: active ? form.picchi_operativita.filter(x => x !== month) : [...form.picchi_operativita, month].sort((a, b) => a - b) })} className={`${optBox} justify-center text-xs ${active ? optBoxActive : ''}`}>
                  <span>{m}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </StepCard>
  )
}

function StepF({ form, setForm }: { form: FormState; setForm: (f: FormState) => void }) {
  const set = (patch: Partial<FormState>) => setForm({ ...form, ...patch })
  return (
    <StepCard>
      <SectionHeader letter="F" title="Valutazione e priorità" />
      <div className="p-4 md:p-5 space-y-5">
        <div>
          <FieldLabel required>F1. Orizzonte temporale di intervento</FieldLabel>
          <RadioOptions value={form.orizzonte_temporale as any} onChange={v => set({ orizzonte_temporale: v })} options={ORIZZONTE} />
        </div>
        <div>
          <FieldLabel required>F2. Strategicità della formazione per gli obiettivi aziendali</FieldLabel>
          <ScaleInput value={form.strategicita_formazione} onChange={v => set({ strategicita_formazione: v })} leftLabel="Per nulla" rightLabel="Assolutamente" />
        </div>
        <div>
          <FieldLabel>F3. Misurazione dell&apos;efficacia della formazione</FieldLabel>
          <CheckOptions value={form.misurazione_efficacia as any} onChange={v => set({ misurazione_efficacia: v })} options={MISURAZIONE} />
        </div>
        <div>
          <FieldLabel>F4. Note libere</FieldLabel>
          <textarea rows={3} value={form.note_libere} onChange={e => set({ note_libere: e.target.value })} className={inputCls} />
        </div>
      </div>
    </StepCard>
  )
}

function StepReview({ data, form, goToStep }: { data: ApiData; form: FormState; goToStep: (n: number) => void }) {
  const lookup = (opts: Array<{v: string; l: string}>, v: string) => opts.find(o => o.v === v)?.l || v
  const lookupArr = (opts: Array<{v: string; l: string}>, vs: string[]) => vs.map(v => lookup(opts, v)).join(' · ')
  return (
    <StepCard>
      <SectionHeader letter="✓" title="Riepilogo prima dell'invio" subtitle="Verifichi le risposte e clicchi su Modifica per correggere" />
      <div className="p-4 md:p-5 space-y-3">

        <ReviewCard letter="A" title="Anagrafica e contesto" onEdit={() => goToStep(0)}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <ReviewField label="Referente" value={form.referente_nome ? `${form.referente_nome}${form.referente_ruolo ? ' · ' + lookup(RUOLI, form.referente_ruolo) : ''}` : '—'} />
            <ReviewField label="ATECO" value={form.ateco_dichiarato || '—'} />
            <ReviewField label="CCNL" value={form.ccnl_dichiarato || '—'} />
            <ReviewField label="Dipendenti" value={form.numero_dipendenti_dichiarato.toString() || '—'} />
            <ReviewField label="Compila per" value={form.popolazione_target.length ? lookupArr(POPOLAZIONE_TARGET, form.popolazione_target) : '—'} />
            {form.popolazione.length > 0 && (
              <ReviewField label="Popolazione mappata" value={form.popolazione.map(p => `${p.area} (${p.numero_dipendenti ?? '?'})`).join(' · ')} />
            )}
            {form.inserimenti_previsti.length > 0 && (
              <ReviewField label="Inserimenti previsti" value={form.inserimenti_previsti.map(i => `${i.area} ${i.numero_inserimenti ?? '?'}${i.periodo ? ' (' + i.periodo + ')' : ''}`).join(' · ')} />
            )}
          </div>
        </ReviewCard>

        <ReviewCard letter="B" title="Strategia formativa" onEdit={() => goToStep(1)}>
          <div className="space-y-2 text-sm">
            <ReviewField label="Piano esistente" value={lookup(PIANO_OPTS, form.piano_formazione_esistente) || '—'} />
            <ReviewField label="Obiettivi 12 mesi" value={form.obiettivi_strategici || '—'} />
            <ReviewField label="Cambiamenti previsti" value={form.cambiamenti_previsti.length ? lookupArr(CAMBIAMENTI, form.cambiamenti_previsti) : '—'} />
          </div>
        </ReviewCard>

        <ReviewCard letter="C" title="Formazione obbligatoria" onEdit={() => goToStep(2)}>
          <div className="space-y-1 text-sm">
            {form.obblighi_dichiarati.length === 0 ? (
              <p className="text-gray-500">Nessuno stato dichiarato</p>
            ) : (
              form.obblighi_dichiarati.map(o => {
                const cat = data.categorie_obblighi_c.find(c => c.tipo_obbligo === o.tipo_obbligo)
                return (
                  <div key={o.tipo_obbligo} className="flex items-center justify-between">
                    <span className="text-gray-700">{cat?.label || o.tipo_obbligo}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700">{lookup(STATI_OBBLIGHI, o.stato_dichiarato)}</span>
                  </div>
                )
              })
            )}
          </div>
        </ReviewCard>

        <ReviewCard letter="D" title="Fabbisogni non obbligatori" onEdit={() => goToStep(3)}>
          <div className="space-y-2 text-sm">
            <ReviewField label="Aree di gap" value={form.aree_gap_competenze.length ? lookupArr(AREE_GAP, form.aree_gap_competenze) : '—'} />
            <ReviewField label="Livello attuale" value={form.livello_competenze_attuali ? `${form.livello_competenze_attuali}/5` : '—'} />
            <ReviewField label="Figure prioritarie" value={form.figure_prioritarie.length ? lookupArr(FIGURE_PRIORITARIE, form.figure_prioritarie) : '—'} />
          </div>
        </ReviewCard>

        <ReviewCard letter="E" title="Modalità e budget" onEdit={() => goToStep(4)}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <ReviewField label="Modalità" value={form.modalita_erogazione.length ? lookupArr(MODALITA, form.modalita_erogazione) : '—'} />
            <ReviewField label="Budget" value={lookup(BUDGET, form.budget_annuo) || '—'} />
            <ReviewField label="Vincoli" value={form.vincoli_organizzativi.length ? lookupArr(VINCOLI, form.vincoli_organizzativi) : '—'} />
            <ReviewField label="Picchi" value={form.picchi_operativita.length ? form.picchi_operativita.map(m => MESI[m - 1]).join(' · ') : '—'} />
          </div>
        </ReviewCard>

        <ReviewCard letter="F" title="Priorità e valutazione" onEdit={() => goToStep(5)}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <ReviewField label="Orizzonte" value={lookup(ORIZZONTE, form.orizzonte_temporale) || '—'} />
            <ReviewField label="Strategicità" value={form.strategicita_formazione ? `${form.strategicita_formazione}/5` : '—'} />
            <ReviewField label="Misurazione" value={form.misurazione_efficacia.length ? lookupArr(MISURAZIONE, form.misurazione_efficacia) : '—'} />
            {form.note_libere && <ReviewField label="Note" value={form.note_libere} />}
          </div>
        </ReviewCard>

        <div className="bg-gradient-to-br from-teal-50 to-blue-50 border border-teal-200 rounded-lg p-4 mt-4">
          <div className="flex items-start space-x-3">
            <CheckCircle className="w-5 h-5 text-teal-700 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-gray-800">
              <p className="font-medium">Pronto per l&apos;invio?</p>
              <p className="mt-1">Una volta inviato, riceverà via email una conferma. Il consulente prenderà in carico la richiesta entro 2 giorni lavorativi.</p>
            </div>
          </div>
        </div>
      </div>
    </StepCard>
  )
}

function ReviewCard({ letter, title, onEdit, children }: { letter: string; title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="w-5 h-5 rounded-full bg-teal-600 text-white text-xs font-bold flex items-center justify-center">{letter}</span>
          <span className="text-sm font-medium text-gray-900">{title}</span>
        </div>
        <button type="button" onClick={onEdit} className="text-xs text-teal-700 font-medium hover:underline">Modifica</button>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function ReviewField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm text-gray-900">{value}</p>
    </div>
  )
}

// =================================================================
// THANK YOU
// =================================================================

function ThankYou({ data }: { data: ApiData }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-50 to-white p-6">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-8 max-w-lg w-full text-center">
        <div className="w-16 h-16 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Grazie!</h1>
        <p className="text-sm text-gray-600 mt-2 leading-relaxed">
          Il questionario è stato inviato correttamente.
          {data.cliente_precompilato && <> Le risposte di <strong>{data.cliente_precompilato.denominazione}</strong> sono ora a disposizione del consulente.</>}
        </p>
        <p className="text-xs text-gray-500 mt-4">Può chiudere questa pagina. Per qualsiasi necessità potrà rispondere direttamente all&apos;email che ha ricevuto.</p>
      </div>
    </div>
  )
}
