'use client'

import { useState, useEffect } from 'react'
import {
  Users,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  UserPlus,
  UserMinus,
  Palette
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Gruppo {
  id: string
  nome: string
  descrizione: string
  colore_hex: string
  created_at: string
}

interface Utente {
  id: string
  nome: string
  cognome: string
  email: string
  ruolo: string
  gruppo_id?: string
}

export default function GroupsManagement() {
  const [gruppi, setGruppi] = useState<Gruppo[]>([])
  const [utenti, setUtenti] = useState<Utente[]>([])
  const [loading, setLoading] = useState(false)
  const [editingGroup, setEditingGroup] = useState<string | null>(null)
  const [showNewGroupForm, setShowNewGroupForm] = useState(false)

  const [newGroup, setNewGroup] = useState({
    nome: '',
    descrizione: '',
    colore_hex: '#3B82F6'
  })

  const [editGroup, setEditGroup] = useState({
    nome: '',
    descrizione: '',
    colore_hex: '#3B82F6'
  })

  const coloriPredefiniti = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
    '#8B5CF6', '#06B6D4', '#84CC16', '#F97316'
  ]

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)

      // Carica gruppi
      const { data: gruppiData, error: gruppiError } = await supabase
        .from('scadenze_bandi_gruppi_utenti')
        .select('*')
        .order('nome')

      if (gruppiError) throw gruppiError
      setGruppi(gruppiData || [])

      // Carica utenti
      const { data: utentiData, error: utentiError } = await supabase
        .from('scadenze_bandi_utenti')
        .select('*')
        .order('nome')

      if (utentiError) throw utentiError
      setUtenti(utentiData || [])

    } catch (error) {
      console.error('Errore caricamento dati:', error)
      alert('Errore nel caricamento dei dati')
    } finally {
      setLoading(false)
    }
  }

  const createGroup = async () => {
    if (!newGroup.nome.trim()) {
      alert('Nome gruppo richiesto')
      return
    }

    try {
      setLoading(true)
      const { error } = await supabase
        .from('scadenze_bandi_gruppi_utenti')
        .insert([newGroup])

      if (error) throw error

      setNewGroup({ nome: '', descrizione: '', colore_hex: '#3B82F6' })
      setShowNewGroupForm(false)
      await loadData()
    } catch (error: any) {
      console.error('Errore creazione gruppo:', error)
      alert('Errore nella creazione del gruppo: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const updateGroup = async (id: string) => {
    if (!editGroup.nome.trim()) {
      alert('Nome gruppo richiesto')
      return
    }

    try {
      setLoading(true)
      const { error } = await supabase
        .from('scadenze_bandi_gruppi_utenti')
        .update(editGroup)
        .eq('id', id)

      if (error) throw error

      setEditingGroup(null)
      await loadData()
    } catch (error: any) {
      console.error('Errore aggiornamento gruppo:', error)
      alert('Errore nell\'aggiornamento del gruppo: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const deleteGroup = async (id: string, nome: string) => {
    if (!confirm(`Sei sicuro di voler eliminare il gruppo "${nome}"?`)) return

    try {
      setLoading(true)

      // Prima rimuovi il gruppo dagli utenti
      await supabase
        .from('scadenze_bandi_utenti')
        .update({ gruppo_id: null })
        .eq('gruppo_id', id)

      // Poi elimina il gruppo
      const { error } = await supabase
        .from('scadenze_bandi_gruppi_utenti')
        .delete()
        .eq('id', id)

      if (error) throw error
      await loadData()
    } catch (error: any) {
      console.error('Errore eliminazione gruppo:', error)
      alert('Errore nell\'eliminazione del gruppo: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const assignUserToGroup = async (userId: string, groupId: string | null) => {
    try {
      const { error } = await supabase
        .from('scadenze_bandi_utenti')
        .update({ gruppo_id: groupId })
        .eq('id', userId)

      if (error) throw error
      await loadData()
    } catch (error: any) {
      console.error('Errore assegnazione utente:', error)
      alert('Errore nell\'assegnazione dell\'utente: ' + error.message)
    }
  }

  const getGroupName = (groupId: string | null | undefined) => {
    if (!groupId) return 'Nessun gruppo'
    const group = gruppi.find(g => g.id === groupId)
    return group?.nome || 'Gruppo non trovato'
  }

  const getUsersInGroup = (groupId: string) => {
    return utenti.filter(u => u.gruppo_id === groupId)
  }

  const getUsersWithoutGroup = () => {
    return utenti.filter(u => !u.gruppo_id)
  }

  const startEditGroup = (gruppo: Gruppo) => {
    setEditGroup({
      nome: gruppo.nome,
      descrizione: gruppo.descrizione,
      colore_hex: gruppo.colore_hex
    })
    setEditingGroup(gruppo.id)
  }

  if (loading && gruppi.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mr-3"></div>
        <span className="text-gray-600">Caricamento gruppi...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Users className="h-6 w-6 text-primary-500" />
          <h2 className="text-xl font-semibold text-gray-900">Gestione Gruppi</h2>
        </div>
        <button
          onClick={() => setShowNewGroupForm(true)}
          className="btn-primary flex items-center space-x-2"
          disabled={loading}
        >
          <Plus className="h-4 w-4" />
          <span>Nuovo Gruppo</span>
        </button>
      </div>

      {/* Nuovo Gruppo Form */}
      {showNewGroupForm && (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h3 className="text-lg font-medium mb-4">Crea Nuovo Gruppo</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nome Gruppo *
              </label>
              <input
                type="text"
                value={newGroup.nome}
                onChange={(e) => setNewGroup({...newGroup, nome: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Es. Team Amministrativo"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Descrizione
              </label>
              <input
                type="text"
                value={newGroup.descrizione}
                onChange={(e) => setNewGroup({...newGroup, descrizione: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Descrizione del gruppo"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Colore
              </label>
              <div className="flex items-center space-x-2">
                {coloriPredefiniti.map(colore => (
                  <button
                    key={colore}
                    onClick={() => setNewGroup({...newGroup, colore_hex: colore})}
                    className={`w-8 h-8 rounded-full border-2 ${
                      newGroup.colore_hex === colore ? 'border-gray-800' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: colore }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end space-x-3 mt-4">
            <button
              onClick={() => setShowNewGroupForm(false)}
              className="btn-secondary"
              disabled={loading}
            >
              <X className="h-4 w-4 mr-2" />
              Annulla
            </button>
            <button
              onClick={createGroup}
              className="btn-primary"
              disabled={loading}
            >
              <Save className="h-4 w-4 mr-2" />
              Salva Gruppo
            </button>
          </div>
        </div>
      )}

      {/* Lista Gruppi */}
      <div className="space-y-4">
        {gruppi.map((gruppo) => (
          <div key={gruppo.id} className="bg-white rounded-lg border border-gray-200 p-4">
            {editingGroup === gruppo.id ? (
              // Form di modifica
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Nome</label>
                    <input
                      type="text"
                      value={editGroup.nome}
                      onChange={(e) => setEditGroup({...editGroup, nome: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Descrizione</label>
                    <input
                      type="text"
                      value={editGroup.descrizione}
                      onChange={(e) => setEditGroup({...editGroup, descrizione: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Colore</label>
                    <div className="flex items-center space-x-2">
                      {coloriPredefiniti.map(colore => (
                        <button
                          key={colore}
                          onClick={() => setEditGroup({...editGroup, colore_hex: colore})}
                          className={`w-8 h-8 rounded-full border-2 ${
                            editGroup.colore_hex === colore ? 'border-gray-800' : 'border-gray-300'
                          }`}
                          style={{ backgroundColor: colore }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setEditingGroup(null)}
                    className="btn-secondary"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Annulla
                  </button>
                  <button
                    onClick={() => updateGroup(gruppo.id)}
                    className="btn-primary"
                    disabled={loading}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Salva
                  </button>
                </div>
              </div>
            ) : (
              // Vista normale
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: gruppo.colore_hex }}
                    />
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">{gruppo.nome}</h3>
                      <p className="text-sm text-gray-600">{gruppo.descrizione}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => startEditGroup(gruppo)}
                      className="btn-secondary text-sm"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteGroup(gruppo.id, gruppo.nome)}
                      className="btn-danger text-sm"
                      disabled={getUsersInGroup(gruppo.id).length > 0}
                      title={getUsersInGroup(gruppo.id).length > 0 ? 'Rimuovi prima tutti gli utenti dal gruppo' : 'Elimina gruppo'}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Utenti nel gruppo */}
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    Utenti in questo gruppo ({getUsersInGroup(gruppo.id).length})
                  </h4>
                  <div className="space-y-2">
                    {getUsersInGroup(gruppo.id).map(utente => (
                      <div key={utente.id} className="flex items-center justify-between bg-gray-50 rounded p-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium">{utente.nome} {utente.cognome}</span>
                          <span className="text-xs text-gray-500">({utente.ruolo})</span>
                          <span className="text-xs text-gray-400">{utente.email}</span>
                        </div>
                        <button
                          onClick={() => assignUserToGroup(utente.id, null)}
                          className="text-red-600 hover:text-red-800"
                          title="Rimuovi dal gruppo"
                        >
                          <UserMinus className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    {getUsersInGroup(gruppo.id).length === 0 && (
                      <p className="text-sm text-gray-500 italic">Nessun utente in questo gruppo</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {gruppi.length === 0 && (
          <div className="text-center py-12">
            <Users className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Nessun gruppo</h3>
            <p className="mt-1 text-sm text-gray-500">
              Inizia creando il tuo primo gruppo di utenti.
            </p>
          </div>
        )}
      </div>

      {/* Utenti senza gruppo */}
      {getUsersWithoutGroup().length > 0 && (
        <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4">
          <h3 className="text-lg font-medium text-yellow-800 mb-3">
            Utenti senza gruppo ({getUsersWithoutGroup().length})
          </h3>
          <div className="space-y-2">
            {getUsersWithoutGroup().map(utente => (
              <div key={utente.id} className="flex items-center justify-between bg-white rounded p-2">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium">{utente.nome} {utente.cognome}</span>
                  <span className="text-xs text-gray-500">({utente.ruolo})</span>
                  <span className="text-xs text-gray-400">{utente.email}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <select
                    onChange={(e) => assignUserToGroup(utente.id, e.target.value || null)}
                    className="text-sm border border-gray-300 rounded px-2 py-1"
                  >
                    <option value="">Assegna a gruppo...</option>
                    {gruppi.map(gruppo => (
                      <option key={gruppo.id} value={gruppo.id}>{gruppo.nome}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}