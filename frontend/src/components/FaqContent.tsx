'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  Search,
  ChevronDown,
  ChevronRight,
  BookOpen,
  LogIn,
  Users,
  Layout,
  Building2,
  UserPlus,
  FileText,
  Target,
  Calendar,
  ClipboardCheck,
  Bell,
  FileSignature,
  Receipt,
  Mail,
  Pen,
  HardDrive,
  FolderOpen,
  BarChart3,
  Settings,
  Wrench,
  BookA,
  Loader2
} from 'lucide-react'

interface FaqSection {
  id: string
  title: string
  subsections: FaqSubsection[]
}

interface FaqSubsection {
  title: string
  content: string
  sectionId: string
  sectionTitle: string
}

const SECTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  '1': BookOpen,
  '2': LogIn,
  '3': Users,
  '4': Layout,
  '5': Building2,
  '6': UserPlus,
  '7': FileText,
  '8': Target,
  '9': Calendar,
  '10': ClipboardCheck,
  '11': Bell,
  '12': FileSignature,
  '13': Receipt,
  '14': Mail,
  '15': Pen,
  '16': HardDrive,
  '17': FolderOpen,
  '18': BarChart3,
  '19': Settings,
  '20': Wrench,
  '21': BookA
}

function parseFaqMarkdown(markdown: string): FaqSection[] {
  const sections: FaqSection[] = []
  const lines = markdown.split('\n')
  let currentSection: FaqSection | null = null
  let currentSubsection: FaqSubsection | null = null
  let contentLines: string[] = []

  const flushSubsection = () => {
    if (currentSubsection && currentSection) {
      currentSubsection.content = contentLines.join('\n').trim()
      currentSection.subsections.push(currentSubsection)
      currentSubsection = null
      contentLines = []
    }
  }

  for (const line of lines) {
    const sectionMatch = line.match(/^## (\d+)\.\s+(.+)/)
    if (sectionMatch) {
      flushSubsection()
      if (currentSection) sections.push(currentSection)
      currentSection = {
        id: sectionMatch[1],
        title: sectionMatch[2],
        subsections: []
      }
      continue
    }

    const subsectionMatch = line.match(/^### (.+)/)
    if (subsectionMatch && currentSection) {
      flushSubsection()
      currentSubsection = {
        title: subsectionMatch[1],
        content: '',
        sectionId: currentSection.id,
        sectionTitle: currentSection.title
      }
      continue
    }

    if (currentSubsection) {
      contentLines.push(line)
    }
  }

  flushSubsection()
  if (currentSection) sections.push(currentSection)

  return sections
}

function renderMarkdownLine(text: string, searchQuery: string) {
  // Process inline markdown: bold, italic, code, backticks
  let parts: (string | React.ReactElement)[] = [text]

  // Bold **text**
  parts = parts.flatMap((part, i) => {
    if (typeof part !== 'string') return [part]
    const result: (string | React.ReactElement)[] = []
    const regex = /\*\*(.+?)\*\*/g
    let lastIdx = 0
    let match
    while ((match = regex.exec(part)) !== null) {
      if (match.index > lastIdx) result.push(part.slice(lastIdx, match.index))
      result.push(<strong key={`b-${i}-${match.index}`} className="font-semibold text-gray-900">{match[1]}</strong>)
      lastIdx = match.index + match[0].length
    }
    if (lastIdx < part.length) result.push(part.slice(lastIdx))
    return result.length ? result : [part]
  })

  // Italic *text* (not inside bold)
  parts = parts.flatMap((part, i) => {
    if (typeof part !== 'string') return [part]
    const result: (string | React.ReactElement)[] = []
    const regex = /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g
    let lastIdx = 0
    let match
    while ((match = regex.exec(part)) !== null) {
      if (match.index > lastIdx) result.push(part.slice(lastIdx, match.index))
      result.push(<em key={`i-${i}-${match.index}`}>{match[1]}</em>)
      lastIdx = match.index + match[0].length
    }
    if (lastIdx < part.length) result.push(part.slice(lastIdx))
    return result.length ? result : [part]
  })

  // Inline code `text`
  parts = parts.flatMap((part, i) => {
    if (typeof part !== 'string') return [part]
    const result: (string | React.ReactElement)[] = []
    const regex = /`(.+?)`/g
    let lastIdx = 0
    let match
    while ((match = regex.exec(part)) !== null) {
      if (match.index > lastIdx) result.push(part.slice(lastIdx, match.index))
      result.push(
        <code key={`c-${i}-${match.index}`} className="px-1.5 py-0.5 bg-gray-100 text-gray-800 rounded text-xs font-mono">
          {match[1]}
        </code>
      )
      lastIdx = match.index + match[0].length
    }
    if (lastIdx < part.length) result.push(part.slice(lastIdx))
    return result.length ? result : [part]
  })

  // Highlight search matches
  if (searchQuery) {
    const lowerQuery = searchQuery.toLowerCase()
    parts = parts.flatMap((part, i) => {
      if (typeof part !== 'string') return [part]
      const result: (string | React.ReactElement)[] = []
      const lowerPart = part.toLowerCase()
      let lastIdx = 0
      let idx = lowerPart.indexOf(lowerQuery, lastIdx)
      while (idx !== -1) {
        if (idx > lastIdx) result.push(part.slice(lastIdx, idx))
        result.push(
          <mark key={`h-${i}-${idx}`} className="bg-yellow-200 text-yellow-900 rounded px-0.5">
            {part.slice(idx, idx + searchQuery.length)}
          </mark>
        )
        lastIdx = idx + searchQuery.length
        idx = lowerPart.indexOf(lowerQuery, lastIdx)
      }
      if (lastIdx < part.length) result.push(part.slice(lastIdx))
      return result.length ? result : [part]
    })
  }

  return parts
}

function RenderContent({ content, searchQuery }: { content: string; searchQuery: string }) {
  const lines = content.split('\n')
  const elements: React.ReactElement[] = []
  let listItems: string[] = []

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="space-y-1.5 ml-4">
          {listItems.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
              <span className="text-teal-500 mt-1 flex-shrink-0">&#8226;</span>
              <span>{renderMarkdownLine(item, searchQuery)}</span>
            </li>
          ))}
        </ul>
      )
      listItems = []
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      flushList()
      continue
    }

    const listMatch = trimmed.match(/^[-*]\s+(.+)/)
    if (listMatch) {
      listItems.push(listMatch[1])
      continue
    }

    flushList()
    elements.push(
      <p key={`p-${elements.length}`} className="text-sm text-gray-700 leading-relaxed">
        {renderMarkdownLine(trimmed, searchQuery)}
      </p>
    )
  }

  flushList()

  return <div className="space-y-2">{elements}</div>
}

export default function FaqContent() {
  const [sections, setSections] = useState<FaqSection[]>([])
  const [activeSection, setActiveSection] = useState<string>('')
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchFaq = async () => {
      try {
        const token = localStorage.getItem('auth_token')
        const res = await fetch('/api/faq', {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await res.json()
        if (data.success) {
          const parsed = parseFaqMarkdown(data.content)
          setSections(parsed)
          if (parsed.length > 0) setActiveSection(parsed[0].id)
        } else {
          setError(data.error || 'Errore nel caricamento')
        }
      } catch {
        setError('Errore di connessione')
      } finally {
        setLoading(false)
      }
    }
    fetchFaq()
  }, [])

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null
    const query = searchQuery.toLowerCase()
    const results: FaqSubsection[] = []
    for (const section of sections) {
      for (const sub of section.subsections) {
        if (
          sub.title.toLowerCase().includes(query) ||
          sub.content.toLowerCase().includes(query)
        ) {
          results.push(sub)
        }
      }
    }
    return results
  }, [searchQuery, sections])

  const toggleSubsection = (key: string) => {
    setExpandedSubs(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const currentSection = sections.find(s => s.id === activeSection)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 text-teal-600 animate-spin" />
        <span className="ml-2 text-gray-600">Caricamento FAQ...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-700">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Left sidebar - section list */}
      <div className="w-72 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Sezioni FAQ</h2>
          <p className="text-xs text-gray-500 mt-0.5">{sections.length} sezioni disponibili</p>
        </div>

        <nav className="flex-1 p-3 overflow-y-auto">
          <ul className="space-y-0.5">
            {sections.map((section) => {
              const Icon = SECTION_ICONS[section.id] || BookOpen
              const isActive = activeSection === section.id && !searchResults

              return (
                <li key={section.id}>
                  <button
                    onClick={() => {
                      setActiveSection(section.id)
                      setSearchQuery('')
                      setExpandedSubs(new Set())
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2.5 group text-sm ${
                      isActive
                        ? 'bg-teal-50 text-teal-700 border border-teal-200'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isActive ? 'bg-teal-100' : 'bg-gray-100 group-hover:bg-gray-200'
                    }`}>
                      <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-teal-600' : 'text-gray-500'}`} />
                    </div>
                    <span className="truncate">{section.id}. {section.title}</span>
                    {isActive && <ChevronRight className="w-3.5 h-3.5 text-teal-600 ml-auto flex-shrink-0" />}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>

      {/* Right content area */}
      <div className="flex-1 bg-gray-50 flex flex-col min-w-0">
        {/* Search bar */}
        <div className="p-4 bg-white border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cerca nelle FAQ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
              >
                Annulla
              </button>
            )}
          </div>
          {searchResults && (
            <p className="mt-2 text-xs text-gray-500">
              {searchResults.length} risultat{searchResults.length === 1 ? 'o' : 'i'} per &ldquo;{searchQuery}&rdquo;
            </p>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {searchResults ? (
            /* Search results mode */
            searchResults.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Search className="w-8 h-8 mx-auto mb-3 text-gray-300" />
                <p>Nessun risultato per &ldquo;{searchQuery}&rdquo;</p>
              </div>
            ) : (
              <div className="space-y-3">
                {searchResults.map((sub, idx) => {
                  const key = `search-${idx}`
                  const isExpanded = expandedSubs.has(key)

                  return (
                    <div key={key} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                      <button
                        onClick={() => toggleSubsection(key)}
                        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-teal-600 flex-shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900">
                            {renderMarkdownLine(sub.title, searchQuery)}
                          </div>
                          <div className="text-xs text-teal-600 mt-0.5">
                            Sez. {sub.sectionId} &mdash; {sub.sectionTitle}
                          </div>
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-1 border-t border-gray-100 ml-7">
                          <RenderContent content={sub.content} searchQuery={searchQuery} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          ) : currentSection ? (
            /* Section browse mode */
            <div className="space-y-3">
              <div className="flex items-center gap-3 mb-4">
                {(() => {
                  const Icon = SECTION_ICONS[currentSection.id] || BookOpen
                  return (
                    <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center">
                      <Icon className="w-4 h-4 text-teal-600" />
                    </div>
                  )
                })()}
                <div>
                  <h2 className="text-base font-semibold text-gray-900">
                    {currentSection.id}. {currentSection.title}
                  </h2>
                  <p className="text-xs text-gray-500">
                    {currentSection.subsections.length} domande in questa sezione
                  </p>
                </div>
              </div>

              {currentSection.subsections.map((sub, idx) => {
                const key = `${currentSection.id}-${idx}`
                const isExpanded = expandedSubs.has(key)

                return (
                  <div key={key} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <button
                      onClick={() => toggleSubsection(key)}
                      className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-teal-600 flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      )}
                      <span className="text-sm font-medium text-gray-900">{sub.title}</span>
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 border-t border-gray-100 ml-7">
                        <RenderContent content={sub.content} searchQuery="" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
