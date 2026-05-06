'use client'

import { useState, useEffect } from 'react'
import { FileText, Loader2, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react'

interface ContractModalProps {
  isOpen: boolean
  onClose: () => void
  progettoData: {
    id: string
    titolo_progetto: string
    cliente?: {
      denominazione: string
      email?: string
      pec?: string
    }
    bando?: {
      nome: string
    }
  }
  onSuccess?: () => void
}

export default function ContractModal({ isOpen, onClose, progettoData, onSuccess }: ContractModalProps) {
  const [step, setStep] = useState(1)
  const [importoConsulenza, setImportoConsulenza] = useState('')
  const [emailTarget, setEmailTarget] = useState('')
  const [customMessage, setCustomMessage] = useState('')
  const [error, setError] = useState('')
  const [contractData, setContractData] = useState<any>(null)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [emailResult, setEmailResult] = useState<any>(null)

  // Init email target
  useEffect(() => {
    if (progettoData.cliente) {
      setEmailTarget(progettoData.cliente.email || progettoData.cliente.pec || '')
    }
  }, [progettoData])

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setStep(1)
      setImportoConsulenza('')
      setCustomMessage('')
      setEmailTarget(progettoData.cliente?.email || progettoData.cliente?.pec || '')
      setError('')
      setContractData(null)
      setSendingEmail(false)
      setEmailSent(false)
      setEmailResult(null)
    }
  }, [isOpen, progettoData])

  const handleGoToPreview = () => {
    if (!importoConsulenza.trim()) {
      setError('Inserire l\'importo della consulenza')
      return
    }
    setError('')
    setStep(2)
  }

  const handleGenerateContract = async () => {
    setStep(3)
    setError('')

    try {
      const response = await fetch('/api/contracts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          progettoId: progettoData.id,
          importoConsulenza,
          useWordTemplate: true
        })
      })

      const result = await response.json()

      if (result.success) {
        setContractData(result.data)
        setStep(4)
      } else {
        setError(result.message || 'Errore generazione contratto')
        setStep(4)
      }
    } catch {
      setError('Errore durante generazione contratto')
      setStep(4)
    }
  }

  const handleApproveAndSend = async () => {
    if (!contractData?.contractId) return
    setSendingEmail(true)
    setError('')

    try {
      const response = await fetch('/api/contracts/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          progettoId: progettoData.id,
          contractId: contractData.contractId,
          contractUrl: contractData.contractUrl,
          customMessage: customMessage || undefined
        })
      })

      const result = await response.json()

      if (result.success) {
        setEmailSent(true)
        setEmailResult(result.data)
        setTimeout(() => {
          onSuccess?.()
          onClose()
        }, 3000)
      } else {
        setError(result.message || 'Errore durante invio')
        setSendingEmail(false)
      }
    } catch {
      setError('Errore durante approvazione contratto')
      setSendingEmail(false)
    }
  }

  if (!isOpen) return null

  const stepLabels = ['Dati', 'Riepilogo', 'Generazione', 'Contratto']

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header gradient con step dots */}
        <div className="gradient-primary text-white p-4 flex items-center justify-between rounded-t-lg">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <div>
              <h2 className="font-semibold text-base">Genera e Invia Contratto</h2>
              <p className="text-xs text-white/70">{stepLabels[step - 1]}</p>
            </div>
          </div>
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
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* Step 1: Form */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Importo Consulenza *
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 font-medium">&euro;</span>
                  <input
                    type="text"
                    value={importoConsulenza}
                    onChange={(e) => setImportoConsulenza(e.target.value)}
                    placeholder="5.000,00"
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                  <span className="text-sm text-gray-500">+ IVA</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Destinatario
                </label>
                <input
                  type="email"
                  value={emailTarget}
                  onChange={(e) => setEmailTarget(e.target.value)}
                  placeholder="email@esempio.it"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
                {progettoData.cliente?.email && (
                  <p className="text-xs text-gray-500 mt-1">
                    Email da anagrafica: {progettoData.cliente.email}
                  </p>
                )}
                {!progettoData.cliente?.email && progettoData.cliente?.pec && (
                  <p className="text-xs text-gray-500 mt-1">
                    PEC da anagrafica: {progettoData.cliente.pec}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Messaggio Personalizzato (Opzionale)
                </label>
                <textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Aggiungere un messaggio personalizzato all'email..."
                  rows={3}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-md">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Riepilogo */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                <h3 className="font-medium text-sm text-gray-900">Riepilogo Contratto</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Cliente</span>
                    <span className="font-medium">{progettoData.cliente?.denominazione}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Progetto</span>
                    <span className="font-medium">{progettoData.titolo_progetto}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Bando</span>
                    <span className="font-medium">{progettoData.bando?.nome || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Importo Consulenza</span>
                    <span className="font-semibold text-teal-700">&euro; {importoConsulenza} + IVA</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Email Destinatario</span>
                    <span className="font-medium">{emailTarget || 'Non specificata'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded-r-md">
                <p className="text-xs text-blue-700">
                  Il contratto verrà generato da template Word e salvato su Google Drive.
                  Potrai rivederlo prima dell&apos;invio al cliente.
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Generazione (loader) */}
          {step === 3 && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-teal-200 rounded-full" />
                <div className="absolute inset-0 w-16 h-16 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
              </div>
              <h3 className="text-sm font-medium mt-6 text-gray-900">Generazione contratto in corso...</h3>
              <p className="text-sm text-gray-500 mt-2">
                Creazione contratto formattato da template Word
              </p>
            </div>
          )}

          {/* Step 4: Successo / Risultato */}
          {step === 4 && !emailSent && (
            <div className="space-y-4">
              {error ? (
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-md">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 text-green-700 bg-green-50 p-4 rounded-lg">
                    <CheckCircle className="h-6 w-6 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-sm">Contratto Word generato con successo!</p>
                      <p className="text-xs text-green-600 mt-0.5">{contractData?.contractFileName}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => window.open(contractData?.contractUrl, '_blank')}
                    className="flex items-center gap-2 text-sm text-teal-700 hover:text-teal-900 font-medium"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Apri su Google Docs
                  </button>

                  <div className="bg-amber-50 border-l-4 border-amber-400 p-3 rounded-r-md">
                    <p className="text-xs text-amber-700">
                      Rivedi e modifica il contratto su Google Docs se necessario, poi clicca
                      &quot;Approva contratto e invialo al cliente&quot; per convertirlo in PDF e spedirlo.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 4 substato: email inviata */}
          {step === 4 && emailSent && (
            <div className="flex flex-col items-center justify-center py-8">
              <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
              <h3 className="text-base font-semibold text-green-900">Contratto approvato e inviato!</h3>
              <div className="text-sm text-gray-600 mt-4 space-y-1 text-center">
                <p>PDF generato: {emailResult?.pdfFileName}</p>
                <p>Email inviata a: {emailResult?.emailTo}</p>
                <p>File salvati in Google Drive</p>
              </div>
              {emailResult?.pdfUrl && (
                <button
                  onClick={() => window.open(emailResult.pdfUrl, '_blank')}
                  className="mt-4 flex items-center gap-2 text-sm text-teal-700 hover:text-teal-900 font-medium border border-teal-300 px-3 py-1.5 rounded-md hover:bg-teal-50"
                >
                  <ExternalLink className="h-4 w-4" />
                  Visualizza PDF su Drive
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer navigazione */}
        {!emailSent && step !== 3 && (
          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-between rounded-b-lg">
            {/* Pulsante sinistro */}
            {step === 1 && (
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Annulla
              </button>
            )}
            {step === 2 && (
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                &larr; Indietro
              </button>
            )}
            {step === 4 && (
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Chiudi
              </button>
            )}

            {/* Pulsante destro */}
            {step === 1 && (
              <button
                onClick={handleGoToPreview}
                className="btn-primary px-4 py-2 text-sm font-medium rounded-md"
              >
                Anteprima &rarr;
              </button>
            )}
            {step === 2 && (
              <button
                onClick={handleGenerateContract}
                className="btn-primary px-4 py-2 text-sm font-medium rounded-md flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                Genera Contratto
              </button>
            )}
            {step === 4 && !error && contractData && (
              <button
                onClick={handleApproveAndSend}
                disabled={sendingEmail}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md flex items-center gap-2 disabled:opacity-50"
              >
                {sendingEmail ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Invio in corso...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Approva contratto e invialo al cliente
                  </>
                )}
              </button>
            )}
            {step === 4 && error && (
              <button
                onClick={() => { setError(''); setStep(1) }}
                className="btn-primary px-4 py-2 text-sm font-medium rounded-md"
              >
                Riprova
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
