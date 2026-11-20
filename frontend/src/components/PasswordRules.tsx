'use client'

import { Check, X } from 'lucide-react'

/** Lunghezza minima della password, la stessa controllata dal server. */
export const PASSWORD_MIN_LENGTH = 8

export function passwordValida(nuova: string, conferma: string) {
  return nuova.length >= PASSWORD_MIN_LENGTH && nuova === conferma
}

/**
 * Regole per la nuova password, mostrate sotto i campi e aggiornate mentre
 * l'utente scrive.
 */
export default function PasswordRules({ nuova, conferma }: { nuova: string; conferma: string }) {
  const regole = [
    { ok: nuova.length >= PASSWORD_MIN_LENGTH, testo: `Almeno ${PASSWORD_MIN_LENGTH} caratteri (ora ${nuova.length})` },
    { ok: nuova.length > 0 && nuova === conferma, testo: 'Le due password coincidono' }
  ]
  return (
    <ul className="text-xs space-y-1 bg-gray-50 border border-gray-200 rounded-md px-3 py-2">
      <li className="text-gray-600 font-medium">Requisiti della nuova password:</li>
      {regole.map(r => (
        <li key={r.testo} className={`flex items-center ${r.ok ? 'text-green-700' : 'text-gray-500'}`}>
          {r.ok ? <Check className="w-3.5 h-3.5 mr-1.5" /> : <X className="w-3.5 h-3.5 mr-1.5" />}
          {r.testo}
        </li>
      ))}
    </ul>
  )
}
