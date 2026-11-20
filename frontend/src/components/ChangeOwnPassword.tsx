'use client'

import { useState } from 'react'
import { Key, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import PasswordRules, { passwordValida, PASSWORD_MIN_LENGTH } from './PasswordRules'

/**
 * Impostazioni → La mia password.
 * Cambio volontario della propria password (accesso con email e password).
 * Dopo il cambio il server chiude le altre sessioni aperte dell'utente.
 */
export default function ChangeOwnPassword() {
  const { changePassword } = useAuth()
  const [attuale, setAttuale] = useState('')
  const [nuova, setNuova] = useState('')
  const [conferma, setConferma] = useState('')
  const [mostra, setMostra] = useState(false)
  const [salvataggio, setSalvataggio] = useState(false)
  const [errore, setErrore] = useState('')
  const [esito, setEsito] = useState('')

  const invia = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrore('')
    setEsito('')
    if (nuova.length < PASSWORD_MIN_LENGTH) {
      setErrore(`La nuova password deve essere di almeno ${PASSWORD_MIN_LENGTH} caratteri`)
      return
    }
    if (nuova !== conferma) {
      setErrore('Le due password non coincidono')
      return
    }
    if (nuova === attuale) {
      setErrore('La nuova password deve essere diversa da quella attuale')
      return
    }
    setSalvataggio(true)
    const risultato = await changePassword(attuale, nuova)
    setSalvataggio(false)
    if (risultato.success) {
      setAttuale('')
      setNuova('')
      setConferma('')
      setEsito('Password aggiornata. Le sessioni aperte su altri browser o dispositivi sono state chiuse.')
    } else {
      setErrore(risultato.error || 'Errore durante il cambio password')
    }
  }

  const campo = 'block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500'

  return (
    <div className="space-y-3">
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-4 h-4 bg-teal-100 rounded-lg flex items-center justify-center">
          <Key className="w-4 h-4 text-teal-600" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-gray-900">La mia password</h1>
          <p className="text-gray-600">Password usata per l&apos;accesso con email e password</p>
        </div>
      </div>

      <form onSubmit={invia} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3 max-w-md">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password attuale</label>
          <input type={mostra ? 'text' : 'password'} value={attuale} onChange={e => setAttuale(e.target.value)}
            className={campo} autoComplete="current-password" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nuova password</label>
          <input type={mostra ? 'text' : 'password'} value={nuova} onChange={e => setNuova(e.target.value)}
            className={campo} autoComplete="new-password" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Conferma nuova password</label>
          <input type={mostra ? 'text' : 'password'} value={conferma} onChange={e => setConferma(e.target.value)}
            className={campo} autoComplete="new-password" required />
        </div>

        <button type="button" onClick={() => setMostra(!mostra)} className="flex items-center text-xs text-gray-600 hover:text-gray-900">
          {mostra ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
          {mostra ? 'Nascondi le password' : 'Mostra le password'}
        </button>

        <PasswordRules nuova={nuova} conferma={conferma} />

        {errore && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm">{errore}</div>}
        {esito && <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded-md text-sm">{esito}</div>}

        <button type="submit" disabled={salvataggio || !attuale || !passwordValida(nuova, conferma)}
          className="px-4 py-2 rounded-md text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed">
          {salvataggio ? 'Salvataggio…' : 'Cambia password'}
        </button>

        <p className="text-xs text-gray-500">
          Se entri con Google e non conosci la password attuale, chiedi a un amministratore di reimpostarla
          da Impostazioni → Gestione Utenti.
        </p>
      </form>
    </div>
  )
}
