interface StatusBadgeProps {
  status: string
  variant?: 'default' | 'bando' | 'progetto' | 'scadenza'
}

export default function StatusBadge({ status, variant = 'default' }: StatusBadgeProps) {
  const getStatusColor = (status: string, variant: string) => {
    if (variant === 'bando') {
      switch (status) {
        case 'APERTO': return 'bg-green-100 text-green-800 border-green-200'
        case 'PROSSIMA_APERTURA': return 'bg-blue-100 text-blue-800 border-blue-200'
        case 'IN_VALUTAZIONE': return 'bg-orange-100 text-orange-800 border-orange-200'
        case 'CHIUSO': return 'bg-gray-100 text-gray-800 border-gray-200'
        default: return 'bg-gray-100 text-gray-600 border-gray-200'
      }
    }

    if (variant === 'progetto') {
      switch (status) {
        case 'DECRETO_ATTESO': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
        case 'DECRETO_RICEVUTO': return 'bg-blue-100 text-blue-800 border-blue-200'
        case 'ACCETTATO': return 'bg-green-100 text-green-800 border-green-200'
        case 'IN_CORSO': return 'bg-purple-100 text-purple-800 border-purple-200'
        case 'COMPLETATO': return 'bg-gray-100 text-gray-800 border-gray-200'
        default: return 'bg-gray-100 text-gray-600 border-gray-200'
      }
    }

    if (variant === 'scadenza') {
      switch (status) {
        case 'non_iniziata': return 'bg-gray-100 text-gray-800 border-gray-200'
        case 'in_corso': return 'bg-blue-100 text-blue-800 border-blue-200'
        case 'completata': return 'bg-green-100 text-green-800 border-green-200'
        case 'in_ritardo': return 'bg-red-100 text-red-800 border-red-200'
        default: return 'bg-gray-100 text-gray-600 border-gray-200'
      }
    }

    // Default colors
    return 'bg-gray-100 text-gray-800 border-gray-200'
  }

  const formatStatusText = (status: string) => {
    return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
  }

  return (
    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor(status, variant)}`}>
      {formatStatusText(status)}
    </span>
  )
}