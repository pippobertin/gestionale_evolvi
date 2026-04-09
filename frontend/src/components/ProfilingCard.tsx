'use client'

import { useState, useMemo } from 'react'
import { Star, ChevronDown, ChevronRight } from 'lucide-react'
import { ProfilingTemplate } from '@/types/prospect'

interface ProfilingCardProps {
  templates: ProfilingTemplate[]
  values: Record<string, any>
  onChange: (values: Record<string, any>) => void
  readOnly: boolean
}

export default function ProfilingCard({ templates, values, onChange, readOnly }: ProfilingCardProps) {
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())

  // Group templates by categoria
  const groupedTemplates = useMemo(() => {
    const groups: Record<string, ProfilingTemplate[]> = {}
    templates.forEach(template => {
      const cat = template.categoria || 'Generale'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(template)
    })
    return groups
  }, [templates])

  // Calculate total score
  const totalScore = useMemo(() => {
    let score = 0
    templates.forEach(template => {
      const value = values[template.id]
      if (value === undefined || value === null || value === '') return

      let normalizedValue = 0

      switch (template.tipo) {
        case 'rating':
          normalizedValue = (typeof value === 'number' ? value : parseInt(value) || 0) / 5
          break
        case 'boolean':
          normalizedValue = value === true || value === 'true' ? 1 : 0
          break
        case 'number':
          // Normalize number: assume 0-100 range
          const numVal = typeof value === 'number' ? value : parseFloat(value) || 0
          normalizedValue = Math.min(numVal / 100, 1)
          break
        case 'select':
          if (template.opzioni && template.opzioni.length > 0) {
            const idx = template.opzioni.indexOf(value)
            normalizedValue = idx >= 0 ? (idx + 1) / template.opzioni.length : 0
          }
          break
        case 'multiselect':
          if (Array.isArray(value) && template.opzioni && template.opzioni.length > 0) {
            normalizedValue = value.length / template.opzioni.length
          }
          break
        case 'text':
        case 'textarea':
          normalizedValue = value && String(value).trim().length > 0 ? 1 : 0
          break
      }

      score += template.peso * normalizedValue
    })
    return Math.round(score * 100) / 100
  }, [templates, values])

  const handleValueChange = (templateId: string, value: any) => {
    const newValues = { ...values, [templateId]: value }
    onChange(newValues)
  }

  const toggleCategory = (category: string) => {
    const newCollapsed = new Set(collapsedCategories)
    if (newCollapsed.has(category)) {
      newCollapsed.delete(category)
    } else {
      newCollapsed.add(category)
    }
    setCollapsedCategories(newCollapsed)
  }

  const renderField = (template: ProfilingTemplate) => {
    const value = values[template.id]

    if (readOnly) {
      return (
        <div className="input bg-gray-50 cursor-not-allowed">
          {renderReadOnlyValue(template, value)}
        </div>
      )
    }

    switch (template.tipo) {
      case 'text':
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => handleValueChange(template.id, e.target.value)}
            className="input"
            placeholder="Inserisci risposta..."
          />
        )

      case 'number':
        return (
          <input
            type="number"
            value={value ?? ''}
            onChange={(e) => handleValueChange(template.id, e.target.value === '' ? '' : parseFloat(e.target.value))}
            className="input"
            placeholder="0"
          />
        )

      case 'select':
        return (
          <select
            value={value || ''}
            onChange={(e) => handleValueChange(template.id, e.target.value)}
            className="input"
          >
            <option value="">Seleziona...</option>
            {(template.opzioni || []).map((opzione) => (
              <option key={opzione} value={opzione}>{opzione}</option>
            ))}
          </select>
        )

      case 'multiselect':
        return (
          <div className="space-y-2">
            {(template.opzioni || []).map((opzione) => {
              const selected = Array.isArray(value) ? value.includes(opzione) : false
              return (
                <label key={opzione} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(e) => {
                      const currentValues = Array.isArray(value) ? [...value] : []
                      if (e.target.checked) {
                        currentValues.push(opzione)
                      } else {
                        const idx = currentValues.indexOf(opzione)
                        if (idx >= 0) currentValues.splice(idx, 1)
                      }
                      handleValueChange(template.id, currentValues)
                    }}
                    className="h-4 w-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">{opzione}</span>
                </label>
              )
            })}
          </div>
        )

      case 'boolean':
        return (
          <button
            type="button"
            onClick={() => handleValueChange(template.id, !value)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              value ? 'bg-primary-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                value ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        )

      case 'textarea':
        return (
          <textarea
            value={value || ''}
            onChange={(e) => handleValueChange(template.id, e.target.value)}
            className="input min-h-[80px]"
            rows={3}
            placeholder="Inserisci risposta..."
          />
        )

      case 'rating':
        const ratingValue = typeof value === 'number' ? value : parseInt(value) || 0
        return (
          <div className="flex items-center space-x-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => handleValueChange(template.id, star === ratingValue ? 0 : star)}
                className="focus:outline-none"
              >
                <Star
                  className={`w-6 h-6 transition-colors ${
                    star <= ratingValue
                      ? 'text-yellow-400 fill-yellow-400'
                      : 'text-gray-300'
                  }`}
                />
              </button>
            ))}
            <span className="ml-2 text-sm text-gray-500">
              {ratingValue > 0 ? `${ratingValue}/5` : 'Non valutato'}
            </span>
          </div>
        )

      default:
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => handleValueChange(template.id, e.target.value)}
            className="input"
          />
        )
    }
  }

  const renderReadOnlyValue = (template: ProfilingTemplate, value: any) => {
    if (value === undefined || value === null || value === '') return '-'

    switch (template.tipo) {
      case 'boolean':
        return value === true || value === 'true' ? 'Si' : 'No'
      case 'multiselect':
        return Array.isArray(value) ? value.join(', ') : String(value)
      case 'rating':
        const stars = typeof value === 'number' ? value : parseInt(value) || 0
        return (
          <div className="flex items-center space-x-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-4 h-4 ${
                  star <= stars
                    ? 'text-yellow-400 fill-yellow-400'
                    : 'text-gray-300'
                }`}
              />
            ))}
            <span className="ml-2 text-sm text-gray-500">{stars}/5</span>
          </div>
        )
      default:
        return String(value)
    }
  }

  return (
    <div className="space-y-6">
      {Object.entries(groupedTemplates).map(([categoria, categoryTemplates]) => {
        const isCollapsed = collapsedCategories.has(categoria)

        return (
          <div key={categoria} className="border rounded-lg overflow-hidden">
            {/* Category Header */}
            <button
              type="button"
              onClick={() => toggleCategory(categoria)}
              className="w-full px-4 py-3 bg-gray-50 border-b flex items-center justify-between hover:bg-gray-100 transition-colors"
            >
              <h4 className="font-medium text-gray-900">{categoria}</h4>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-500">{categoryTemplates.length} domande</span>
                {isCollapsed ? (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </div>
            </button>

            {/* Category Content */}
            {!isCollapsed && (
              <div className="p-4 space-y-4">
                {categoryTemplates.map((template) => (
                  <div key={template.id}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {template.domanda}
                      {template.peso > 0 && (
                        <span className="ml-2 text-xs text-gray-400">(peso: {template.peso})</span>
                      )}
                    </label>
                    {renderField(template)}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Score Summary */}
      <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Star className="w-5 h-5 text-primary-600" />
            <h4 className="font-medium text-primary-900">Punteggio Complessivo</h4>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-2xl font-bold text-primary-700">{totalScore}</span>
            <span className="text-sm text-primary-600">punti</span>
          </div>
        </div>
        <p className="text-xs text-primary-600 mt-1">
          Calcolato come somma di (peso x valore normalizzato) per ciascuna domanda
        </p>
      </div>
    </div>
  )
}
