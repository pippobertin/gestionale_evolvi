import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// --- Badge per il database (fase 3) ---------------------------------------
// Nel browser ogni richiesta al database porta il badge dell'utente collegato,
// ottenuto da /api/auth/db-token e rinnovato prima della scadenza.
// Se il badge non è disponibile (utente non collegato, badge non ancora attivo)
// la libreria usa la chiave pubblica, cioè il comportamento precedente.
// Sul server (route API) non viene allegato nessun badge.
let dbToken: { token: string; expiresAt: number } | null = null
let dbTokenRetryAfter = 0
let dbTokenInFlight: Promise<string | null> | null = null

async function getBrowserDbToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null
  const now = Math.floor(Date.now() / 1000)
  if (dbToken && dbToken.expiresAt - now > 300) return dbToken.token
  if (now < dbTokenRetryAfter) return null
  if (dbTokenInFlight) return dbTokenInFlight

  dbTokenInFlight = (async () => {
    try {
      const res = await fetch('/api/auth/db-token', { credentials: 'same-origin', cache: 'no-store' })
      if (!res.ok) {
        dbToken = null
        dbTokenRetryAfter = Math.floor(Date.now() / 1000) + 60
        return null
      }
      const data = await res.json()
      dbToken = { token: data.token, expiresAt: data.expiresAt }
      return dbToken.token
    } catch {
      dbTokenRetryAfter = Math.floor(Date.now() / 1000) + 60
      return null
    } finally {
      dbTokenInFlight = null
    }
  })()
  return dbTokenInFlight
}

/** Da chiamare al login e al logout per non riusare il badge di un'altra sessione. */
export function resetDbToken() {
  dbToken = null
  dbTokenRetryAfter = 0
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  accessToken: getBrowserDbToken
})

// Types per il database
export interface Bando {
  id: string
  nome: string
  descrizione?: string
  tipo_bando?: string
  stato: 'attivo' | 'archiviato'
  created_at: string
  updated_at: string
}

export interface Cliente {
  id: string
  denominazione: string
  email?: string
  telefono?: string
  settore?: string
  note?: string
  created_at: string
  updated_at: string
}

export interface TipologiaScadenza {
  id: string
  nome: string
  descrizione?: string
  giorni_preavviso_default: number[]
  colore_hex: string
  ordine_visualizzazione: number
  created_at: string
  updated_at: string
}

export interface Progetto {
  id: string
  bando_id: string
  cliente_id: string
  nome_progetto: string
  data_inizio?: string
  data_fine_prevista?: string
  stato: 'attivo' | 'completato' | 'sospeso'
  note?: string
  created_at: string
  updated_at: string
}

export interface Scadenza {
  id: string
  progetto_id: string
  tipologia_scadenza_id: string
  data_scadenza: string
  stato: 'non_iniziata' | 'in_corso' | 'completata' | 'annullata'
  priorita: 'bassa' | 'media' | 'alta' | 'critica'
  responsabile_email?: string
  note?: string
  completata_da?: string
  completata_il?: string
  giorni_preavviso: number[]
  alert_inviati: number[]
  created_at: string
  updated_at: string
}

export interface DashboardItem {
  id: string
  data_scadenza: string
  stato: 'non_iniziata' | 'in_corso' | 'completata' | 'annullata'
  priorita: 'bassa' | 'media' | 'alta' | 'critica'
  responsabile_email?: string
  nota_scadenza?: string
  tipo_scadenza: string
  colore_hex: string
  nome_progetto: string
  nome_bando: string
  nome_cliente: string
  email_cliente?: string
  giorni_rimanenti: number
}