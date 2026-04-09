'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, Mail, Send, FileText, Loader2, CheckCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

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

interface ContractState {
  step: 'form' | 'preview' | 'generated' | 'approving' | 'success' | 'error'
  importoConsulenza: string
  customMessage: string
  emailTarget: string
  error?: string
  contractData?: any
}

export default function ContractModal({ isOpen, onClose, progettoData, onSuccess }: ContractModalProps) {
  const [state, setState] = useState<ContractState>({
    step: 'form',
    importoConsulenza: '',
    customMessage: '',
    emailTarget: ''
  })

  // Determina email target al mount
  useEffect(() => {
    if (progettoData.cliente) {
      const emailTarget = progettoData.cliente.email || progettoData.cliente.pec || ''
      setState(prev => ({ ...prev, emailTarget }))
    }
  }, [progettoData])

  // Reset state quando modal si chiude
  useEffect(() => {
    if (!isOpen) {
      setState({
        step: 'form',
        importoConsulenza: '',
        customMessage: '',
        emailTarget: progettoData.cliente?.email || progettoData.cliente?.pec || ''
      })
    }
  }, [isOpen, progettoData])

  const handleGenerateContract = async () => {
    if (!state.importoConsulenza.trim()) {
      setState(prev => ({ ...prev, error: 'Inserire l\'importo della consulenza' }))
      return
    }

    setState(prev => ({ ...prev, step: 'preview', error: undefined }))

    try {
      const response = await fetch('/api/contracts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          progettoId: progettoData.id,
          importoConsulenza: state.importoConsulenza,
          useWordTemplate: true
        })
      })

      const result = await response.json()

      if (result.success) {
        setState(prev => ({
          ...prev,
          step: 'generated',
          contractData: result.data
        }))
      } else {
        setState(prev => ({
          ...prev,
          step: 'error',
          error: result.message || 'Errore generazione contratto'
        }))
      }
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        step: 'error',
        error: 'Errore durante generazione contratto'
      }))
    }
  }

  const handleApproveContract = async () => {
    if (!state.contractData?.contractId) {
      setState(prev => ({ ...prev, error: 'Nessun contratto da approvare' }))
      return
    }

    setState(prev => ({ ...prev, step: 'approving' }))

    try {
      const response = await fetch('/api/contracts/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          progettoId: progettoData.id,
          contractId: state.contractData.contractId,
          contractUrl: state.contractData.contractUrl,
          customMessage: state.customMessage || undefined
        })
      })

      const result = await response.json()

      if (result.success) {
        setState(prev => ({
          ...prev,
          step: 'success',
          contractData: { ...prev.contractData, ...result.data }
        }))

        // Callback di successo
        setTimeout(() => {
          onSuccess?.()
          onClose()
        }, 3000)
      } else {
        setState(prev => ({
          ...prev,
          step: 'error',
          error: result.message
        }))
      }
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        step: 'error',
        error: 'Errore durante approvazione contratto'
      }))
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Genera e Invia Contratto
          </DialogTitle>
          <DialogDescription>
            Genera automaticamente il contratto per il progetto e invialo al cliente
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Info Progetto */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <h3 className="font-medium text-sm text-gray-700">Dettagli Progetto</h3>
            <div className="space-y-1 text-sm">
              <div><strong>Cliente:</strong> {progettoData.cliente?.denominazione}</div>
              <div><strong>Progetto:</strong> {progettoData.titolo_progetto}</div>
              <div><strong>Bando:</strong> {progettoData.bando?.nome}</div>
            </div>
          </div>

          {/* Form Step */}
          {state.step === 'form' && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="importo">Importo Consulenza *</Label>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="text-sm text-gray-500">€</span>
                  <Input
                    id="importo"
                    value={state.importoConsulenza}
                    onChange={(e) => setState(prev => ({ ...prev, importoConsulenza: e.target.value }))}
                    placeholder="5.000,00"
                    className="flex-1"
                  />
                  <span className="text-sm text-gray-500">+ IVA</span>
                </div>
              </div>

              <div>
                <Label htmlFor="email">Email Destinatario</Label>
                <div className="flex items-center space-x-2 mt-1">
                  <Badge variant="default">
                    EMAIL
                  </Badge>
                  <Input
                    id="email"
                    type="email"
                    value={state.emailTarget}
                    onChange={(e) => setState(prev => ({ ...prev, emailTarget: e.target.value }))}
                    placeholder="email@esempio.it"
                    className="flex-1"
                  />
                  <Mail className="h-4 w-4 text-gray-400" />
                </div>
                {progettoData.cliente?.email && (
                  <p className="text-xs text-gray-500 mt-1">
                    📧 Email da anagrafica cliente: {progettoData.cliente.email}
                  </p>
                )}
                {!progettoData.cliente?.email && progettoData.cliente?.pec && (
                  <p className="text-xs text-gray-500 mt-1">
                    📧 PEC da anagrafica cliente: {progettoData.cliente.pec}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="message">Messaggio Personalizzato (Opzionale)</Label>
                <Textarea
                  id="message"
                  value={state.customMessage}
                  onChange={(e) => setState(prev => ({ ...prev, customMessage: e.target.value }))}
                  placeholder="Aggiungere un messaggio personalizzato all'email..."
                  className="mt-1"
                  rows={3}
                />
              </div>

              {state.error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{state.error}</AlertDescription>
                </Alert>
              )}

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={onClose}>
                  Annulla
                </Button>
                <Button onClick={handleGenerateContract}>
                  <FileText className="h-4 w-4 mr-2" />
                  Genera Contratto Word
                </Button>
              </div>
            </div>
          )}

          {/* Preview Step - Generazione in corso */}
          {state.step === 'preview' && (
            <div className="text-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-4 text-blue-500" />
              <h3 className="text-sm font-medium">Generazione contratto Word...</h3>
              <p className="text-sm text-gray-600 mt-2">
                Creazione contratto formattato da template Word
              </p>
            </div>
          )}

          {/* Generated Step - Contratto generato, richiede approvazione */}
          {state.step === 'generated' && (
            <div className="space-y-3">
              <Alert>
                <FileText className="h-4 w-4" />
                <AlertDescription>
                  <strong>Contratto Word generato con successo!</strong>
                  <br />Verificare il contenuto prima dell'invio al cliente.
                </AlertDescription>
              </Alert>

              <div className="bg-amber-50 p-4 rounded-lg space-y-3">
                <h3 className="font-medium text-amber-900">📋 Necessaria Approvazione Contratto</h3>
                <div className="text-sm text-amber-800 space-y-2">
                  <div><strong>Cliente:</strong> {progettoData.cliente?.denominazione}</div>
                  <div><strong>Importo:</strong> €{state.importoConsulenza} + IVA</div>
                  <div><strong>Formato:</strong> {state.contractData?.isWordDocument ? 'Documento Word (.docx)' : 'Testo (.txt)'}</div>

                  <div className="mt-3 p-3 bg-white rounded border">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">📄 Contratto generato:</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(state.contractData?.contractUrl, '_blank')}
                      >
                        Visualizza su Drive
                      </Button>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      {state.contractData?.contractFileName}
                    </p>
                  </div>

                  <div className="bg-blue-50 p-3 rounded border-l-4 border-blue-400">
                    <p className="text-xs text-blue-700">
                      💡 <strong>Passo successivo:</strong> Verificare il contenuto del contratto su Google Drive.
                      È possibile modificarlo direttamente. Una volta confermato, cliccare "Approvo Contratto"
                      per convertirlo in PDF e inviarlo al cliente.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="approveMessage">Messaggio Personalizzato Email (Opzionale)</Label>
                <Textarea
                  id="approveMessage"
                  value={state.customMessage}
                  onChange={(e) => setState(prev => ({ ...prev, customMessage: e.target.value }))}
                  placeholder="Messaggio personalizzato per l'email di invio del contratto PDF..."
                  className="mt-1"
                  rows={3}
                />
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setState(prev => ({ ...prev, step: 'form' }))}>
                  ← Modifica Importo
                </Button>
                <Button onClick={handleApproveContract} className="bg-green-600 hover:bg-green-700">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approvo Contratto
                </Button>
              </div>
            </div>
          )}

          {/* Approving Step */}
          {state.step === 'approving' && (
            <div className="text-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-4 text-green-500" />
              <h3 className="text-sm font-medium">Approvazione in corso...</h3>
              <p className="text-sm text-gray-600 mt-2">
                Conversione in PDF e invio email al cliente
              </p>
            </div>
          )}

          {/* Success Step */}
          {state.step === 'success' && (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-sm font-medium text-green-900">Contratto approvato e inviato!</h3>
              <div className="text-sm text-gray-600 mt-2 space-y-1">
                <div>📄 PDF generato: {state.contractData?.pdfFileName}</div>
                <div>📧 Email inviata a: {state.emailTarget}</div>
                <div>📁 File salvati in Google Drive</div>
              </div>

              {state.contractData?.pdfUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => window.open(state.contractData.pdfUrl, '_blank')}
                >
                  Visualizza PDF su Drive
                </Button>
              )}
            </div>
          )}

          {/* Error Step */}
          {state.step === 'error' && (
            <div className="space-y-3">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>

              <div className="flex justify-between">
                <Button variant="outline" onClick={onClose}>
                  Chiudi
                </Button>
                <Button onClick={() => setState(prev => ({ ...prev, step: 'form', error: undefined }))}>
                  Riprova
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}