'use client'

import { useState, useCallback } from 'react'

interface EvolviContractState {
  loading: boolean
  error: string | null
  success: boolean
  contractData: any | null
}

const initialState: EvolviContractState = {
  loading: false,
  error: null,
  success: false,
  contractData: null
}

export function useEvolviContractGeneration() {
  const [state, setState] = useState<EvolviContractState>(initialState)

  const generateContract = useCallback(async (params: { contrattoId: string, clienteId: string }) => {
    setState({ loading: true, error: null, success: false, contractData: null })

    try {
      const response = await fetch('/api/contracts/evolvi/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contrattoId: params.contrattoId,
          clienteId: params.clienteId
        })
      })

      const result = await response.json()

      if (result.success) {
        setState({
          loading: false,
          error: null,
          success: true,
          contractData: result.data
        })
        return result.data
      } else {
        setState({
          loading: false,
          error: result.message || 'Errore generazione contratto Evolvi',
          success: false,
          contractData: null
        })
        throw new Error(result.message)
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Errore durante la generazione del contratto Evolvi'
      setState({
        loading: false,
        error: errorMessage,
        success: false,
        contractData: null
      })
      throw error
    }
  }, [])

  const approveContract = useCallback(async (contrattoId: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const response = await fetch('/api/contracts/evolvi/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ contrattoId })
      })

      const result = await response.json()

      if (result.success) {
        setState(prev => ({
          ...prev,
          loading: false,
          success: true,
          contractData: { ...prev.contractData, ...result.data, approved: true }
        }))
        return result.data
      } else {
        setState(prev => ({
          ...prev,
          loading: false,
          error: result.message || 'Errore approvazione contratto Evolvi'
        }))
        throw new Error(result.message)
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Errore durante approvazione contratto Evolvi'
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }))
      throw error
    }
  }, [])

  const sendEmail = useCallback(async (params: { contrattoId: string, customMessage?: string }) => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const response = await fetch('/api/contracts/evolvi/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contrattoId: params.contrattoId,
          customMessage: params.customMessage
        })
      })

      const result = await response.json()

      if (result.success) {
        setState(prev => ({
          ...prev,
          loading: false,
          success: true,
          contractData: { ...prev.contractData, ...result.data, emailSent: true }
        }))
        return result.data
      } else {
        setState(prev => ({
          ...prev,
          loading: false,
          error: result.message || 'Errore invio email contratto Evolvi'
        }))
        throw new Error(result.message)
      }
    } catch (error: any) {
      const errorMessage = error.message || "Errore durante l'invio dell'email"
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }))
      throw error
    }
  }, [])

  const renewContract = useCallback(async (contrattoId: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const response = await fetch('/api/contracts/evolvi/renew', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ contrattoId })
      })

      const result = await response.json()

      if (result.success) {
        setState(prev => ({
          ...prev,
          loading: false,
          success: true,
          contractData: result.data
        }))
        return result.data
      } else {
        setState(prev => ({
          ...prev,
          loading: false,
          error: result.message || 'Errore rinnovo contratto Evolvi'
        }))
        throw new Error(result.message)
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Errore durante il rinnovo del contratto Evolvi'
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }))
      throw error
    }
  }, [])

  const reset = useCallback(() => {
    setState(initialState)
  }, [])

  return {
    ...state,
    generateContract,
    approveContract,
    sendEmail,
    renewContract,
    reset
  }
}
