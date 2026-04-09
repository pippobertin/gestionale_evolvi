'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
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
  signup: (email: string, password: string, nome: string, cognome: string) => Promise<{ success: boolean; error?: string }>
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

  const handleGoogleUser = async (googleUser: any) => {
    try {
      // Cerca utente esistente per email
      const { data: existingUser, error } = await supabase
        .from('scadenze_bandi_utenti')
        .select('*')
        .eq('email', googleUser.email)
        .single()

      let userData: User | null = null

      if (existingUser) {
        userData = {
          id: existingUser.id,
          email: existingUser.email,
          nome: existingUser.nome,
          cognome: existingUser.cognome,
          livello_permessi: existingUser.livello_permessi,
          nome_completo: `${existingUser.nome} ${existingUser.cognome}`
        }
      } else {
        // Nuovo utente Google, crealo nel database
        const [nome, cognome] = (googleUser.name || '').split(' ')
        const { data: newUser, error: insertError } = await supabase
          .from('scadenze_bandi_utenti')
          .insert({
            email: googleUser.email,
            nome: nome || googleUser.given_name || 'Nome',
            cognome: cognome || googleUser.family_name || 'Cognome',
            livello_permessi: 'collaboratore',
            password_hash: null
          })
          .select()
          .single()

        if (newUser) {
          userData = {
            id: newUser.id,
            email: newUser.email,
            nome: newUser.nome,
            cognome: newUser.cognome,
            livello_permessi: newUser.livello_permessi,
            nome_completo: `${newUser.nome} ${newUser.cognome}`
          }
        }
      }

      if (userData) {
        setUser(userData)

        // Generate JWT for API route authentication
        // Google OAuth users need this for routes that check auth_token cookie/header
        try {
          const jwtResponse = await fetch('/api/auth/google-jwt')
          if (jwtResponse.ok) {
            const jwtData = await jwtResponse.json()
            if (jwtData.token) {
              localStorage.setItem('auth_token', jwtData.token)
              console.log('✅ JWT created for Google OAuth user')
            }
          }
        } catch (jwtError) {
          console.error('⚠️ Failed to create JWT for Google user:', jwtError)
        }
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

      console.log('AuthContext login response:', data)

      if (response.ok) {
        localStorage.setItem('auth_token', data.token)

        // Only set user if password change is NOT required
        const requiresPasswordChange = data.requiresPasswordChange || false
        if (!requiresPasswordChange) {
          console.log('✅ No password change required, setting user')
          setUser(data.user)
        } else {
          console.log('🔄 Password change required, NOT setting user yet')
          // Store user data temporarily for after password change
          localStorage.setItem('pending_user_data', JSON.stringify(data.user))
        }

        const result = {
          success: true,
          requiresPasswordChange
        }
        console.log('AuthContext returning:', result)
        return result
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
      // Se c'è una sessione NextAuth attiva
      if (session) {
        const { signOut } = await import('next-auth/react')
        await signOut({ redirect: false })
      }

      // Logout tradizionale
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
      signup,
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