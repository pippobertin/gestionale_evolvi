'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import { resetDbToken } from '@/lib/supabase'

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
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; requiresPasswordChange?: boolean }>
  logout: () => Promise<void>
  isAdmin: () => boolean
  canEdit: (createdBy?: string) => boolean
  canDelete: (createdBy?: string) => boolean
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const { data: session, status } = useSession()

  useEffect(() => {
    // Controlla se c'è una sessione salvata
    checkSession()
  }, [session, status])

  const checkSession = async () => {
    try {
      // Il token di sessione vive solo nel cookie httpOnly: eventuali copie
      // rimaste nel localStorage dalle versioni precedenti vengono eliminate.
      localStorage.removeItem('auth_token')

      // Se c'è una sessione Google OAuth attiva
      if (session?.user) {
        await handleGoogleUser(session.user)
        setLoading(false)
        return
      }

      // Sessione con email e password: il cookie viene inviato in automatico
      const response = await fetch('/api/auth/verify', { cache: 'no-store' })
      if (response.ok) {
        const data = await response.json()
        // Chi deve ancora cambiare la password temporanea rifà il login
        if (!data.requiresPasswordChange) setUser(data.user)
        else setUser(null)
      } else {
        setUser(null)
      }
    } catch (error) {
      console.error('Errore verifica sessione:', error)
    } finally {
      setLoading(false)
    }
  }

  // Utente entrato con Google: il server verifica che sia censito e attivo,
  // rilascia il JWT dell'applicazione e restituisce i suoi dati.
  // Nessuna lettura o creazione di utenti dal browser.
  const handleGoogleUser = async (_googleUser: any) => {
    try {
      const jwtResponse = await fetch('/api/auth/google-jwt')
      if (!jwtResponse.ok) {
        // Account non censito o disattivato: chiudi la sessione Google
        const { signOut } = await import('next-auth/react')
        await signOut({ redirect: false })
        setUser(null)
        return
      }
      const jwtData = await jwtResponse.json()
      resetDbToken()
      if (jwtData.user) {
        setUser(jwtData.user)
      }
    } catch (error) {
      console.error('Errore gestione utente Google:', error)
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
        resetDbToken()

        // Only set user if password change is NOT required
        const requiresPasswordChange = data.requiresPasswordChange || false
        if (!requiresPasswordChange) {
          setUser(data.user)
        } else {
          // Store user data temporarily for after password change
          localStorage.setItem('pending_user_data', JSON.stringify(data.user))
        }

        const result = {
          success: true,
          requiresPasswordChange
        }
        return result
      } else {
        return { success: false, error: data.error || 'Errore durante il login' }
      }
    } catch (error) {
      return { success: false, error: 'Errore di connessione' }
    }
  }

  const logout = async () => {
    try {
      // Se c'è una sessione NextAuth attiva
      if (session) {
        const { signOut } = await import('next-auth/react')
        await signOut({ redirect: false })
      }

      // Cancella il cookie di sessione lato server
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch (error) {
      console.error('Errore logout:', error)
    } finally {
      localStorage.removeItem('chatbot_history')
      resetDbToken()
      setUser(null)
    }
  }

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ currentPassword, newPassword })
      })

      const data = await response.json()

      if (response.ok) {
        console.log('🎉 Password changed successfully')
        // Prima del cambio il badge per il database veniva rifiutato: si richiede subito
        resetDbToken()

        // Check if there's pending user data from first login
        const pendingUserData = localStorage.getItem('pending_user_data')
        if (pendingUserData) {
          console.log('🔄 Setting user from pending data after password change')
          const userData = JSON.parse(pendingUserData)
          setUser({
            ...userData,
            first_login_password_change: false
          })
          localStorage.removeItem('pending_user_data')
        } else if (user) {
          // Update existing user to remove the password change flag
          setUser({
            ...user,
            first_login_password_change: false
          } as any)
        }

        // Clear password change session data
        sessionStorage.removeItem('pendingPasswordChange')
        sessionStorage.removeItem('passwordChangeData')

        return { success: true }
      } else {
        return { success: false, error: data.error || 'Errore durante il cambio password' }
      }
    } catch (error) {
      return { success: false, error: 'Errore di connessione' }
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
      logout,
      isAdmin,
      canEdit,
      canDelete,
      changePassword
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