'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'

interface User {
  id: string
  email: string
  nome: string
  cognome: string
  livello_permessi: 'admin' | 'collaboratore'
  nome_completo: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signup: (email: string, password: string, nome: string, cognome: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  isAdmin: () => boolean
  canEdit: (createdBy?: string) => boolean
  canDelete: (createdBy?: string) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Controlla se c'è una sessione salvata
    checkSession()
  }, [])

  const checkSession = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        setLoading(false)
        return
      }

      // Verifica token con il backend
      const response = await fetch('/api/auth/verify', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const userData = await response.json()
        setUser(userData.user)
      } else {
        localStorage.removeItem('auth_token')
      }
    } catch (error) {
      console.error('Errore verifica sessione:', error)
      localStorage.removeItem('auth_token')
    } finally {
      setLoading(false)
    }
  }

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      })

      const data = await response.json()

      if (response.ok) {
        localStorage.setItem('auth_token', data.token)
        setUser(data.user)
        return { success: true }
      } else {
        return { success: false, error: data.error || 'Errore durante il login' }
      }
    } catch (error) {
      return { success: false, error: 'Errore di connessione' }
    }
  }

  const signup = async (email: string, password: string, nome: string, cognome: string) => {
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password, nome, cognome })
      })

      const data = await response.json()

      if (response.ok) {
        localStorage.setItem('auth_token', data.token)
        setUser(data.user)
        return { success: true }
      } else {
        return { success: false, error: data.error || 'Errore durante la registrazione' }
      }
    } catch (error) {
      return { success: false, error: 'Errore di connessione' }
    }
  }

  const logout = async () => {
    try {
      const token = localStorage.getItem('auth_token')
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
      }
    } catch (error) {
      console.error('Errore logout:', error)
    } finally {
      localStorage.removeItem('auth_token')
      setUser(null)
    }
  }

  const isAdmin = () => {
    return user?.livello_permessi === 'admin'
  }

  const canEdit = (createdBy?: string) => {
    if (!user) return false
    if (isAdmin()) return true
    return !createdBy || createdBy === user.id
  }

  const canDelete = (createdBy?: string) => {
    if (!user) return false
    if (isAdmin()) return true
    return !createdBy || createdBy === user.id
  }

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      signup,
      logout,
      isAdmin,
      canEdit,
      canDelete
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}