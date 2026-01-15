'use client'

import { useState, useEffect } from 'react'
import { Eye, EyeOff, User, Mail, Lock } from 'lucide-react'
import Image from 'next/image'
import { useAuth } from '@/contexts/AuthContext'
import { LoadingSpinner } from './shared'
import { signIn } from 'next-auth/react'

export default function AuthForm() {
  const [isLogin, setIsLogin] = useState(true)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')

  // Check sessionStorage for password change state
  const [showPasswordChange, setShowPasswordChange] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('pendingPasswordChange') === 'true'
    }
    return false
  })

  const [passwordChangeData, setPasswordChangeData] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('passwordChangeData')
      if (saved) {
        try {
          return JSON.parse(saved)
        } catch (e) {
          console.error('Error parsing saved password change data:', e)
        }
      }
    }
    return {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    }
  })

  const [componentKey, setComponentKey] = useState(0) // Forza re-render

  // Debug: monitora i cambiamenti di showPasswordChange
  useEffect(() => {
    console.log('useEffect - showPasswordChange changed to:', showPasswordChange)
    if (showPasswordChange) {
      console.log('Password change form should now be visible')
      // Reset loading quando il form di cambio password è attivo
      setLoading(false)
    }
  }, [showPasswordChange])

  // Clean up sessionStorage on component mount if user is already logged in
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token')
      const pendingChange = sessionStorage.getItem('pendingPasswordChange')

      console.log('Component mount - token:', !!token, 'pendingPasswordChange:', pendingChange)

      // If user is already logged in and there's no pending password change, clean up
      if (token && !pendingChange) {
        sessionStorage.removeItem('pendingPasswordChange')
        sessionStorage.removeItem('passwordChangeData')
        console.log('Cleaned up old sessionStorage data')
      }
    }
  }, [])

  // Debug function to manually clear sessionStorage
  const clearPasswordChangeState = () => {
    sessionStorage.removeItem('pendingPasswordChange')
    sessionStorage.removeItem('passwordChangeData')
    setShowPasswordChange(false)
    console.log('Manually cleared password change state')
  }

  // Force re-render when password change is needed
  const activatePasswordChangeForm = (currentPassword: string) => {
    console.log('🔄 ACTIVATING PASSWORD CHANGE FORM')

    const data = {
      currentPassword,
      newPassword: '',
      confirmPassword: ''
    }

    // Save to sessionStorage to survive Fast Refresh
    sessionStorage.setItem('pendingPasswordChange', 'true')
    sessionStorage.setItem('passwordChangeData', JSON.stringify(data))

    setPasswordChangeData(data)
    setShowPasswordChange(true)
    setLoading(false)
    setComponentKey(prev => prev + 1) // Force complete re-render
    console.log('🔄 Password change form activated, saved to sessionStorage')
  }

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    nome: '',
    cognome: ''
  })

  const { login, signup, changePassword } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    let shouldResetLoading = true

    try {
      let result

      if (isLogin) {
        result = await login(formData.email, formData.password)

        // Debug: logga il risultato del login
        console.log('Login result:', result)

        // Se il login è riuscito ma richiede cambio password
        if (result.success && result.requiresPasswordChange) {
          console.log('Password change required - showing form')
          console.log('Current showPasswordChange state:', showPasswordChange)

          // Usa la nuova funzione per attivare il form
          setTimeout(() => {
            activatePasswordChangeForm(formData.password)
          }, 0)

          shouldResetLoading = false // Non resettare nel finally
          console.log('Scheduled password change form activation')
          return
        }
      } else {
        result = await signup(formData.email, formData.password, formData.nome, formData.cognome)
      }

      if (!result.success) {
        setError(result.error || 'Errore durante l\'autenticazione')
      }
    } catch (error) {
      setError('Errore di connessione')
    } finally {
      if (shouldResetLoading) {
        console.log('Finally block: resetting loading to false')
        setLoading(false)
      } else {
        console.log('Finally block: keeping loading active for password change')
      }
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validazioni
    if (passwordChangeData.newPassword.length < 8) {
      setError('La nuova password deve essere di almeno 8 caratteri')
      return
    }

    if (passwordChangeData.newPassword !== passwordChangeData.confirmPassword) {
      setError('Le password non coincidono')
      return
    }

    try {
      const result = await changePassword(passwordChangeData.currentPassword, passwordChangeData.newPassword)

      if (result.success) {
        // Cambio password riuscito, chiudi il form e completa il login
        sessionStorage.removeItem('pendingPasswordChange')
        sessionStorage.removeItem('passwordChangeData')
        setShowPasswordChange(false)
        setLoading(false)
        // L'utente è ora loggato con la nuova password
      } else {
        setError(result.error || 'Errore durante il cambio password')
      }
    } catch (error) {
      setError('Errore di connessione')
    }
  }

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    setError('')
    try {
      const result = await signIn('google', {
        callbackUrl: '/',
        redirect: false
      })
      if (result?.error) {
        setError('Errore durante l\'autenticazione con Google')
      }
    } catch (error) {
      setError('Errore di connessione con Google')
    } finally {
      setGoogleLoading(false)
    }
  }

  const toggleMode = () => {
    setIsLogin(!isLogin)
    setError('')

    // Clear any pending password change when switching modes
    sessionStorage.removeItem('pendingPasswordChange')
    sessionStorage.removeItem('passwordChangeData')
    setShowPasswordChange(false)

    setFormData({
      email: '',
      password: '',
      nome: '',
      cognome: ''
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-emerald-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="relative w-48 h-48 rounded-2xl overflow-hidden">
              <Image
                src="/evolvi-logo.png"
                alt="Metodo Evolvi Logo"
                fill
                className="object-contain"
                priority
                style={{
                  filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))',
                  mixBlendMode: 'multiply'
                }}
              />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Gestionale Evolvi</h1>
          <p className="mt-2 text-gray-600">
            {isLogin ? 'Accedi al tuo account' : 'Crea un nuovo account'}
          </p>
        </div>

        {/* Form */}
        <div key={componentKey} className="bg-white rounded-lg shadow-lg p-8">
          {console.log('AuthForm render - showPasswordChange:', showPasswordChange, 'loading:', loading, 'componentKey:', componentKey)}
          {showPasswordChange ? (
            /* Password Change Form */
            <form onSubmit={handlePasswordChange} className="space-y-6">{console.log('Rendering password change form')}
              <div className="text-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Cambio Password Obbligatorio</h2>
                <p className="text-sm text-gray-600">È necessario cambiare la password temporanea per continuare</p>
              </div>

              {/* Current Password (hidden) */}
              <input type="hidden" value={passwordChangeData.currentPassword} />

              {/* New Password */}
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
                  Nuova Password *
                </label>
                <div className="mt-1 relative">
                  <input
                    id="newPassword"
                    name="newPassword"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={passwordChangeData.newPassword}
                    onChange={(e) => setPasswordChangeData(prev => ({ ...prev, newPassword: e.target.value }))}
                    className="appearance-none block w-full px-3 py-2 pl-10 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-teal-500 focus:border-teal-500 text-sm"
                    placeholder="Inserisci la nuova password (min. 8 caratteri)"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                  Conferma Nuova Password *
                </label>
                <div className="mt-1 relative">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={passwordChangeData.confirmPassword}
                    onChange={(e) => setPasswordChangeData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    className="appearance-none block w-full px-3 py-2 pl-10 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-teal-500 focus:border-teal-500 text-sm"
                    placeholder="Conferma la nuova password"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <LoadingSpinner size="small" />
                ) : (
                  'Cambia Password e Continua'
                )}
              </button>
            </form>
          ) : (
            /* Normal Login/Signup Form */
            <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nome e Cognome (solo per signup) */}
            {!isLogin && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="nome" className="block text-sm font-medium text-gray-700 mb-1">
                    Nome
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      id="nome"
                      name="nome"
                      type="text"
                      required={!isLogin}
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      placeholder="Il tuo nome"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="cognome" className="block text-sm font-medium text-gray-700 mb-1">
                    Cognome
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      id="cognome"
                      name="cognome"
                      type="text"
                      required={!isLogin}
                      value={formData.cognome}
                      onChange={(e) => setFormData({ ...formData, cognome: e.target.value })}
                      className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                      placeholder="Il tuo cognome"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  placeholder="nome@esempio.com"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pl-10 pr-10 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  placeholder="La tua password"
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {!isLogin && (
                <p className="mt-1 text-sm text-gray-500">Minimo 6 caratteri</p>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                {error}
              </div>
            )}

            {/* Google Sign In Button */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">oppure</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading || loading}
              className="w-full flex justify-center items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {googleLoading ? (
                <LoadingSpinner size="small" />
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Accedi con Google
                </>
              )}
            </button>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <LoadingSpinner size="small" />
              ) : (
                isLogin ? 'Accedi' : 'Registrati'
              )}
            </button>
          </form>
          )}

          {/* Toggle Mode (only show for normal login/signup) */}
          {!showPasswordChange && (
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={toggleMode}
              className="text-teal-600 hover:text-teal-500 text-sm font-medium"
            >
              {isLogin ? 'Non hai un account? Registrati' : 'Hai già un account? Accedi'}
            </button>
          </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-500">
          <p>© 2025 Evolvi. Tutti i diritti riservati.</p>
        </div>
      </div>
    </div>
  )
}