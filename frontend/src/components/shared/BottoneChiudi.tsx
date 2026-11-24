'use client'

import { X } from 'lucide-react'

/**
 * X di chiusura in alto a destra di una finestra (il riquadro deve avere la
 * classe "relative"). Ha data-chiudi: anche il clic fuori dalla finestra la usa.
 */
export default function BottoneChiudi({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      data-chiudi
      onClick={onClick}
      disabled={disabled}
      title="Chiudi"
      aria-label="Chiudi"
      className="absolute top-2 right-2 p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-40 z-10"
    >
      <X className="w-4 h-4" />
    </button>
  )
}
