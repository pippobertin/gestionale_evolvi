'use client'

import { useState, useEffect } from 'react'
import {
  Users,
  UserCheck,
  UserX,
  Trash2,
  Shield,
  User,
  MoreHorizontal,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { LoadingSpinner } from './shared'

interface User {
  id: string
  email: string
  nome: string
  cognome: string
  livello_permessi: 'admin' | 'collaboratore'
  attivo: boolean
  created_at: string
  updated_at: string
  ultimo_accesso?: string
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Errore nel caricamento utenti')
      }

      setUsers(data.users)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Errore del server')
    } finally {
      setLoading(false)
    }
  }

  const updateUser = async (userId: string, updates: Partial<User>) => {
    setActionLoading(userId)
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Errore nell\'aggiornamento')
      }

      setUsers(prev => prev.map(user =>
        user.id === userId ? { ...user, ...updates } : user
      ))
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Errore del server')
    } finally {
      setActionLoading(null)
    }
  }

  const deleteUser = async (userId: string) => {
    setActionLoading(userId)
    try {
      const token = localStorage.getItem('auth_token')
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Errore nell\'eliminazione')
      }

      setUsers(prev => prev.filter(user => user.id !== userId))
      setShowDeleteModal(null)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Errore del server')
    } finally {
      setActionLoading(null)
    }
  }

  const toggleUserStatus = (user: User) => {
    updateUser(user.id, { attivo: !user.attivo })
  }

  const changeUserRole = (user: User) => {
    const newRole = user.livello_permessi === 'admin' ? 'collaboratore' : 'admin'
    updateUser(user.id, { livello_permessi: newRole })
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="large" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Gestione Utenti</h1>
            <p className="text-gray-600">Gestisci utenti, permessi e accessi</p>
          </div>
        </div>
        <div className="text-sm text-gray-500">
          {users.length} utenti totali
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5" />
          <span>{error}</span>
          <button
            onClick={() => setError('')}
            className="ml-auto text-red-600 hover:text-red-700"
          >
            ×
          </button>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900">Lista Utenti</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Utente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ruolo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Registrato
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ultimo Accesso
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Azioni
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                        <span className="text-teal-600 font-semibold text-sm">
                          {user.nome?.[0]?.toUpperCase() || 'U'}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {user.nome} {user.cognome}
                        </div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.livello_permessi === 'admin'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {user.livello_permessi === 'admin' ? (
                        <><Shield className="w-3 h-3 mr-1" /> Amministratore</>
                      ) : (
                        <><User className="w-3 h-3 mr-1" /> Collaboratore</>
                      )}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.attivo
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {user.attivo ? (
                        <><CheckCircle className="w-3 h-3 mr-1" /> Attivo</>
                      ) : (
                        <><XCircle className="w-3 h-3 mr-1" /> Bloccato</>
                      )}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(user.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.ultimo_accesso ? formatDate(user.ultimo_accesso) : 'Mai'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      {/* Toggle Status */}
                      <button
                        onClick={() => toggleUserStatus(user)}
                        disabled={actionLoading === user.id}
                        className={`p-2 rounded-lg transition-colors ${
                          user.attivo
                            ? 'text-red-600 hover:bg-red-50'
                            : 'text-green-600 hover:bg-green-50'
                        }`}
                        title={user.attivo ? 'Blocca utente' : 'Attiva utente'}
                      >
                        {actionLoading === user.id ? (
                          <LoadingSpinner size="small" />
                        ) : user.attivo ? (
                          <UserX className="w-4 h-4" />
                        ) : (
                          <UserCheck className="w-4 h-4" />
                        )}
                      </button>

                      {/* Change Role */}
                      <button
                        onClick={() => changeUserRole(user)}
                        disabled={actionLoading === user.id}
                        className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                        title={`Cambia in ${user.livello_permessi === 'admin' ? 'Collaboratore' : 'Amministratore'}`}
                      >
                        <Shield className="w-4 h-4" />
                      </button>

                      {/* Delete User */}
                      <button
                        onClick={() => setShowDeleteModal(user.id)}
                        disabled={actionLoading === user.id}
                        className="p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                        title="Elimina utente"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {users.length === 0 && (
          <div className="text-center py-12">
            <Users className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Nessun utente</h3>
            <p className="mt-1 text-sm text-gray-500">Non ci sono utenti registrati nel sistema.</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Conferma Eliminazione</h3>
                <p className="text-sm text-gray-500">Questa azione non può essere annullata</p>
              </div>
            </div>

            <p className="text-gray-700 mb-6">
              Sei sicuro di voler eliminare questo utente? Tutti i suoi dati verranno rimossi definitivamente.
            </p>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteModal(null)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={() => showDeleteModal && deleteUser(showDeleteModal)}
                disabled={actionLoading === showDeleteModal}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
              >
                {actionLoading === showDeleteModal ? (
                  <LoadingSpinner size="small" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>Elimina</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}