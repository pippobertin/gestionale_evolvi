/**
 * Registry centrale degli "ambiti" disponibili nelle Interrogazioni.
 *
 * Un ambito descrive una tabella del DB e i filtri/colonne disponibili per
 * interrogarla. La pagina /interrogazioni e' generica e si configura solo
 * leggendo questi metadati. Aggiungere un nuovo ambito = aggiungere un file
 * di configurazione e registrarlo qui sotto.
 */

import { ambitoFabbisogni } from './ambito-fabbisogni'
import { ambitoClienti } from './ambito-clienti'
import { ambitoProspect } from './ambito-prospect'
import { ambitoBandi } from './ambito-bandi'
import { ambitoProgetti } from './ambito-progetti'
import { ambitoPiani } from './ambito-piani'
import { ambitoCorsi } from './ambito-corsi'
import { ambitoFpi } from './ambito-fpi'
import { ambitoContratti } from './ambito-contratti'
import { ambitoMatchBandi } from './ambito-match-bandi'

// ----------------------------------------------------------------
// Tipi
// ----------------------------------------------------------------

export type FiltroTipo =
  | 'text'                  // testo libero (ILIKE %valore%)
  | 'select'                // singola scelta tra opzioni
  | 'multiselect_array'     // multi-select su colonna TEXT[] (operatore && )
  | 'multiselect_scalar'    // multi-select su colonna scalare (IN)
  | 'number'                // numero esatto
  | 'number_range'          // intervallo numerico { min, max }
  | 'date_range'            // intervallo data { da, a } in ISO date

export interface OpzioneFiltro {
  value: string
  label: string
}

export interface DefinizioneFiltro {
  campo: string                 // nome colonna SQL nella tabella principale
  label: string                 // etichetta UI
  tipo: FiltroTipo
  opzioni?: OpzioneFiltro[]     // per select/multiselect
  placeholder?: string
}

export interface SottoAmbito {
  id: string
  label: string
  filtri: DefinizioneFiltro[]
}

export interface DefinizioneColonna {
  campo: string                 // chiave da prendere dalla riga (es. 'titolo', 'cliente.denominazione')
  label: string
  formato?: 'data' | 'data_ora' | 'numero' | 'enum' | 'array' | 'testo'
  enum_labels?: Record<string, string>  // per 'enum' o 'array' con valori da mappare
  larghezza_excel?: number              // larghezza colonna in Excel (caratteri)
}

export type AzioneBulk = 'export_excel' | 'export_pdf' | 'email' | 'crea_scadenza'

export interface DefinizioneAmbito {
  id: string                    // identificativo univoco
  label: string                 // nome mostrato nel menu ambiti
  descrizione?: string
  tabella: string               // nome tabella SQL principale
  /**
   * Join opzionale verso la tabella clienti per arricchire i risultati con
   * denominazione, partita_iva, eccetera. La FK e' "cliente_id".
   */
  join_cliente?: boolean
  sotto_ambiti: SottoAmbito[]
  colonne_risultati: DefinizioneColonna[]
  azioni_bulk: AzioneBulk[]
  /** ordinamento di default delle righe (campo + direzione) */
  ordinamento_default?: { campo: string; direzione: 'asc' | 'desc' }
  /**
   * Mappa per le azioni bulk: dice da quali campi della riga ricavare
   * l'email destinatario, il nome leggibile e l'id cliente collegato.
   * Supporta notazione "cliente.X" per accedere ai campi del join.
   */
  azione_email?: {
    campo_email: string          // es. 'email' per clienti, 'cliente.email' per fabbisogni
    campo_email_fallback?: string // es. 'pec'
    campo_nome: string           // nome leggibile da mostrare in anteprima
  }
  azione_scadenza?: {
    campo_cliente_id: string     // es. 'id' per clienti, 'cliente_id' per altri
    campo_nome: string           // per il titolo della scadenza
  }
}

// ----------------------------------------------------------------
// Helpers di lookup
// ----------------------------------------------------------------

export const AMBITI: Record<string, DefinizioneAmbito> = {
  [ambitoClienti.id]: ambitoClienti,
  [ambitoProspect.id]: ambitoProspect,
  [ambitoFabbisogni.id]: ambitoFabbisogni,
  [ambitoBandi.id]: ambitoBandi,
  [ambitoProgetti.id]: ambitoProgetti,
  [ambitoPiani.id]: ambitoPiani,
  [ambitoCorsi.id]: ambitoCorsi,
  [ambitoFpi.id]: ambitoFpi,
  [ambitoContratti.id]: ambitoContratti,
  [ambitoMatchBandi.id]: ambitoMatchBandi,
}

export function getAmbito(id: string): DefinizioneAmbito | null {
  return AMBITI[id] || null
}

export function listAmbiti(): DefinizioneAmbito[] {
  return Object.values(AMBITI)
}

// ----------------------------------------------------------------
// Tipi di payload per le API
// ----------------------------------------------------------------

/**
 * Valore di un filtro inviato dal client. La forma cambia in base al tipo.
 */
export type ValoreFiltro =
  | { tipo: 'text'; valore: string }
  | { tipo: 'select'; valore: string }
  | { tipo: 'multiselect_array'; valori: string[] }
  | { tipo: 'multiselect_scalar'; valori: string[] }
  | { tipo: 'number'; valore: number }
  | { tipo: 'number_range'; min?: number; max?: number }
  | { tipo: 'date_range'; da?: string; a?: string }

export interface InterrogazioneRequest {
  ambito: string
  filtri: Record<string, ValoreFiltro>   // chiave = campo
  pagina?: number
  per_pagina?: number
}
