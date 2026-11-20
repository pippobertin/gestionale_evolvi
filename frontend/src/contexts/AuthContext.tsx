'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import { resetDbToken } from '@/lib/supabase'
import type { Permesso, Ruolo } from '@/lib/ruoli'

interface User {
  id: string
  email: string
  nome: string
  cognome: string
  livello_permessi: Ruolo
  permessi?: Permesso[]
  nome_completo: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; requiresPasswordChange?: boolean }>
  logout: () => Promise<void>
  isAdmin: () => boolean
  isOdv: () => boolean
  haPermesso: (permesso: Permesso) => boolean
  canEdit: (createdBy?: string) => boolean
  canDelete: (createdBy?: string) => boolean
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [avvisoNegato, setAvvisoNegato] = useState<string | null>(null)
  const { data: session, status } = useSession()

  // Operazioni negate per permessi (fase 4C): avviso unico, da qualunque punto
  // arrivino (API del gestionale o scritture dirette nel database)
  useEffect(() => {
    const w = window as any
    if (w.__gestionaleFetchPermessi) return
    const originale = window.fetch.bind(window)
    w.__gestionaleFetchPermessi = true
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const risposta = await originale(...args)
      try {
        if (risposta.status >= 400) {
          const url = typeof args[0] === 'string' ? args[0] : args[0] instanceof URL ? args[0].href : (args[0] as Request).url
          const nostra = risposta.headers.get('x-gestionale-negato') === '1'
          const database = url.includes('/rest/v1/')
          if (nostra || database) {
            const dati = await risposta.clone().json().catch(() => null)
            const messaggio = nostra ? dati?.error : (dati?.code === '42501' && /^Permesso negato/.test(dati?.message || '') ? dati.message : null)
            if (messaggio) {
              setAvvisoNegato(messaggio)
              setTimeout(() => setAvvisoNegato(null), 7000)
            }
          }
        }
      } catch { /* l'avviso non deve mai interferire con la richiesta */ }
      return risposta
    }
  }, [])

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

  const isOdv = () => user?.livello_permessi === 'odv'

  /** Permessi configurabili (fase 4C): gli amministratori li hanno tutti. */
  const haPermesso = (permesso: Permesso) => {
    if (!user) return false
    if (user.livello_permessi === 'admin') return true
    return !!user.permessi?.includes(permesso)
  }

  const canEdit = (createdBy?: string) => {
    if (!user) return false
    if (isAdmin()) return true
    return !createdBy || createdBy === user.id
  }

  // Eliminazione delle entità principali (clienti, prospect, progetti, bandi):
  // dalla fase 4C dipende dal permesso del ruolo, non da chi le ha create
  const canDelete = (_createdBy?: string) => haPermesso('entita.elimina')

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      logout,
      isAdmin,
      isOdv,
      haPermesso,
      canEdit,
      canDelete,
      changePassword
    }}>
      {children}
      {avvisoNegato && (
        <div className="fixed bottom-4 right-4 z-[100] max-w-sm bg-amber-50 border border-amber-300 text-amber-900 text-sm rounded-lg shadow-lg px-4 py-3 flex items-start gap-3" role="alert">
          <span className="flex-1">
            <strong className="block">Operazione non consentita</strong>
            {avvisoNegato.replace(/^Permesso negato: /, 'Il tuo ruolo non permette di: ')}.
            <span className="block text-xs text-amber-700 mt-1">Se ti serve, chiedi a un amministratore.</span>
          </span>
          <button onClick={() => setAvvisoNegato(null)} className="text-amber-700 hover:text-amber-900" aria-label="Chiudi">×</button>
        </div>
      )}
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