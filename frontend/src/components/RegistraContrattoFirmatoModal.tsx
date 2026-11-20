'use client'

import { useState } from 'react'
import { X, Upload, FileSignature } from 'lucide-react'
import { CANALI_CONTRATTO_FIRMATO } from '@/types/evolvi-contract'

interface Props {
  trackingId: string
  /** Testo che identifica il contratto (cliente, codice progetto o numero contratto) */
  descrizione: string
  onClose: () => void
  onRegistrato: () => void
}

/**
 * Registrazione del contratto firmato restituito dal cliente.
 * Il file va su Drive accanto al contratto approvato (POST register-signed).
 */
export default function RegistraContrattoFirmatoModal({ trackingId, descrizione, onClose, onRegistrato }: Props) {
  const oggi = new Date().toISOString().slice(0, 10)
  const [file, setFile] = useState<File | null>(null)
  const [dataRicezione, setDataRicezione] = useState(oggi)
  const [canale, setCanale] = useState('email')
  const [note, setNote] = useState('')
  const [invio, setInvio] = useState(false)
  const [errore, setErrore] = useState('')

  const registra = async () => {
    setErrore('')
    if (!file) {
      setErrore('Seleziona il file del contratto firmato')
      return
    }
    setInvio(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('data_ricezione', dataRicezione)
      form.append('canale', canale)
      if (note.trim()) form.append('note', note.trim())
      const res = await fetch(`/api/contracts/tracking/${trackingId}/register-signed`, { method: 'POST', body: form })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) throw new Error(json.error || 'Errore nella registrazione')
      onRegistrato()
      onClose()
    } catch (err: any) {
      setErrore(err.message || 'Errore nella registrazione')
    } finally {
      setInvio(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-2">
            <FileSignature className="w-4 h-4 text-green-600" />
            <h3 className="text-sm font-semibold text-gray-900">Registra contratto firmato</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-xs text-gray-600">{descrizione}</p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">File firmato *</label>
            <label className="flex items-center justify-center w-full px-3 py-3 border-2 border-dashed border-gray-300 rounded-md cursor-pointer hover:border-green-400 text-sm text-gray-600">
              <Upload className="w-4 h-4 mr-2" />
              {file ? file.name : 'Scegli il file (PDF, P7M, JPG, PNG)'}
              <input type="file" accept=".pdf,.p7m,.jpg,.jpeg,.png" className="hidden"
                onChange={e => setFile(e.target.files?.[0] || null)} />
            </label>
            <p className="text-xs text-gray-500 mt-1">
              Va salvato su Drive nella cartella del contratto approvato. Massimo 25 MB.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ricevuto il *</label>
              <input type="date" value={dataRicezione} max={oggi} onChange={e => setDataRicezione(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Arrivato tramite *</label>
              <select value={canale} onChange={e => setCanale(e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                {Object.entries(CANALI_CONTRATTO_FIRMATO).map(([valore, etichetta]) => (
                  <option key={valore} value={valore}>{etichetta}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
              placeholder="Per esempio: firmato digitalmente dal legale rappresentante"
              className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
          </div>

          {errore && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm">{errore}</div>}
        </div>

        <div className="flex justify-end space-x-2 p-4 border-t bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-white">
            Annulla
          </button>
          <button onClick={registra} disabled={invio || !file}
            className="px-4 py-2 rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50">
            {invio ? 'Caricamento…' : 'Registra'}
          </button>
        </div>
      </div>
    </div>
  )
}
