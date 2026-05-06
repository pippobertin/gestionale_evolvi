'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Save, Eye, Loader2, CheckCircle, AlertCircle, Upload, X, Image as ImageIcon } from 'lucide-react'

interface SignatureFields {
  nomeCompleto: string
  ruolo: string
  telefono: string
  emailContatto: string
  includiLogo: boolean
  logoUrl: string
  disclaimer: string
}

const DEFAULT_LOGO_URL = 'https://gestionale.blmproject.com/evolvi-firma.png'

const DEFAULT_DISCLAIMER = `Il contenuto di questa e-mail e dei relativi allegati è strettamente riservato ed è destinato unicamente al destinatario indicato. Se non siete il destinatario indicato, vi preghiamo di comunicarcelo immediatamente e di eliminare il messaggio. È vietata la copia, l'inoltro e la divulgazione del contenuto a terzi. Ai sensi del Regolamento UE 2016/679 (GDPR), i dati personali contenuti in questa comunicazione sono trattati nel rispetto della normativa vigente in materia di protezione dei dati.`

const AI_DISCLOSURE = `Questa comunicazione potrebbe essere stata elaborata con l'assistenza di strumenti di intelligenza artificiale e successivamente verificata dal mittente.`

function buildSignatureHtml(fields: SignatureFields): string {
  const logoHtml = fields.includiLogo && fields.logoUrl
    ? `<img src="${fields.logoUrl}" alt="Metodo Evolvi" style="max-width:200px;height:auto;margin:0 0 12px 0;display:block;" />`
    : ''

  return `<table cellpadding="0" cellspacing="0" style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;max-width:500px;">
  <tr>
    <td style="padding:0 0 12px 0;">
      ${logoHtml}
      <p style="font-size:15px;font-weight:700;color:#0f766e;margin:0 0 2px 0;">${fields.nomeCompleto}</p>
      ${fields.ruolo ? `<p style="font-size:13px;color:#374151;margin:0 0 2px 0;">${fields.ruolo}</p>` : ''}
      ${fields.telefono ? `<p style="font-size:13px;color:#374151;margin:0 0 2px 0;">${fields.telefono}</p>` : ''}
      <p style="font-size:13px;margin:0;">
        <a href="mailto:${fields.emailContatto}" style="color:#0d9488;text-decoration:none;">${fields.emailContatto}</a>
      </p>
    </td>
  </tr>
  <tr>
    <td style="border-top:2px solid #e5e7eb;padding:10px 0 0 0;">
      <p style="font-size:10px;color:#9ca3af;line-height:1.5;margin:0 0 6px 0;">
        ${fields.disclaimer}
      </p>
      <p style="font-size:10px;color:#9ca3af;line-height:1.5;margin:0;font-style:italic;">
        ${AI_DISCLOSURE}
      </p>
    </td>
  </tr>
</table>`
}

export default function EmailSignatureEditor() {
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fields, setFields] = useState<SignatureFields>({
    nomeCompleto: '',
    ruolo: '',
    telefono: '',
    emailContatto: '',
    includiLogo: true,
    logoUrl: DEFAULT_LOGO_URL,
    disclaimer: DEFAULT_DISCLAIMER
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')

  const loadSignature = useCallback(async () => {
    try {
      const res = await fetch('/api/user/email-signature', { credentials: 'include' })
      const data = await res.json()

      if (data.firma_email_html) {
        const html = data.firma_email_html
        const nome = html.match(/font-weight:700;color:#0f766e[^>]*>([^<]+)</)?.[1] || ''
        const ruolo = html.match(/font-size:13px;color:#374151;margin:0 0 2px 0;">([^<]+)/)?.[1] || ''
        const telefono = html.match(/font-size:13px;color:#374151;margin:0 0 2px 0;">([^<]+)/g)
        const tel = telefono && telefono.length >= 2
          ? telefono[1]?.match(/>([^<]+)/)?.[1] || ''
          : ''
        const email = html.match(/mailto:([^"]+)/)?.[1] || ''
        const includiLogo = html.includes('<img ')
        const logoSrc = html.match(/<img[^>]+src="([^"]+)"/)?.[1] || DEFAULT_LOGO_URL
        const disclaimerMatch = html.match(/border-top:2px solid #e5e7eb[\s\S]*?margin:0 0 6px 0;">\s*([\s\S]*?)\s*<\/p>/)
        const disclaimer = disclaimerMatch?.[1]?.trim() || DEFAULT_DISCLAIMER

        setFields({
          nomeCompleto: nome,
          ruolo: ruolo,
          telefono: tel,
          emailContatto: email,
          includiLogo,
          logoUrl: logoSrc,
          disclaimer
        })
      } else {
        setFields(prev => ({
          ...prev,
          nomeCompleto: data.nome && data.cognome ? `${data.nome} ${data.cognome}` : user?.nome_completo || '',
          emailContatto: data.email || user?.email || ''
        }))
      }
    } catch (err) {
      console.error('Error loading signature:', err)
      if (user) {
        setFields(prev => ({
          ...prev,
          nomeCompleto: user.nome_completo || '',
          emailContatto: user.email || ''
        }))
      }
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadSignature()
  }, [loadSignature])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset input so re-uploading the same file works
    e.target.value = ''

    const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']
    if (!allowedTypes.includes(file.type)) {
      alert('Formato non supportato. Usa PNG, JPG, GIF, WebP o SVG.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('Immagine troppo grande (max 2MB)')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/user/email-signature/upload-image', {
        method: 'POST',
        credentials: 'include',
        body: formData
      })
      const data = await res.json()
      if (data.success && data.url) {
        setFields(prev => ({ ...prev, logoUrl: data.url, includiLogo: true }))
      } else {
        alert(data.error || 'Errore durante il caricamento')
      }
    } catch {
      alert('Errore di rete durante il caricamento')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveStatus('idle')
    try {
      const firma_email_html = buildSignatureHtml(fields)
      const res = await fetch('/api/user/email-signature', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ firma_email_html })
      })

      if (res.ok) {
        setSaveStatus('success')
        setTimeout(() => setSaveStatus('idle'), 3000)
      } else {
        setSaveStatus('error')
      }
    } catch {
      setSaveStatus('error')
    } finally {
      setSaving(false)
    }
  }

  const updateField = <K extends keyof SignatureFields>(key: K, value: SignatureFields[K]) => {
    setFields(prev => ({ ...prev, [key]: value }))
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-teal-600 mr-2" />
        <span className="text-gray-600 text-sm">Caricamento firma...</span>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mt-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Firma Email</h3>
      <p className="text-xs text-gray-500 mb-4">
        Personalizza la tua firma che verrà inclusa nelle email inviate dal sistema.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Form Fields */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nome completo</label>
            <input
              type="text"
              value={fields.nomeCompleto}
              onChange={e => updateField('nomeCompleto', e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
              placeholder="Mario Rossi"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Ruolo / Titolo</label>
            <input
              type="text"
              value={fields.ruolo}
              onChange={e => updateField('ruolo', e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
              placeholder="Responsabile area profit"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Telefono</label>
            <input
              type="text"
              value={fields.telefono}
              onChange={e => updateField('telefono', e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
              placeholder="347.9101073"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Email contatto</label>
            <input
              type="email"
              value={fields.emailContatto}
              onChange={e => updateField('emailContatto', e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
              placeholder="nome@blmproject.com"
            />
          </div>

          {/* Logo section */}
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <input
                type="checkbox"
                id="includiLogo"
                checked={fields.includiLogo}
                onChange={e => updateField('includiLogo', e.target.checked)}
                className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
              />
              <label htmlFor="includiLogo" className="text-xs font-medium text-gray-700">
                Includi immagine/logo nella firma
              </label>
            </div>

            {fields.includiLogo && (
              <div className="ml-5 space-y-2">
                {/* Current image preview */}
                {fields.logoUrl && (
                  <div className="flex items-start space-x-2">
                    <div className="border border-gray-200 rounded p-2 bg-gray-50 inline-block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={fields.logoUrl}
                        alt="Logo firma"
                        className="max-h-12 max-w-[160px] object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    </div>
                    <button
                      onClick={() => updateField('logoUrl', '')}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      title="Rimuovi immagine"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Upload button */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center space-x-1.5 px-3 py-1.5 text-xs border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  {uploading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  <span>{uploading ? 'Caricamento...' : fields.logoUrl ? 'Cambia immagine' : 'Carica immagine'}</span>
                </button>
                <p className="text-[10px] text-gray-400">PNG, JPG, GIF, WebP, SVG — max 2MB</p>

                {/* Manual URL input */}
                <div>
                  <label className="block text-[10px] text-gray-500 mb-0.5">oppure inserisci URL diretto</label>
                  <div className="flex items-center space-x-1">
                    <ImageIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <input
                      type="url"
                      value={fields.logoUrl}
                      onChange={e => updateField('logoUrl', e.target.value)}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
                      placeholder="https://..."
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Disclaimer legale</label>
            <textarea
              value={fields.disclaimer}
              onChange={e => updateField('disclaimer', e.target.value)}
              rows={4}
              className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-1 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !fields.nomeCompleto || !fields.emailContatto}
            className="flex items-center space-x-2 px-4 py-2 bg-teal-600 text-white text-sm font-medium rounded-md hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saveStatus === 'success' ? (
              <CheckCircle className="w-4 h-4" />
            ) : saveStatus === 'error' ? (
              <AlertCircle className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>
              {saving ? 'Salvataggio...' : saveStatus === 'success' ? 'Salvato!' : saveStatus === 'error' ? 'Errore, riprova' : 'Salva Firma'}
            </span>
          </button>
        </div>

        {/* Live Preview */}
        <div>
          <div className="flex items-center space-x-2 mb-2">
            <Eye className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Anteprima</span>
          </div>
          <div className="border border-gray-200 rounded-lg p-4 bg-white min-h-[200px]">
            <p className="text-sm text-gray-600 mb-3">Cordiali saluti,</p>
            <div
              dangerouslySetInnerHTML={{ __html: buildSignatureHtml(fields) }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
