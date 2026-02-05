'use client'

import { useState, useCallback } from 'react'

interface ContractGenerationState {
  loading: boolean
  error: string | null
  success: boolean
  contractData: any | null
}

interface GenerateContractParams {
  progettoId: string
  importoConsulenza: string
  customEmailMessage?: string
  autoSend?: boolean
  templateName?: string
}

export function useContractGeneration() {
  const [state, setState] = useState<ContractGenerationState>({
    loading: false,
    error: null,
    success: false,
    contractData: null
  })

  const generateContract = useCallback(async (params: GenerateContractParams) => {
    setState({ loading: true, error: null, success: false, contractData: null })

    try {
      const response = await fetch('/api/contracts/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          progettoId: params.progettoId,
          importoConsulenza: params.importoConsulenza,
          templateName: params.templateName || 'MODELLO CONTRATTO SPOT',
          useWordTemplate: true
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
          error: result.message || 'Errore generazione contratto',
          success: false,
          contractData: null
        })
        throw new Error(result.message)
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Errore durante la generazione del contratto'
      setState({
        loading: false,
        error: errorMessage,
        success: false,
        contractData: null
      })
      throw error
    }
  }, [])

  const sendContractEmail = useCallback(async (params: {
    progettoId: string
    contractId: string
    contractUrl: string
    customMessage?: string
  }) => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const response = await fetch('/api/contracts/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
      })

      const result = await response.json()

      if (result.success) {
        setState(prev => ({
          ...prev,
          loading: false,
          success: true
        }))
        return result.data
      } else {
        setState(prev => ({
          ...prev,
          loading: false,
          error: result.message || 'Errore invio email'
        }))
        throw new Error(result.message)
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Errore durante l\'invio dell\'email'
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }))
      throw error
    }
  }, [])

  const approveContract = useCallback(async (params: {
    progettoId: string
    contractId: string
    contractUrl: string
    customMessage?: string
  }) => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const response = await fetch('/api/contracts/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(params)
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
          error: result.message || 'Errore approvazione contratto'
        }))
        throw new Error(result.message)
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Errore durante approvazione contratto'
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }))
      throw error
    }
  }, [])

  const generateAndSendContract = useCallback(async (params: GenerateContractParams) => {
    setState({ loading: true, error: null, success: false, contractData: null })

    try {
      // Genera solo il contratto Word (senza invio automatico)
      const response = await fetch('/api/contracts/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          progettoId: params.progettoId,
          importoConsulenza: params.importoConsulenza,
          templateName: params.templateName || 'MODELLO CONTRATTO SPOT',
          useWordTemplate: true
        })
      })

      const result = await response.json()

      if (result.success) {
        setState({
          loading: false,
          error: null,
          success: true,
          contractData: { ...result.data, requiresApproval: true }
        })
        return result.data
      } else {
        setState({
          loading: false,
          error: result.message || 'Errore generazione contratto',
          success: false,
          contractData: null
        })
        throw new Error(result.message)
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Errore durante la generazione del contratto'
      setState({
        loading: false,
        error: errorMessage,
        success: false,
        contractData: null
      })
      throw error
    }
  }, [])

  const reset = useCallback(() => {
    setState({
      loading: false,
      error: null,
      success: false,
      contractData: null
    })
  }, [])

  return {
    ...state,
    generateContract,
    sendContractEmail,
    generateAndSendContract,
    approveContract,
    reset
  }
}

// Hook semplificato per uso nel modal
export function useContractModal() {
  const {
    loading,
    error,
    success,
    contractData,
    generateAndSendContract,
    approveContract,
    reset
  } = useContractGeneration()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [currentProject, setCurrentProject] = useState<any>(null)

  const openContractModal = useCallback((projectData: any) => {
    setCurrentProject(projectData)
    setIsModalOpen(true)
    reset()
  }, [reset])

  const closeContractModal = useCallback(() => {
    setIsModalOpen(false)
    setCurrentProject(null)
    reset()
  }, [reset])

  const handleContractGenerate = useCallback(async (params: {
    importoConsulenza: string
  }) => {
    if (!currentProject?.id) {
      throw new Error('Nessun progetto selezionato')
    }

    return await generateAndSendContract({
      progettoId: currentProject.id,
      importoConsulenza: params.importoConsulenza
    })
  }, [currentProject, generateAndSendContract])

  const handleContractApprove = useCallback(async (params: {
    customMessage?: string
  }) => {
    if (!currentProject?.id || !contractData?.contractId) {
      throw new Error('Nessun progetto o contratto selezionato')
    }

    return await approveContract({
      progettoId: currentProject.id,
      contractId: contractData.contractId,
      contractUrl: contractData.contractUrl,
      customMessage: params.customMessage
    })
  }, [currentProject, contractData, approveContract])

  return {
    isModalOpen,
    currentProject,
    loading,
    error,
    success,
    contractData,
    openContractModal,
    closeContractModal,
    handleContractGenerate,
    handleContractApprove,
    reset
  }
}