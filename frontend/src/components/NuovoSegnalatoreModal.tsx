'use client'

import { useState } from 'react'
import { X, Save } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Nuovo segnalatore: solo i dati che servono (chi è, come contattarlo, dove
 * sta). È un'anagrafica con la categoria Segnalatori; accordo e compensi si
 * registrano poi dalla sua scheda.
 */
type Props = { isOpen: boolean; onClose: () => void; onSaved: (id: string) => void }

const vuoto = { denominazione: '', partita_iva: '', codice_fiscale: '', email: '', pec: '', telefono: '', indirizzo_fatturazione: '', cap_fatturazione: '', citta_fatturazione: '', provincia_fatturazione: '', note: '' }

export default function NuovoSegnalatoreModal({ isOpen, onClose, onSaved }: Props) {
  const { user } = useAuth()
  const [dati, setDati] = useState(vuoto)
  const [salvataggio, setSalvataggio] = useState(false)
  const [errore, setErrore] = useState('')
  if (!isOpen) return null

  const campo = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm'
  const set = (k: keyof typeof vuoto) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDati({ ...dati, [k]: e.target.value })

  const salva = async () => {
    if (!dati.denominazione.trim()) { setErrore('Indica il nome del segnalatore'); return }
    setSalvataggio(true); setErrore('')
    const pulito = Object.fromEntries(Object.entries(dati).map(([k, v]) => [k, v.trim() || null]))
    const { data, error } = await supabase.from('scadenze_bandi_clienti')
      .insert([{ ...pulito, denominazione: dati.denominazione.trim(), categoria_evolvi: 'CONSULENTI', stato_fatturazione: 'Italia', creato_da: user?.id }])
      .select('id').single()
    setSalvataggio(false)
    if (error || !data) { setErrore(error?.message || 'Salvataggio non riuscito'); return }
    setDati(vuoto)
    onSaved(data.id)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-hard max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="gradient-primary text-white p-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Nuovo segnalatore</h2>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 overflow-y-auto space-y-3">
          <p className="text-xs text-gray-500">Chi ci presenta clienti. Accordo e compensi, se previsti, si registrano poi dalla sua scheda.</p>
          <label className="block text-xs text-gray-600">Nome o denominazione *<input className={campo} value={dati.denominazione} onChange={set('denominazione')} /></label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block text-xs text-gray-600">Partita IVA<input className={campo} value={dati.partita_iva} onChange={set('partita_iva')} /></label>
            <label className="block text-xs text-gray-600">Codice fiscale<input className={campo} value={dati.codice_fiscale} onChange={set('codice_fiscale')} /></label>
            <label className="block text-xs text-gray-600">Email<input type="email" className={campo} value={dati.email} onChange={set('email')} /></label>
            <label className="block text-xs text-gray-600">PEC<input type="email" className={campo} value={dati.pec} onChange={set('pec')} /></label>
            <label className="block text-xs text-gray-600">Telefono<input className={campo} value={dati.telefono} onChange={set('telefono')} /></label>
          </div>
          <label className="block text-xs text-gray-600">Indirizzo<input className={campo} value={dati.indirizzo_fatturazione} onChange={set('indirizzo_fatturazione')} /></label>
          <div className="grid grid-cols-3 gap-3">
            <label className="block text-xs text-gray-600">CAP<input className={campo} value={dati.cap_fatturazione} onChange={set('cap_fatturazione')} /></label>
            <label className="block text-xs text-gray-600">Città<input className={campo} value={dati.citta_fatturazione} onChange={set('citta_fatturazione')} /></label>
            <label className="block text-xs text-gray-600">Provincia<input className={campo} value={dati.provincia_fatturazione} onChange={set('provincia_fatturazione')} /></label>
          </div>
          <label className="block text-xs text-gray-600">Note<textarea className={campo} rows={2} value={dati.note} onChange={set('note')} /></label>
          {errore && <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">{errore}</div>}
        </div>
        <div className="border-t border-gray-200 px-4 py-3 bg-gray-50 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg bg-white">Annulla</button>
          <button type="button" disabled={salvataggio} onClick={salva} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg inline-flex items-center gap-1 disabled:opacity-50">
            <Save className="w-4 h-4" /> {salvataggio ? 'Salvataggio…' : 'Salva il segnalatore'}
          </button>
        </div>
      </div>
    </div>
  )
}
