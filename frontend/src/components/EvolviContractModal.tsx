'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { X, FileText, ChevronRight, ChevronLeft, CheckCircle, Loader2, AlertCircle, ExternalLink, Mail, Eye } from 'lucide-react'
import { useEvolviContractGeneration } from '@/hooks/useEvolviContractGeneration'

interface EvolviContractModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  clienteId: string
  clienteDenominazione: string
}

interface FormData {
  data_contratto: string
  data_inizio: string
  data_fine: string
  modalita_pagamento: 'mensile' | 'annuale'
  importo_rata: string // importo per periodo (600/mese o 7000/anno)
  importo_annuale: string // calcolato: rata*12 se mensile, rata se annuale
  importo_totale: string // calcolato: annuale * anni
  importo_forzato: boolean // true se l'utente ha modificato l'importo standard
  rinnovo_automatico: boolean
  note: string
}

const IMPORTI_STANDARD = {
  mensile: 600,
  annuale: 7000
} as const

function getToday(): string {
  return new Date().toISOString().split('T')[0]
}

function addYears(dateStr: string, years: number): string {
  const date = new Date(dateStr)
  date.setFullYear(date.getFullYear() + years)
  return date.toISOString().split('T')[0]
}

function calculateYearsDiff(startStr: string, endStr: string): number {
  const start = new Date(startStr)
  const end = new Date(endStr)
  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
  return Math.max(months / 12, 0)
}

export default function EvolviContractModal({
  isOpen,
  onClose,
  onSuccess,
  clienteId,
  clienteDenominazione
}: EvolviContractModalProps) {
  const [step, setStep] = useState(1)
  const [formError, setFormError] = useState<string | null>(null)
  const [createdContractId, setCreatedContractId] = useState<string | null>(null)

  const today = getToday()
  const defaultDataInizio = today
  const defaultDataFine = addYears(today, 2)

  const initialFormData: FormData = {
    data_contratto: today,
    data_inizio: defaultDataInizio,
    data_fine: defaultDataFine,
    modalita_pagamento: 'annuale',
    importo_rata: String(IMPORTI_STANDARD.annuale),
    importo_annuale: String(IMPORTI_STANDARD.annuale),
    importo_totale: '',
    importo_forzato: false,
    rinnovo_automatico: true,
    note: ''
  }

  const [formData, setFormData] = useState<FormData>(initialFormData)

  const {
    loading,
    error: generationError,
    success: generationSuccess,
    contractData,
    generateContract,
    approveContract,
    sendEmail,
    reset
  } = useEvolviContractGeneration()

  // Calcola importo annuale dalla rata
  const calcolaImportoAnnuale = (modalita: 'mensile' | 'annuale', rata: string): string => {
    const rataNum = parseFloat(rata)
    if (isNaN(rataNum)) return ''
    return modalita === 'mensile' ? String(rataNum * 12) : String(rataNum)
  }

  // Auto-calculate importo_annuale e importo_totale
  useEffect(() => {
    const annualeStr = calcolaImportoAnnuale(formData.modalita_pagamento, formData.importo_rata)
    const annuale = parseFloat(annualeStr)
    let totale = ''
    if (!isNaN(annuale) && formData.data_inizio && formData.data_fine) {
      const years = calculateYearsDiff(formData.data_inizio, formData.data_fine)
      totale = (annuale * years).toFixed(2)
    }
    setFormData(prev => ({ ...prev, importo_annuale: annualeStr, importo_totale: totale }))
  }, [formData.importo_rata, formData.modalita_pagamento, formData.data_inizio, formData.data_fine])

  // Quando cambia modalità, imposta importo standard (se non forzato)
  const handleModalitaChange = (modalita: 'mensile' | 'annuale') => {
    const importoStandard = String(IMPORTI_STANDARD[modalita])
    setFormData(prev => ({
      ...prev,
      modalita_pagamento: modalita,
      importo_rata: importoStandard,
      importo_forzato: false
    }))
  }

  // Quando l'utente modifica l'importo manualmente
  const handleImportoRataChange = (value: string) => {
    const standard = String(IMPORTI_STANDARD[formData.modalita_pagamento])
    setFormData(prev => ({
      ...prev,
      importo_rata: value,
      importo_forzato: value !== standard
    }))
  }

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(1)
      setFormError(null)
      setCreatedContractId(null)
      setFormData(initialFormData)
      reset()
    }
  }, [isOpen])

  // Update data_fine when data_inizio changes (keep 2 years default)
  const handleDataInizioChange = (value: string) => {
    const newDataFine = addYears(value, 2)
    setFormData(prev => ({ ...prev, data_inizio: value, data_fine: newDataFine }))
  }

  const validateStep1 = (): boolean => {
    if (!formData.data_contratto) {
      setFormError('Inserire la data del contratto')
      return false
    }
    if (!formData.data_inizio) {
      setFormError('Inserire la data di inizio')
      return false
    }
    if (!formData.data_fine) {
      setFormError('Inserire la data di fine')
      return false
    }
    if (formData.data_fine <= formData.data_inizio) {
      setFormError('La data di fine deve essere successiva alla data di inizio')
      return false
    }
    if (!formData.importo_rata || parseFloat(formData.importo_rata) <= 0) {
      setFormError("Inserire l'importo")
      return false
    }
    setFormError(null)
    return true
  }

  const handleNextStep = () => {
    if (step === 1 && !validateStep1()) return
    setFormError(null)
    setStep(prev => prev + 1)
  }

  const handlePrevStep = () => {
    setFormError(null)
    setStep(prev => prev - 1)
  }

  const handleCreateAndGenerate = async () => {
    try {
      setFormError(null)
      setStep(3)

      // Step 3a: Create the contract record via API
      const createResponse = await fetch('/api/contracts/evolvi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: clienteId,
          data_contratto: formData.data_contratto,
          data_inizio: formData.data_inizio,
          data_fine: formData.data_fine,
          importo_annuale: parseFloat(formData.importo_annuale),
          importo_totale: parseFloat(formData.importo_totale),
          modalita_pagamento: formData.modalita_pagamento,
          rinnovo_automatico: formData.rinnovo_automatico,
          note: formData.note || undefined
        })
      })

      const createResult = await createResponse.json()

      if (!createResult.success) {
        setFormError(createResult.message || 'Errore nella creazione del contratto')
        setStep(2)
        return
      }

      const contrattoId = createResult.data.id
      setCreatedContractId(contrattoId)

      // Step 3b: Generate the Word contract document
      await generateContract({ contrattoId, clienteId })

      // Move to success step
      setStep(4)
    } catch (err: any) {
      console.error('Errore creazione/generazione contratto Evolvi:', err)
      setFormError(err.message || 'Errore nella creazione del contratto')
      if (step === 3) setStep(2)
    }
  }

  const handleApprove = async () => {
    if (!createdContractId) return
    try {
      await approveContract(createdContractId)
      onSuccess()
    } catch (err: any) {
      console.error('Errore approvazione:', err)
    }
  }

  const handleSendEmail = async () => {
    if (!createdContractId) return
    try {
      await sendEmail({ contrattoId: createdContractId })
      onSuccess()
    } catch (err: any) {
      console.error('Errore invio email:', err)
    }
  }

  if (!isOpen) return null

  const formatCurrency = (value: string) => {
    const num = parseFloat(value)
    if (isNaN(num)) return '-'
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(num)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="gradient-primary text-white p-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5" />
            <h3 className="text-lg font-semibold">Nuovo Contratto Evolvi</h3>
          </div>
          <div className="flex items-center space-x-3">
            {/* Step indicator */}
            <div className="flex items-center space-x-1">
              {[1, 2, 3, 4].map((s) => (
                <div
                  key={s}
                  className={`w-2 h-2 rounded-full ${
                    s === step ? 'bg-white' : s < step ? 'bg-white/70' : 'bg-white/30'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/20 rounded transition-colors"
              disabled={loading}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Step 1: Form */}
          {step === 1 && (
            <div className="space-y-5">
              <h4 className="font-medium text-gray-900">Dati del Contratto</h4>

              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Cliente:</span> {clienteDenominazione}
                </p>
              </div>

              {/* 1. Modalita pagamento - scelta principale */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Modalita di Pagamento *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleModalitaChange('mensile')}
                    className={`border-2 rounded-lg p-4 text-left transition-all ${
                      formData.modalita_pagamento === 'mensile'
                        ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="font-semibold text-gray-900">Mensile</div>
                    <div className="text-lg font-bold text-primary-600 mt-1">
                      {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(IMPORTI_STANDARD.mensile)}/mese
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(IMPORTI_STANDARD.mensile * 12)}/anno
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModalitaChange('annuale')}
                    className={`border-2 rounded-lg p-4 text-left transition-all ${
                      formData.modalita_pagamento === 'annuale'
                        ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="font-semibold text-gray-900">Annuale</div>
                    <div className="text-lg font-bold text-primary-600 mt-1">
                      {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(IMPORTI_STANDARD.annuale)}/anno
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Pagamento in unica soluzione
                    </div>
                  </button>
                </div>
              </div>

              {/* 2. Importo rata - pre-compilato, modificabile */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Importo {formData.modalita_pagamento === 'mensile' ? 'Mensile' : 'Annuale'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">EUR</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.importo_rata}
                    onChange={(e) => handleImportoRataChange(e.target.value)}
                    className={`input pl-12 ${formData.importo_forzato ? 'border-amber-400 bg-amber-50' : ''}`}
                  />
                </div>
                {formData.importo_forzato ? (
                  <div className="flex items-center mt-1.5 space-x-1">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                    <p className="text-xs text-amber-600">
                      Importo personalizzato (standard: {new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(IMPORTI_STANDARD[formData.modalita_pagamento])}/{formData.modalita_pagamento === 'mensile' ? 'mese' : 'anno'})
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 mt-1">
                    Importo standard. Modifica per applicare un importo personalizzato.
                  </p>
                )}
              </div>

              {/* Riepilogo importi calcolati */}
              {formData.importo_annuale && (
                <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Importo annuale:</span>
                    <span className="ml-1 font-medium">{formatCurrency(formData.importo_annuale)}</span>
                  </div>
                  {formData.importo_totale && (
                    <div>
                      <span className="text-gray-500">Totale contratto:</span>
                      <span className="ml-1 font-medium">{formatCurrency(formData.importo_totale)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Data Contratto *
                </label>
                <input
                  type="date"
                  value={formData.data_contratto}
                  onChange={(e) => setFormData(prev => ({ ...prev, data_contratto: e.target.value }))}
                  className="input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data Inizio *
                  </label>
                  <input
                    type="date"
                    value={formData.data_inizio}
                    onChange={(e) => handleDataInizioChange(e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data Fine *
                  </label>
                  <input
                    type="date"
                    value={formData.data_fine}
                    onChange={(e) => setFormData(prev => ({ ...prev, data_fine: e.target.value }))}
                    className="input"
                  />
                </div>
              </div>

              {/* Rinnovo automatico */}
              <div className="flex items-center justify-between py-2">
                <label className="text-sm font-medium text-gray-700">
                  Rinnovo Automatico
                </label>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, rinnovo_automatico: !prev.rinnovo_automatico }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.rinnovo_automatico ? 'bg-primary-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      formData.rinnovo_automatico ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Note */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Note
                </label>
                <textarea
                  value={formData.note}
                  onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
                  className="input min-h-[80px]"
                  rows={3}
                  placeholder="Note aggiuntive sul contratto..."
                />
              </div>

              {/* Error */}
              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <p className="text-sm text-red-700">{formError}</p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Preview */}
          {step === 2 && (
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900 mb-4">Riepilogo Contratto</h4>

              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <h5 className="font-medium text-gray-700 text-sm border-b pb-2">Informazioni Cliente</h5>
                <div className="text-sm space-y-1">
                  <div><span className="text-gray-500">Cliente:</span> <span className="font-medium">{clienteDenominazione}</span></div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <h5 className="font-medium text-gray-700 text-sm border-b pb-2">Parametri Contrattuali</h5>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Modalita Pagamento:</span>
                    <span className="ml-1 font-medium capitalize">{formData.modalita_pagamento}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Importo {formData.modalita_pagamento === 'mensile' ? 'Mensile' : 'Annuale'}:</span>
                    <span className="ml-1 font-medium">
                      {formatCurrency(formData.importo_rata)}
                      {formData.importo_forzato && <span className="text-amber-500 text-xs ml-1">(personalizzato)</span>}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Importo Annuale:</span>
                    <span className="ml-1 font-medium">{formatCurrency(formData.importo_annuale)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Importo Totale:</span>
                    <span className="ml-1 font-medium">{formatCurrency(formData.importo_totale)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Data Contratto:</span>
                    <span className="ml-1 font-medium">
                      {new Date(formData.data_contratto).toLocaleDateString('it-IT')}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Data Inizio:</span>
                    <span className="ml-1 font-medium">
                      {new Date(formData.data_inizio).toLocaleDateString('it-IT')}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Data Fine:</span>
                    <span className="ml-1 font-medium">
                      {new Date(formData.data_fine).toLocaleDateString('it-IT')}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Rinnovo Automatico:</span>
                    <span className="ml-1 font-medium">{formData.rinnovo_automatico ? 'Si' : 'No'}</span>
                  </div>
                </div>
                {formData.note && (
                  <div className="text-sm mt-2 pt-2 border-t">
                    <span className="text-gray-500">Note:</span>
                    <p className="mt-1 text-gray-700">{formData.note}</p>
                  </div>
                )}
              </div>

              <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded">
                <p className="text-xs text-blue-700">
                  Confermando, il contratto verra creato e il documento Word generato automaticamente
                  dal template. Potrai revisionarlo su Google Docs prima di approvarlo.
                </p>
              </div>

              {/* Error */}
              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <p className="text-sm text-red-700">{formError}</p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Generating */}
          {step === 3 && (
            <div className="text-center py-12">
              <Loader2 className="h-10 w-10 animate-spin mx-auto mb-4 text-primary-500" />
              <h4 className="text-lg font-medium text-gray-900">Generazione in corso...</h4>
              <p className="text-sm text-gray-600 mt-2">
                Creazione del contratto e generazione del documento Word dal template
              </p>
            </div>
          )}

          {/* Step 4: Success */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <h4 className="text-lg font-medium text-green-900">Contratto Generato con Successo!</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Il documento Word e stato creato e salvato su Google Drive
                </p>
              </div>

              {/* Contract details */}
              {contractData && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  {contractData.contractUrl && (
                    <div className="flex items-center justify-between p-3 bg-white rounded border">
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium">Documento Contratto</span>
                      </div>
                      <a
                        href={contractData.contractUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary text-xs py-1 px-3 flex items-center space-x-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Apri su Google Docs</span>
                      </a>
                    </div>
                  )}

                  {contractData.contractFileName && (
                    <p className="text-xs text-gray-500">
                      File: {contractData.contractFileName}
                    </p>
                  )}
                </div>
              )}

              <div className="bg-amber-50 border-l-4 border-amber-400 p-3 rounded">
                <p className="text-xs text-amber-700">
                  Rivedi il documento su Google Docs. Puoi modificarlo direttamente.
                  Quando il contenuto e confermato, approva il contratto per procedere all'invio.
                </p>
              </div>

              {/* Generation error */}
              {generationError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <p className="text-sm text-red-700">{generationError}</p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-secondary"
                >
                  Chiudi
                </button>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleSendEmail}
                    className="btn-secondary flex items-center space-x-1"
                    disabled={loading}
                  >
                    <Mail className="w-4 h-4" />
                    <span>Invia Email</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleApprove}
                    className="btn-primary flex items-center space-x-1 bg-green-600 hover:bg-green-700"
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    <span>Approva Contratto</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer navigation for steps 1-2 */}
        {(step === 1 || step === 2) && (
          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-between rounded-b-lg">
            {step === 1 ? (
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary"
              >
                Annulla
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePrevStep}
                className="btn-secondary flex items-center space-x-1"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Indietro</span>
              </button>
            )}

            {step === 1 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="btn-primary flex items-center space-x-1"
              >
                <span>Anteprima</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCreateAndGenerate}
                className="btn-primary flex items-center space-x-1"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                <span>Crea e Genera Contratto</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
