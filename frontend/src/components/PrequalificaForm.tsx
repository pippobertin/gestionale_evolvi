'use client'

import { useState, useEffect, useRef } from 'react'
import {
  X,
  Save,
  Phone,
  ClipboardCheck,
  BarChart3,
  Target,
  ChevronDown,
  ChevronUp,
  Star
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  Prospect,
  ProfilingTemplate,
  FONTI_ACQUISIZIONE,
  AREE_INTERESSE,
  NATURE_INTERESSE,
  AFFIDABILITA_OPTIONS,
  POTENZIALI_ECONOMICI,
  TEMPI_DECISIONE_OPTIONS,
  RACCOMANDAZIONI,
  TIPOLOGIE_SOGGETTO,
  PROSPECT_STATI
} from '@/types/prospect'
import { isGruppo2Complete, isGruppo3Complete, isGruppo4Complete } from '@/lib/prospectValidation'
import UnifiedResponsableSelector from './UnifiedResponsableSelector'
import ProfilingCard from './ProfilingCard'

interface PrequalificaFormProps {
  prospect?: Prospect
  isOpen: boolean
  onClose: () => void
  onSave: () => void
  scrollToSection?: number
}

export default function PrequalificaForm({ prospect, isOpen, onClose, onSave, scrollToSection }: PrequalificaFormProps) {
  const [formData, setFormData] = useState<Record<string, any>>({
    // Gruppo 1 — Primo Contatto
    data_contatto: '',
    ricevuto_da: '',
    fonte_acquisizione: '',
    fonte_dettaglio: '',
    referente_nome: '',
    denominazione: '',
    email: '',
    telefono: '',
    // Gruppo 2 — Qualificazione
    tipologia_soggetto: '',
    area_interesse: [],
    natura_interesse: '',
    bisogno_dichiarato: '',
    bisogno_interpretato: '',
    // Gruppo 3 — Valutazione
    affidabilita_percepita: '',
    potenziale_economico: '',
    budget_dichiarato: false,
    tempi_decisione: '',
    note_qualitative: '',
    // Gruppo 4 — Esito
    raccomandazione: '',
    motivazione_raccomandazione: '',
    responsabile_qualificazione: '',
    data_riunione_prevista: '',
    // Profilazione
    profiling_data: {},
  })

  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showValutazione, setShowValutazione] = useState(false)
  const [showEsito, setShowEsito] = useState(false)
  const [showProfilazione, setShowProfilazione] = useState(false)
  const [profilingTemplates, setProfilingTemplates] = useState<ProfilingTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)

  const valutazioneRef = useRef<HTMLDivElement>(null)
  const esitoRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (prospect) {
      setFormData({
        data_contatto: prospect.data_contatto || '',
        ricevuto_da: prospect.ricevuto_da || '',
        fonte_acquisizione: prospect.fonte_acquisizione || '',
        fonte_dettaglio: prospect.fonte_dettaglio || '',
        referente_nome: prospect.referente_nome || '',
        denominazione: prospect.denominazione || '',
        email: prospect.email || '',
        telefono: prospect.telefono || '',
        tipologia_soggetto: prospect.tipologia_soggetto || '',
        area_interesse: prospect.area_interesse ? prospect.area_interesse.split(',') : [],
        natura_interesse: prospect.natura_interesse || '',
        bisogno_dichiarato: prospect.bisogno_dichiarato || '',
        bisogno_interpretato: prospect.bisogno_interpretato || '',
        affidabilita_percepita: prospect.affidabilita_percepita || '',
        potenziale_economico: prospect.potenziale_economico || '',
        budget_dichiarato: prospect.budget_dichiarato || false,
        tempi_decisione: prospect.tempi_decisione || '',
        note_qualitative: prospect.note_qualitative || '',
        raccomandazione: prospect.raccomandazione || '',
        motivazione_raccomandazione: prospect.motivazione_raccomandazione || '',
        responsabile_qualificazione: prospect.responsabile_qualificazione || '',
        data_riunione_prevista: prospect.data_riunione_prevista || '',
        profiling_data: prospect.profiling_data || {},
      })
      // Expand sections if they have data
      const hasValutazione = prospect.affidabilita_percepita || prospect.potenziale_economico || prospect.tempi_decisione
      const hasEsito = prospect.raccomandazione || prospect.responsabile_qualificazione
      const hasProfiling = prospect.profiling_data && Object.keys(prospect.profiling_data).length > 0
      if (hasValutazione) setShowValutazione(true)
      if (hasEsito) setShowEsito(true)
      if (hasProfiling) setShowProfilazione(true)
    } else {
      setFormData({
        data_contatto: new Date().toISOString().split('T')[0],
        ricevuto_da: '',
        fonte_acquisizione: '',
        fonte_dettaglio: '',
        referente_nome: '',
        denominazione: '',
        email: '',
        telefono: '',
        tipologia_soggetto: '',
        area_interesse: [],
        natura_interesse: '',
        bisogno_dichiarato: '',
        bisogno_interpretato: '',
        affidabilita_percepita: '',
        potenziale_economico: '',
        budget_dichiarato: false,
        tempi_decisione: '',
        note_qualitative: '',
        raccomandazione: '',
        motivazione_raccomandazione: '',
        responsabile_qualificazione: '',
        data_riunione_prevista: '',
        profiling_data: {},
      })
      setShowValutazione(false)
      setShowEsito(false)
      setShowProfilazione(false)
    }
    setErrors({})
  }, [prospect, isOpen])

  // Load profiling templates
  useEffect(() => {
    if (isOpen) {
      loadProfilingTemplates()
    }
  }, [isOpen])

  const loadProfilingTemplates = async () => {
    setLoadingTemplates(true)
    try {
      const { data, error } = await supabase
        .from('scadenze_bandi_profiling_template')
        .select('*')
        .eq('attivo', true)
        .order('ordine')
      if (error) throw error
      setProfilingTemplates(data || [])
    } catch (error) {
      console.error('Errore caricamento template profilazione:', error)
    } finally {
      setLoadingTemplates(false)
    }
  }

  // Scroll to section 3 if requested
  useEffect(() => {
    if (isOpen && scrollToSection === 3 && contentRef.current) {
      setShowValutazione(true)
      setShowEsito(true)
      setTimeout(() => {
        valutazioneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [isOpen, scrollToSection])

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
  }

  const handleProfilingChange = (values: Record<string, any>) => {
    setFormData(prev => ({ ...prev, profiling_data: values }))
  }

  // Calculate profiling score as percentage 0-100
  // Uses same normalization logic as ProfilingCard, keyed by template.id
  const calculateProfilingScore = (): number => {
    if (!profilingTemplates.length || !formData.profiling_data) return 0
    let score = 0
    let maxScore = 0

    for (const template of profilingTemplates) {
      if (template.peso <= 0) continue
      maxScore += template.peso

      const value = formData.profiling_data[template.id]
      if (value === undefined || value === null || value === '') continue

      let normalizedValue = 0
      switch (template.tipo) {
        case 'rating':
          normalizedValue = (typeof value === 'number' ? value : parseInt(value) || 0) / 5
          break
        case 'boolean':
          normalizedValue = value === true || value === 'true' ? 1 : 0
          break
        case 'number':
          normalizedValue = Math.min((typeof value === 'number' ? value : parseFloat(value) || 0) / 100, 1)
          break
        case 'select':
          if (template.opzioni && template.opzioni.length > 0) {
            const idx = template.opzioni.indexOf(value)
            if (idx >= 0) {
              normalizedValue = template.punteggi?.length > idx
                ? template.punteggi[idx]
                : (idx + 1) / template.opzioni.length
            }
          }
          break
        case 'multiselect':
          if (Array.isArray(value) && template.opzioni && template.opzioni.length > 0) {
            normalizedValue = value.length / template.opzioni.length
          }
          break
        case 'text':
        case 'textarea':
          normalizedValue = value && String(value).trim().length > 0 ? 1 : 0
          break
      }

      score += template.peso * normalizedValue
    }

    return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.denominazione?.trim()) {
      newErrors.denominazione = 'Denominazione obbligatoria'
    }

    // Gruppo 2: warn if partially filled (all-or-nothing)
    const g2Fields = [formData.tipologia_soggetto, formData.area_interesse?.length > 0, formData.natura_interesse, formData.bisogno_dichiarato?.trim(), formData.bisogno_interpretato?.trim()]
    const g2Filled = g2Fields.filter(Boolean).length
    if (g2Filled > 0 && g2Filled < 5) {
      if (!formData.tipologia_soggetto) newErrors.tipologia_soggetto = 'Completa la qualificazione'
      if (!formData.area_interesse || formData.area_interesse.length === 0) newErrors.area_interesse = 'Completa la qualificazione'
      if (!formData.natura_interesse) newErrors.natura_interesse = 'Completa la qualificazione'
      if (!formData.bisogno_dichiarato?.trim()) newErrors.bisogno_dichiarato = 'Completa la qualificazione'
      if (!formData.bisogno_interpretato?.trim()) newErrors.bisogno_interpretato = 'Completa la qualificazione'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return

    setSaving(true)
    try {
      // Save ONLY data, never touch stato
      const profilingScore = calculateProfilingScore()
      const dataToSave: Record<string, any> = {
        denominazione: formData.denominazione.trim(),
        email: formData.email || null,
        telefono: formData.telefono || null,
        fonte_acquisizione: formData.fonte_acquisizione || null,
        fonte_dettaglio: formData.fonte_dettaglio || null,
        data_contatto: formData.data_contatto || null,
        ricevuto_da: formData.ricevuto_da || null,
        referente_nome: formData.referente_nome || null,
        tipologia_soggetto: formData.tipologia_soggetto || null,
        area_interesse: formData.area_interesse?.length > 0 ? formData.area_interesse.join(',') : null,
        natura_interesse: formData.natura_interesse || null,
        bisogno_dichiarato: formData.bisogno_dichiarato || null,
        bisogno_interpretato: formData.bisogno_interpretato || null,
        affidabilita_percepita: formData.affidabilita_percepita || null,
        potenziale_economico: formData.potenziale_economico || null,
        budget_dichiarato: formData.budget_dichiarato || false,
        tempi_decisione: formData.tempi_decisione || null,
        note_qualitative: formData.note_qualitative || null,
        raccomandazione: formData.raccomandazione || null,
        motivazione_raccomandazione: formData.motivazione_raccomandazione || null,
        responsabile_qualificazione: formData.responsabile_qualificazione || null,
        data_riunione_prevista: formData.data_riunione_prevista || null,
        profiling_data: formData.profiling_data || {},
        profiling_score: profilingScore,
      }

      if (prospect?.id) {
        const { error } = await supabase
          .from('scadenze_bandi_prospect')
          .update(dataToSave)
          .eq('id', prospect.id)

        if (error) throw error
      } else {
        dataToSave.stato = 'bozza'
        dataToSave.profiling_data = formData.profiling_data || {}
        dataToSave.profiling_score = profilingScore
        const { error } = await supabase
          .from('scadenze_bandi_prospect')
          .insert([dataToSave])

        if (error) throw error
      }

      // Create/update scadenza in scadenziario if data_riunione_prevista is set
      if (formData.data_riunione_prevista && formData.responsabile_qualificazione) {
        const isNewRiunione = !prospect?.data_riunione_prevista || prospect.data_riunione_prevista !== formData.data_riunione_prevista
        if (isNewRiunione) {
          if (prospect?.id) {
            await supabase
              .from('scadenze_bandi_scadenze_contrattuali')
              .delete()
              .eq('entity_type', 'GENERALE')
              .eq('categoria', 'riunione_prospect')
              .eq('entity_id', prospect.id)
              .in('stato', ['APERTA', 'IN_CORSO'])
          }

          let prospectId = prospect?.id
          if (!prospectId) {
            const { data: newProspect } = await supabase
              .from('scadenze_bandi_prospect')
              .select('id')
              .eq('denominazione', formData.denominazione.trim())
              .order('created_at', { ascending: false })
              .limit(1)
              .single()
            prospectId = newProspect?.id
          }

          const scadenzaPayload = {
            entity_type: 'GENERALE',
            entity_id: prospectId || null,
            titolo: `Riunione qualifica: ${formData.denominazione.trim()}`,
            descrizione: `Riunione decisionale per il prospect ${formData.denominazione.trim()}${formData.raccomandazione ? ' - Raccomandazione: ' + formData.raccomandazione : ''}`,
            tipo_scadenza: 'AMMINISTRATIVA',
            categoria: 'riunione_prospect',
            data_scadenza: formData.data_riunione_prevista,
            priorita: 'ALTA',
            responsabile_email: formData.responsabile_qualificazione,
            notifiche_attive: true,
            notifica_giorni_prima: [7, 3, 1],
            tags: ['prospect', 'riunione'],
            created_by: formData.ricevuto_da || 'system'
          }
          const { error: scadenzaError } = await supabase
            .from('scadenze_bandi_scadenze_contrattuali')
            .insert([scadenzaPayload])
          if (scadenzaError) {
            console.error('Errore creazione scadenza riunione:', scadenzaError)
          }
        }
      }

      onSave()
      onClose()
    } catch (error: any) {
      console.error('Errore nel salvataggio:', error)
      const msg = error?.message || error?.details || JSON.stringify(error)
      alert('Errore nel salvataggio: ' + msg)
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const g2Complete = isGruppo2Complete(formData)
  const g3Complete = isGruppo3Complete(formData)
  const g4Complete = isGruppo4Complete(formData)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-hard max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="gradient-primary text-white p-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-3">
            <ClipboardCheck className="w-5 h-5" />
            <div>
              <h2 className="text-sm font-semibold">
                {prospect ? 'Modifica Prequalifica' : 'Nuova Prequalifica Prospect'}
              </h2>
              <p className="text-xs text-white/70 mt-0.5">
                Compila i campi di qualificazione. Il salvataggio non modifica lo stato.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div ref={contentRef} className="p-4 overflow-y-auto flex-1 space-y-6">

          {/* SEZIONE 1 — Primo Contatto */}
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <Phone className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-gray-900">1. Primo Contatto</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Data contatto</label>
                <input
                  type="date"
                  value={formData.data_contatto}
                  onChange={(e) => handleInputChange('data_contatto', e.target.value)}
                  className="input text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Ricevuto da</label>
                <UnifiedResponsableSelector
                  variant="simple"
                  value={formData.ricevuto_da}
                  onChange={(val) => handleInputChange('ricevuto_da', val)}
                  placeholder="Chi ha ricevuto il contatto"
                  showTutti={false}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Canale di ingresso</label>
                <select
                  value={formData.fonte_acquisizione}
                  onChange={(e) => {
                    handleInputChange('fonte_acquisizione', e.target.value)
                    if (!e.target.value) handleInputChange('fonte_dettaglio', '')
                  }}
                  className="input text-sm"
                >
                  <option value="">Seleziona canale</option>
                  {FONTI_ACQUISIZIONE.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
                {formData.fonte_acquisizione && (
                  <input
                    type="text"
                    value={formData.fonte_dettaglio}
                    onChange={(e) => handleInputChange('fonte_dettaglio', e.target.value)}
                    className="input text-sm mt-1.5"
                    placeholder={
                      formData.fonte_acquisizione === 'referral' ? 'Chi ha segnalato?' :
                      formData.fonte_acquisizione === 'evento' ? 'Quale evento/fiera?' :
                      formData.fonte_acquisizione === 'linkedin' ? 'Profilo/post di riferimento' :
                      'Dettaglio fonte...'
                    }
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Referente (persona di contatto)</label>
                <input
                  type="text"
                  value={formData.referente_nome}
                  onChange={(e) => handleInputChange('referente_nome', e.target.value)}
                  className="input text-sm"
                  placeholder="Nome e cognome del referente"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Organizzazione *
                </label>
                <input
                  type="text"
                  value={formData.denominazione}
                  onChange={(e) => handleInputChange('denominazione', e.target.value)}
                  className={`input text-sm ${errors.denominazione ? 'border-red-500' : ''}`}
                  placeholder="Ragione sociale"
                />
                {errors.denominazione && (
                  <p className="text-xs text-red-600 mt-0.5">{errors.denominazione}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="input text-sm"
                  placeholder="info@organizzazione.it"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Telefono</label>
                <input
                  type="tel"
                  value={formData.telefono}
                  onChange={(e) => handleInputChange('telefono', e.target.value)}
                  className="input text-sm"
                  placeholder="+39 06 12345678"
                />
              </div>
            </div>
          </div>

          {/* SEZIONE 2 — Qualificazione (obbligatoria) */}
          <div className="border-t pt-4">
            <div className="flex items-center space-x-2 mb-3">
              <ClipboardCheck className="w-4 h-4 text-orange-600" />
              <h3 className="text-sm font-semibold text-gray-900">2. Qualificazione</h3>
              <span className="text-xs text-red-600 font-medium">* obbligatoria</span>
              {g2Complete && (
                <span className="ml-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-700">Completo</span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tipologia soggetto *</label>
                <select
                  value={formData.tipologia_soggetto}
                  onChange={(e) => handleInputChange('tipologia_soggetto', e.target.value)}
                  className={`input text-sm ${errors.tipologia_soggetto ? 'border-red-500' : ''}`}
                >
                  <option value="">Seleziona...</option>
                  {TIPOLOGIE_SOGGETTO.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                {errors.tipologia_soggetto && (
                  <p className="text-xs text-red-600 mt-0.5">{errors.tipologia_soggetto}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Area di interesse *</label>
                <div className={`space-y-1.5 p-2 border rounded-md ${errors.area_interesse ? 'border-red-500' : 'border-gray-300'}`}>
                  {AREE_INTERESSE.map((a) => (
                    <label key={a.value} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(formData.area_interesse || []).includes(a.value)}
                        onChange={(e) => {
                          const current: string[] = formData.area_interesse || []
                          const next = e.target.checked
                            ? [...current, a.value]
                            : current.filter((v: string) => v !== a.value)
                          handleInputChange('area_interesse', next)
                        }}
                        className="h-3.5 w-3.5 text-blue-600 rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700">{a.label}</span>
                    </label>
                  ))}
                </div>
                {errors.area_interesse && (
                  <p className="text-xs text-red-600 mt-0.5">{errors.area_interesse}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Natura interesse *</label>
                <select
                  value={formData.natura_interesse}
                  onChange={(e) => handleInputChange('natura_interesse', e.target.value)}
                  className={`input text-sm ${errors.natura_interesse ? 'border-red-500' : ''}`}
                >
                  <option value="">Seleziona...</option>
                  {NATURE_INTERESSE.map((n) => (
                    <option key={n.value} value={n.value}>{n.label}</option>
                  ))}
                </select>
                {errors.natura_interesse && (
                  <p className="text-xs text-red-600 mt-0.5">{errors.natura_interesse}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Bisogno dichiarato *</label>
                <textarea
                  value={formData.bisogno_dichiarato}
                  onChange={(e) => handleInputChange('bisogno_dichiarato', e.target.value)}
                  className={`input text-sm min-h-[80px] ${errors.bisogno_dichiarato ? 'border-red-500' : ''}`}
                  rows={3}
                  placeholder="Cosa dice il prospect — cosa chiede, di cosa ha bisogno"
                />
                {errors.bisogno_dichiarato && (
                  <p className="text-xs text-red-600 mt-0.5">{errors.bisogno_dichiarato}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Bisogno interpretato *</label>
                <textarea
                  value={formData.bisogno_interpretato}
                  onChange={(e) => handleInputChange('bisogno_interpretato', e.target.value)}
                  className={`input text-sm min-h-[80px] ${errors.bisogno_interpretato ? 'border-red-500' : ''}`}
                  rows={3}
                  placeholder="Cosa interpretiamo noi — il bisogno reale sotto la richiesta"
                />
                {errors.bisogno_interpretato && (
                  <p className="text-xs text-red-600 mt-0.5">{errors.bisogno_interpretato}</p>
                )}
              </div>
            </div>
          </div>

          {/* SEZIONE 3 — Valutazione (collapsible) */}
          <div ref={valutazioneRef} className="border-t pt-4">
            <button
              onClick={() => setShowValutazione(!showValutazione)}
              className="flex items-center space-x-2 w-full text-left"
            >
              <BarChart3 className="w-4 h-4 text-cyan-600" />
              <h3 className="text-sm font-semibold text-gray-900">3. Valutazione</h3>
              <span className="text-xs text-gray-500">(opzionale)</span>
              {g3Complete && (
                <span className="ml-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-700">Completo</span>
              )}
              <div className="flex-1" />
              {showValutazione ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </button>

            {showValutazione && (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Affidabilita percepita</label>
                    <select
                      value={formData.affidabilita_percepita}
                      onChange={(e) => handleInputChange('affidabilita_percepita', e.target.value)}
                      className="input text-sm"
                    >
                      <option value="">Seleziona...</option>
                      {AFFIDABILITA_OPTIONS.map((a) => (
                        <option key={a.value} value={a.value}>{a.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Potenziale economico</label>
                    <select
                      value={formData.potenziale_economico}
                      onChange={(e) => handleInputChange('potenziale_economico', e.target.value)}
                      className="input text-sm"
                    >
                      <option value="">Seleziona...</option>
                      {POTENZIALI_ECONOMICI.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Tempi decisione</label>
                    <select
                      value={formData.tempi_decisione}
                      onChange={(e) => handleInputChange('tempi_decisione', e.target.value)}
                      className="input text-sm"
                    >
                      <option value="">Seleziona...</option>
                      {TEMPI_DECISIONE_OPTIONS.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-center space-x-3 py-2">
                    <input
                      type="checkbox"
                      id="budget_dichiarato"
                      checked={formData.budget_dichiarato}
                      onChange={(e) => handleInputChange('budget_dichiarato', e.target.checked)}
                      className="h-4 w-4 text-blue-600 rounded border-gray-300"
                    />
                    <label htmlFor="budget_dichiarato" className="text-sm text-gray-700">
                      Budget dichiarato dal prospect
                    </label>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Note qualitative</label>
                    <textarea
                      value={formData.note_qualitative}
                      onChange={(e) => handleInputChange('note_qualitative', e.target.value)}
                      className="input text-sm min-h-[60px]"
                      rows={2}
                      placeholder="Osservazioni libere sulla qualita del contatto..."
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SEZIONE 4 — Esito (collapsible) */}
          <div ref={esitoRef} className="border-t pt-4">
            <button
              onClick={() => setShowEsito(!showEsito)}
              className="flex items-center space-x-2 w-full text-left"
            >
              <Target className="w-4 h-4 text-violet-600" />
              <h3 className="text-sm font-semibold text-gray-900">4. Esito</h3>
              <span className="text-xs text-gray-500">(opzionale)</span>
              {g4Complete && (
                <span className="ml-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-700">Completo</span>
              )}
              <div className="flex-1" />
              {showEsito ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </button>

            {showEsito && (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Raccomandazione</label>
                    <select
                      value={formData.raccomandazione}
                      onChange={(e) => handleInputChange('raccomandazione', e.target.value)}
                      className="input text-sm"
                    >
                      <option value="">Seleziona...</option>
                      {RACCOMANDAZIONI.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Responsabile qualificazione</label>
                    <UnifiedResponsableSelector
                      variant="simple"
                      value={formData.responsabile_qualificazione}
                      onChange={(val) => handleInputChange('responsabile_qualificazione', val)}
                      placeholder="Chi deve qualificare"
                      showTutti={false}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Motivazione raccomandazione</label>
                    <textarea
                      value={formData.motivazione_raccomandazione}
                      onChange={(e) => handleInputChange('motivazione_raccomandazione', e.target.value)}
                      className="input text-sm min-h-[60px]"
                      rows={2}
                      placeholder="Perche si raccomanda questa azione..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Data riunione prevista</label>
                    <input
                      type="date"
                      value={formData.data_riunione_prevista}
                      onChange={(e) => handleInputChange('data_riunione_prevista', e.target.value)}
                      className="input text-sm"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SEZIONE 5 — Profilazione (collapsible) */}
          <div className="border-t pt-4">
            <button
              onClick={() => setShowProfilazione(!showProfilazione)}
              className="flex items-center space-x-2 w-full text-left"
            >
              <Star className="w-4 h-4 text-yellow-500" />
              <h3 className="text-sm font-semibold text-gray-900">5. Profilazione</h3>
              <span className="text-xs text-gray-500">(opzionale)</span>
              {formData.profiling_data && Object.keys(formData.profiling_data).length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-700">
                  Score: {calculateProfilingScore()}%
                </span>
              )}
              <div className="flex-1" />
              {showProfilazione ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </button>

            {showProfilazione && (
              <div className="mt-3">
                {loadingTemplates ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500"></div>
                  </div>
                ) : profilingTemplates.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Star className="w-6 h-6 mx-auto mb-1 opacity-50" />
                    <p className="text-sm">Nessun template di profilazione configurato</p>
                  </div>
                ) : (
                  <ProfilingCard
                    templates={profilingTemplates}
                    values={formData.profiling_data}
                    onChange={handleProfilingChange}
                    readOnly={false}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-4 py-2.5 bg-gray-50 flex items-center justify-between flex-shrink-0">
          <div className="text-xs text-gray-500">
            {prospect ? (
              <span>
                Stato corrente:{' '}
                <span className={`font-medium ${PROSPECT_STATI[prospect.stato]?.color || 'text-gray-600'}`}>
                  {PROSPECT_STATI[prospect.stato]?.label || prospect.stato}
                </span>
                <span className="text-gray-400 ml-2">(il salvataggio non modifica lo stato)</span>
              </span>
            ) : (
              <span className="text-gray-400">Nuovo prospect — stato iniziale: Bozza</span>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="btn-secondary"
              disabled={saving}
            >
              Annulla
            </button>
            <button
              onClick={handleSave}
              className="btn-primary flex items-center space-x-2"
              disabled={saving}
            >
              {saving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{saving ? 'Salvando...' : 'Salva Prequalifica'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
