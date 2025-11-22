'use client'

import React, { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, User, Mail, Phone, FileText, Save, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Referente {
  id?: string
  cliente_id: string
  cognome: string
  nome: string
  email?: string
  telefono?: string
  note?: string
}

interface ReferentiManagerProps {
  clienteId: string
  isNewClient?: boolean
}

export default function ReferentiManager({ clienteId, isNewClient = false }: ReferentiManagerProps) {
  const [referenti, setReferenti] = useState<Referente[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingReferente, setEditingReferente] = useState<Referente | null>(null)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState<Partial<Referente>>({
    cognome: '',
    nome: '',
    email: '',
    telefono: '',
    note: ''
  })

  // Carica referenti esistenti se il cliente esiste già
  useEffect(() => {
    if (clienteId && !isNewClient) {
      loadReferenti()
    }
  }, [clienteId, isNewClient])

  const loadReferenti = async () => {
    if (!clienteId) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('scadenze_bandi_clienti_referenti')
        .select('*')
        .eq('cliente_id', clienteId)
        .order('cognome', { ascending: true })

      if (error) throw error
      setReferenti(data || [])
    } catch (error) {
      console.error('Errore caricamento referenti:', error)
    } finally {
      setLoading(false)
    }
  }

  const openForm = (referente?: Referente) => {
    if (referente) {
      setEditingReferente(referente)
      setFormData(referente)
    } else {
      setEditingReferente(null)
      setFormData({
        cognome: '',
        nome: '',
        email: '',
        telefono: '',
        note: ''
      })
    }
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingReferente(null)
    setFormData({
      cognome: '',
      nome: '',
      email: '',
      telefono: '',
      note: ''
    })
  }

  const handleInputChange = (field: keyof Referente, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const saveReferente = async () => {
    if (!formData.cognome?.trim() || !formData.nome?.trim()) {
      alert('Cognome e Nome sono obbligatori')
      return
    }

    if (!clienteId) {
      alert('ID Cliente mancante')
      return
    }

    try {
      setLoading(true)
      const dataToSave = {
        cliente_id: clienteId,
        cognome: formData.cognome!.trim(),
        nome: formData.nome!.trim(),
        email: formData.email?.trim() || null,
        telefono: formData.telefono?.trim() || null,
        note: formData.note?.trim() || null
      }

      if (editingReferente?.id) {
        // Update
        const { error } = await supabase
          .from('scadenze_bandi_clienti_referenti')
          .update(dataToSave)
          .eq('id', editingReferente.id)

        if (error) throw error
      } else {
        // Insert
        const { error } = await supabase
          .from('scadenze_bandi_clienti_referenti')
          .insert([dataToSave])

        if (error) throw error
      }

      // Ricarica la lista
      await loadReferenti()
      closeForm()
    } catch (error) {
      console.error('Errore nel salvataggio del referente:', error)
      alert('Errore nel salvataggio del referente')
    } finally {
      setLoading(false)
    }
  }

  const deleteReferente = async (referenteId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo referente?')) return

    try {
      setLoading(true)
      const { error } = await supabase
        .from('scadenze_bandi_clienti_referenti')
        .delete()
        .eq('id', referenteId)

      if (error) throw error

      // Ricarica la lista
      await loadReferenti()
    } catch (error) {
      console.error('Errore nell\'eliminazione del referente:', error)
      alert('Errore nell\'eliminazione del referente')
    } finally {
      setLoading(false)
    }
  }

  // Se è un cliente nuovo, mostra messaggio informativo
  if (isNewClient) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center">
          <User className="w-5 h-5 text-blue-600 mr-2" />
          <h4 className="text-blue-800 font-medium">Referenti Aziendali</h4>
        </div>
        <p className="text-blue-700 text-sm mt-2">
          I referenti potranno essere aggiunti dopo aver salvato il cliente per la prima volta.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-lg font-medium text-gray-900 flex items-center">
          <User className="w-5 h-5 mr-2" />
          Referenti Aziendali
        </h4>
        <button
          type="button"
          onClick={() => openForm()}
          className="btn-primary text-sm py-2 px-3"
          disabled={loading}
        >
          <Plus className="w-4 h-4 mr-1" />
          Aggiungi Referente
        </button>
      </div>

      {/* Lista referenti */}
      <div className="space-y-3">
        {loading && referenti.length === 0 ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500 mx-auto"></div>
            <p className="text-sm text-gray-500 mt-2">Caricamento referenti...</p>
          </div>
        ) : referenti.length === 0 ? (
          <div className="text-center py-8 text-gray-500 border border-gray-200 rounded-lg">
            <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nessun referente configurato</p>
            <p className="text-xs mt-1">Aggiungi referenti per facilitare la comunicazione</p>
          </div>
        ) : (
          referenti.map((referente) => (
            <div key={referente.id} className="border border-gray-200 rounded-lg p-4 bg-white">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h5 className="font-medium text-gray-900">
                      {referente.cognome} {referente.nome}
                    </h5>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    {referente.email && (
                      <div className="flex items-center text-gray-600">
                        <Mail className="w-4 h-4 mr-2" />
                        <a href={`mailto:${referente.email}`} className="hover:text-primary-600">
                          {referente.email}
                        </a>
                      </div>
                    )}
                    {referente.telefono && (
                      <div className="flex items-center text-gray-600">
                        <Phone className="w-4 h-4 mr-2" />
                        <a href={`tel:${referente.telefono}`} className="hover:text-primary-600">
                          {referente.telefono}
                        </a>
                      </div>
                    )}
                  </div>

                  {referente.note && (
                    <div className="mt-2 text-sm text-gray-600 flex items-start">
                      <FileText className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                      <span>{referente.note}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 ml-4">
                  <button
                    type="button"
                    onClick={() => openForm(referente)}
                    className="btn-secondary text-xs py-1 px-2"
                    disabled={loading}
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    Modifica
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteReferente(referente.id!)}
                    className="btn-danger text-xs py-1 px-2"
                    disabled={loading}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Elimina
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Form modal per aggiungere/modificare referente */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="gradient-primary text-white p-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <User className="w-5 h-5" />
                <h3 className="text-lg font-semibold">
                  {editingReferente ? 'Modifica Referente' : 'Nuovo Referente'}
                </h3>
              </div>
              <button
                onClick={closeForm}
                className="p-1 hover:bg-white/20 rounded transition-colors"
                disabled={loading}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form content */}
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cognome *
                  </label>
                  <input
                    type="text"
                    value={formData.cognome || ''}
                    onChange={(e) => handleInputChange('cognome', e.target.value)}
                    className="input"
                    placeholder="Rossi"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nome *
                  </label>
                  <input
                    type="text"
                    value={formData.nome || ''}
                    onChange={(e) => handleInputChange('nome', e.target.value)}
                    className="input"
                    placeholder="Mario"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="input"
                  placeholder="mario.rossi@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Telefono
                </label>
                <input
                  type="tel"
                  value={formData.telefono || ''}
                  onChange={(e) => handleInputChange('telefono', e.target.value)}
                  className="input"
                  placeholder="+39 333 1234567"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Note
                </label>
                <textarea
                  value={formData.note || ''}
                  onChange={(e) => handleInputChange('note', e.target.value)}
                  className="input"
                  rows={3}
                  placeholder="Note aggiuntive sul referente..."
                />
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 px-4 py-3 bg-gray-50 flex items-center justify-end space-x-3">
              <button
                onClick={closeForm}
                className="btn-secondary"
                disabled={loading}
              >
                Annulla
              </button>
              <button
                onClick={saveReferente}
                className="btn-primary flex items-center space-x-2"
                disabled={loading || !formData.cognome?.trim() || !formData.nome?.trim()}
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>{loading ? 'Salvando...' : 'Salva Referente'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}