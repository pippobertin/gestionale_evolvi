'use client'

import { useState } from 'react'
import {
  X,
  ArrowRight,
  CheckCircle,
  Building2,
  FileText,
  Zap,
  ExternalLink,
  GraduationCap,
  Briefcase
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Prospect } from '@/types/prospect'

interface ProspectConversionModalProps {
  prospect: Prospect
  isOpen: boolean
  onClose: () => void
  onConvert: () => void
}

export default function ProspectConversionModal({ prospect, isOpen, onClose, onConvert }: ProspectConversionModalProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [decisione, setDecisione] = useState<'EVOLVI' | 'SPOT' | 'FPI' | 'CONSULENTI' | ''>('')
  const [loading, setLoading] = useState(false)
  const [conversionResult, setConversionResult] = useState<{ clienteId: string; denominazione: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const mappedData = {
    denominazione: prospect.denominazione,
    partita_iva: prospect.partita_iva || '',
    codice_fiscale: prospect.codice_fiscale || '',
    email: prospect.email || '',
    pec: prospect.pec || '',
    telefono: prospect.telefono || '',
    sito_web: prospect.sito_web || '',
    indirizzo_fatturazione: prospect.indirizzo || '',
    cap_fatturazione: prospect.cap || '',
    citta_fatturazione: prospect.citta || '',
    provincia_fatturazione: prospect.provincia || '',
    dimensione: prospect.dimensione || '',
    numero_dipendenti: prospect.numero_dipendenti ?? '',
    ultimo_fatturato: prospect.ultimo_fatturato ?? '',
    ateco_2025: prospect.ateco_2025 || '',
    legale_rappresentante_nome: prospect.legale_rappresentante_nome || '',
    legale_rappresentante_cognome: prospect.legale_rappresentante_cognome || '',
    legale_rappresentante_email: prospect.legale_rappresentante_email || '',
    legale_rappresentante_telefono: prospect.legale_rappresentante_telefono || ''
  }

  const handleConvert = async () => {
    if (!decisione) return

    setLoading(true)
    setError(null)

    try {
      // 1. Create the new cliente
      const clienteData: Record<string, any> = {
        denominazione: prospect.denominazione,
        partita_iva: prospect.partita_iva || null,
        codice_fiscale: prospect.codice_fiscale || null,
        email: prospect.email || null,
        pec: prospect.pec || null,
        telefono: prospect.telefono || null,
        sito_web: prospect.sito_web || null,
        indirizzo_fatturazione: prospect.indirizzo || null,
        cap_fatturazione: prospect.cap || null,
        citta_fatturazione: prospect.citta || null,
        provincia_fatturazione: prospect.provincia || null,
        // dimensione: e' una GENERATED column calcolata dal DB in base a
        // ula, ultimo_fatturato, attivo_bilancio (UE 2003/361/CE).
        // Per garantire la classificazione MICRO alla conversione (in
        // assenza di dati reali) impostiamo valori minimi placeholder:
        // questi vanno verificati e corretti nella scheda cliente.
        numero_dipendenti: prospect.numero_dipendenti || null,
        ula: prospect.numero_dipendenti ?? 1,
        attivo_bilancio: 100,
        ultimo_fatturato: prospect.ultimo_fatturato ?? 100,
        ateco_2025: prospect.ateco_2025 || null,
        legale_rappresentante_nome: prospect.legale_rappresentante_nome || null,
        legale_rappresentante_cognome: prospect.legale_rappresentante_cognome || null,
        legale_rappresentante_email: prospect.legale_rappresentante_email || null,
        legale_rappresentante_telefono: prospect.legale_rappresentante_telefono || null,
        categoria_evolvi: decisione === 'SPOT' ? 'CLIENTE_SPOT' : decisione,
        stato_fatturazione: 'Italia',
        note: '⚠ Dati di dimensionamento (ULA, fatturato, attivo bilancio) impostati su valori provvisori al momento della conversione. Verificare e aggiornare per ottenere la classificazione UE corretta.',
      }

      const { data: newCliente, error: clienteError } = await supabase
        .from('scadenze_bandi_clienti')
        .insert([clienteData])
        .select('id, denominazione')
        .single()

      if (clienteError) throw clienteError

      // 2. Update prospect as converted
      const { error: prospectError } = await supabase
        .from('scadenze_bandi_prospect')
        .update({
          stato: 'convertito',
          decisione: decisione,
          cliente_id: newCliente.id,
          data_conversione: new Date().toISOString()
        })
        .eq('id', prospect.id)

      if (prospectError) throw prospectError

      // 3. Add history entry
      await supabase
        .from('scadenze_bandi_prospect_history')
        .insert([{
          prospect_id: prospect.id,
          stato_precedente: prospect.stato,
          stato_nuovo: 'convertito',
          note: `Convertito in cliente (${
            decisione === 'EVOLVI' ? 'Evolvi' :
            decisione === 'SPOT' ? 'Cliente Spot' :
            decisione === 'FPI' ? 'FPI' :
            'Consulente'
          })`
        }])

      setConversionResult({
        clienteId: newCliente.id,
        denominazione: newCliente.denominazione
      })
      setCurrentStep(3)
      onConvert()
    } catch (err: any) {
      console.error('Errore conversione:', err)
      setError(err.message || 'Errore durante la conversione')
    } finally {
      setLoading(false)
    }
  }

  const renderStep1 = () => (
    <div className="space-y-3">
      <div className="text-center mb-6">
        <h3 className="text-sm font-semibold text-gray-900">Tipo di Cliente</h3>
        <p className="text-sm text-gray-600 mt-1">Scegli la tipologia di cliente per la conversione</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* EVOLVI */}
        <button
          onClick={() => setDecisione('EVOLVI')}
          className={`border-2 rounded-lg p-4 text-left transition-all ${
            decisione === 'EVOLVI'
              ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200'
              : 'border-gray-200 hover:border-gray-300 bg-white'
          }`}
        >
          <div className="flex items-center space-x-3 mb-3">
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
              decisione === 'EVOLVI' ? 'bg-primary-100' : 'bg-gray-100'
            }`}>
              <Zap className={`w-5 h-5 ${decisione === 'EVOLVI' ? 'text-primary-600' : 'text-gray-500'}`} />
            </div>
            <h4 className="font-semibold text-gray-900">EVOLVI</h4>
          </div>
          <p className="text-sm text-gray-600">
            Cliente con abbonamento Evolvi. Include accesso completo alla piattaforma,
            monitoraggio bandi e supporto dedicato.
          </p>
          {decisione === 'EVOLVI' && (
            <div className="mt-3 flex items-center text-primary-600 text-sm font-medium">
              <CheckCircle className="w-4 h-4 mr-1" />
              Selezionato
            </div>
          )}
        </button>

        {/* SPOT */}
        <button
          onClick={() => setDecisione('SPOT')}
          className={`border-2 rounded-lg p-4 text-left transition-all ${
            decisione === 'SPOT'
              ? 'border-yellow-500 bg-yellow-50 ring-2 ring-yellow-200'
              : 'border-gray-200 hover:border-gray-300 bg-white'
          }`}
        >
          <div className="flex items-center space-x-3 mb-3">
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
              decisione === 'SPOT' ? 'bg-yellow-100' : 'bg-gray-100'
            }`}>
              <FileText className={`w-5 h-5 ${decisione === 'SPOT' ? 'text-yellow-600' : 'text-gray-500'}`} />
            </div>
            <h4 className="font-semibold text-gray-900">SPOT</h4>
          </div>
          <p className="text-sm text-gray-600">
            Cliente occasionale senza abbonamento. Progetto singolo o consulenza
            una tantum su specifici bandi.
          </p>
          {decisione === 'SPOT' && (
            <div className="mt-3 flex items-center text-yellow-600 text-sm font-medium">
              <CheckCircle className="w-4 h-4 mr-1" />
              Selezionato
            </div>
          )}
        </button>

        {/* FPI */}
        <button
          onClick={() => setDecisione('FPI')}
          className={`border-2 rounded-lg p-4 text-left transition-all ${
            decisione === 'FPI'
              ? 'border-green-500 bg-green-50 ring-2 ring-green-200'
              : 'border-gray-200 hover:border-gray-300 bg-white'
          }`}
        >
          <div className="flex items-center space-x-3 mb-3">
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
              decisione === 'FPI' ? 'bg-green-100' : 'bg-gray-100'
            }`}>
              <GraduationCap className={`w-5 h-5 ${decisione === 'FPI' ? 'text-green-600' : 'text-gray-500'}`} />
            </div>
            <h4 className="font-semibold text-gray-900">FPI</h4>
          </div>
          <p className="text-sm text-gray-600">
            Cliente per gestione Fondi Paritetici Interprofessionali e piani formativi.
          </p>
          {decisione === 'FPI' && (
            <div className="mt-3 flex items-center text-green-600 text-sm font-medium">
              <CheckCircle className="w-4 h-4 mr-1" />
              Selezionato
            </div>
          )}
        </button>

        {/* CONSULENTI */}
        <button
          onClick={() => setDecisione('CONSULENTI')}
          className={`border-2 rounded-lg p-4 text-left transition-all ${
            decisione === 'CONSULENTI'
              ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
              : 'border-gray-200 hover:border-gray-300 bg-white'
          }`}
        >
          <div className="flex items-center space-x-3 mb-3">
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
              decisione === 'CONSULENTI' ? 'bg-purple-100' : 'bg-gray-100'
            }`}>
              <Briefcase className={`w-5 h-5 ${decisione === 'CONSULENTI' ? 'text-purple-600' : 'text-gray-500'}`} />
            </div>
            <h4 className="font-semibold text-gray-900">CONSULENTI</h4>
          </div>
          <p className="text-sm text-gray-600">
            Consulente esterno. Comparirà automaticamente nella sezione Consulenti.
          </p>
          {decisione === 'CONSULENTI' && (
            <div className="mt-3 flex items-center text-purple-600 text-sm font-medium">
              <CheckCircle className="w-4 h-4 mr-1" />
              Selezionato
            </div>
          )}
        </button>
      </div>
    </div>
  )

  const renderStep2 = () => (
    <div className="space-y-3">
      <div className="text-center mb-6">
        <h3 className="text-sm font-semibold text-gray-900">Anteprima Dati Cliente</h3>
        <p className="text-sm text-gray-600 mt-1">Verifica i dati che verranno trasferiti al nuovo cliente</p>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center space-x-2 mb-3">
          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
            decisione === 'EVOLVI' ? 'bg-primary-100 text-primary-700' : 'bg-yellow-100 text-yellow-700'
          }`}>
            {decisione === 'EVOLVI' ? 'Evolvi Base' : 'Cliente Spot'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Object.entries(mappedData).map(([key, value]) => {
            if (!value) return null
            const label = key
              .replace(/_/g, ' ')
              .replace(/\b\w/g, l => l.toUpperCase())
              .replace('Fatturazione', '(Fatt.)')

            return (
              <div key={key} className="flex flex-col">
                <span className="text-xs text-gray-500">{label}</span>
                <span className="text-sm text-gray-900 font-medium">{String(value)}</span>
              </div>
            )
          })}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  )

  const renderStep3 = () => (
    <div className="text-center space-y-3">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
        <CheckCircle className="w-8 h-8 text-green-600" />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-900">Conversione Completata!</h3>
        <p className="text-sm text-gray-600 mt-2">
          Il prospect <strong>{prospect.denominazione}</strong> e stato convertito con successo in cliente.
        </p>
      </div>

      {conversionResult && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-center space-x-2">
            <Building2 className="w-5 h-5 text-green-600" />
            <span className="font-medium text-green-900">{conversionResult.denominazione}</span>
          </div>
          <p className="text-xs text-green-600 mt-1">
            ID Cliente: {conversionResult.clienteId}
          </p>
        </div>
      )}
    </div>
  )

  const steps = [
    { number: 1, label: 'Tipo Cliente' },
    { number: 2, label: 'Anteprima' },
    { number: 3, label: 'Completato' }
  ]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-xl shadow-hard max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="gradient-primary text-white p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <ArrowRight className="w-4 h-4" />
            <div>
              <h2 className="text-xl font-bold">Conversione a Cliente</h2>
              <p className="text-primary-100 text-sm">{prospect.denominazione}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="flex items-center justify-center space-x-4">
            {steps.map((step, index) => (
              <div key={step.number} className="flex items-center">
                <div className={`flex items-center space-x-2 ${
                  currentStep >= step.number ? 'text-primary-600' : 'text-gray-400'
                }`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    currentStep > step.number
                      ? 'bg-primary-600 text-white'
                      : currentStep === step.number
                        ? 'bg-primary-100 text-primary-700 border-2 border-primary-500'
                        : 'bg-gray-100 text-gray-400'
                  }`}>
                    {currentStep > step.number ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      step.number
                    )}
                  </div>
                  <span className="text-sm font-medium hidden sm:inline">{step.label}</span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`w-12 h-0.5 mx-2 ${
                    currentStep > step.number ? 'bg-primary-500' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-4 py-3 bg-gray-50 flex items-center justify-between flex-shrink-0">
          <div>
            {currentStep > 1 && currentStep < 3 && (
              <button
                onClick={() => setCurrentStep(currentStep - 1)}
                className="btn-secondary"
                disabled={loading}
              >
                Indietro
              </button>
            )}
          </div>

          <div className="flex items-center space-x-3">
            {currentStep < 3 && (
              <button
                onClick={onClose}
                className="btn-secondary"
                disabled={loading}
              >
                Annulla
              </button>
            )}

            {currentStep === 1 && (
              <button
                onClick={() => setCurrentStep(2)}
                className="btn-primary flex items-center space-x-2"
                disabled={!decisione}
              >
                <span>Avanti</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {currentStep === 2 && (
              <button
                onClick={handleConvert}
                className="btn-primary flex items-center space-x-2"
                disabled={loading}
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                <span>{loading ? 'Conversione...' : 'Conferma Conversione'}</span>
              </button>
            )}

            {currentStep === 3 && (
              <button
                onClick={onClose}
                className="btn-primary flex items-center space-x-2"
              >
                <span>Chiudi</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
