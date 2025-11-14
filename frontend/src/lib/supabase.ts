import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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