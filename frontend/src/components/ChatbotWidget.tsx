'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, RotateCcw } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const STORAGE_KEY = 'chatbot_history'

function renderMarkdown(text: string) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let listItems: string[] = []
  let listKey = 0

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${listKey++}`} className="list-disc pl-4 my-1 space-y-0.5">
          {listItems.map((item, j) => (
            <li key={j}>{formatInline(item)}</li>
          ))}
        </ul>
      )
      listItems = []
    }
  }

  const formatInline = (line: string): React.ReactNode => {
    const parts: React.ReactNode[] = []
    const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)/g
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(line.slice(lastIndex, match.index))
      }
      if (match[1]) {
        parts.push(<strong key={match.index}>{match[2]}</strong>)
      } else if (match[3]) {
        parts.push(<em key={match.index}>{match[4]}</em>)
      } else if (match[5]) {
        parts.push(
          <code key={match.index} className="bg-gray-200 px-1 rounded text-xs">
            {match[6]}
          </code>
        )
      }
      lastIndex = match.index + match[0].length
    }
    if (lastIndex < line.length) {
      parts.push(line.slice(lastIndex))
    }
    return parts.length === 1 ? parts[0] : <>{parts}</>
  }

  lines.forEach((line, i) => {
    const listMatch = line.match(/^[-•]\s+(.+)/)
    if (listMatch) {
      listItems.push(listMatch[1])
      return
    }
    flushList()

    if (line.trim() === '') {
      elements.push(<br key={`br-${i}`} />)
    } else {
      elements.push(<p key={`p-${i}`} className="mb-1">{formatInline(line)}</p>)
    }
  })
  flushList()

  return <>{elements}</>
}

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        setMessages(JSON.parse(saved))
      }
    } catch {
      // ignore parse errors
    }
  }, [])

  // Persist to localStorage on change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
    }
  }, [messages])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMessage: Message = { role: 'user', content: text }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput('')
    setLoading(true)

    try {
      const token = localStorage.getItem('auth_token')
      const res = await fetch('/api/chatbot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: updatedMessages }),
      })

      const data = await res.json()

      if (data.success && data.message) {
        setMessages([...updatedMessages, data.message])
      } else {
        setMessages([
          ...updatedMessages,
          {
            role: 'assistant',
            content:
              'Mi dispiace, non riesco a rispondere in questo momento. Riprova tra poco.',
          },
        ])
      }
    } catch {
      setMessages([
        ...updatedMessages,
        {
          role: 'assistant',
          content:
            'Mi dispiace, non riesco a rispondere in questo momento. Riprova tra poco.',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleNewConversation = () => {
    setMessages([])
    localStorage.removeItem(STORAGE_KEY)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 h-[500px] bg-white rounded-2xl shadow-xl flex flex-col overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-teal-600 to-teal-500 text-white">
            <span className="font-semibold text-sm">Assistente Evolvi</span>
            <div className="flex items-center gap-1">
              <button
                onClick={handleNewConversation}
                className="p-1.5 hover:bg-teal-700/40 rounded-lg transition-colors"
                title="Nuova conversazione"
              >
                <RotateCcw size={15} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-teal-700/40 rounded-lg transition-colors"
                title="Chiudi"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-gray-400 text-sm mt-16">
                <p className="font-medium text-gray-500 mb-1">
                  Ciao, come posso aiutarti?
                </p>
                <p>
                  Chiedimi qualsiasi cosa sul Gestionale Evolvi.
                </p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-teal-600 text-white rounded-br-sm'
                      : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                  }`}
                >
                  {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-500 px-3 py-2 rounded-xl rounded-bl-sm text-sm">
                  <span className="inline-flex gap-1">
                    <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
                    <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
                    <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="border-t border-gray-100 p-3 flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Scrivi un messaggio..."
              className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="p-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Floating button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-12 h-12 bg-gradient-to-br from-teal-500 to-teal-600 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center z-50"
        title="Assistente Evolvi"
      >
        {isOpen ? <X size={20} /> : <MessageCircle size={20} />}
      </button>
    </>
  )
}
