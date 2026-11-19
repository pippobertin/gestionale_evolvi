'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useSession } from 'next-auth/react'

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
      // Se c'è una sessione Google OAuth attiva
      if (session?.user) {
        // Crea o ottieni utente dal database usando l'email di Google
        await handleGoogleUser(session.user)
        setLoading(false)
        return
      }

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
        localStorage.removeItem('auth_token')
        setUser(null)
        return
      }
      const jwtData = await jwtResponse.json()
      if (jwtData.token) {
        localStorage.setItem('auth_token', jwtData.token)
      }
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
        localStorage.setItem('auth_token', data.token)

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
      localStorage.removeItem('auth_token')
      localStorage.removeItem('chatbot_history')
      setUser(null)
    }
  }

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      const token = localStorage.getItem('auth_token')
      if (!token) {
        return { success: false, error: 'Non autenticato' }
      }

      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      })

      const data = await response.json()

      if (response.ok) {
        console.log('🎉 Password changed successfully')

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