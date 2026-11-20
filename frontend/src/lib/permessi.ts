import { supabaseAdmin } from './supabaseAdmin'
import type { Permesso, Ruolo } from './ruoli'

/**
 * Permessi per ruolo (fase 4C), lato server. La matrice sta nel database
 * (scadenze_bandi_permessi_ruolo) e si modifica da Impostazioni > Ruoli e
 * permessi; qui è tenuta in memoria per 30 secondi per non leggerla a ogni
 * richiesta. Gli amministratori hanno tutti i permessi, l'OdV nessuno.
 */

type Catalogo = { chiave: Permesso; etichetta: string; descrizione: string; ordine: number }[]
type Matrice = Record<string, Record<string, boolean>>

const MEMORIA_MS = 30_000
let memoria: { catalogo: Catalogo; matrice: Matrice; scade: number } | null = null

export async function caricaPermessi(forza = false): Promise<{ catalogo: Catalogo; matrice: Matrice }> {
  if (!forza && memoria && memoria.scade > Date.now()) return memoria
  const [{ data: catalogo, error: e1 }, { data: righe, error: e2 }] = await Promise.all([
    supabaseAdmin.from('scadenze_bandi_permessi_catalogo').select('chiave, etichetta, descrizione, ordine').order('ordine'),
    supabaseAdmin.from('scadenze_bandi_permessi_ruolo').select('ruolo, permesso, consentito')
  ])
  if (e1 || e2) throw new Error(`Permessi non disponibili: ${(e1 || e2)!.message}`)
  const matrice: Matrice = {}
  for (const r of righe || []) {
    matrice[r.ruolo] = matrice[r.ruolo] || {}
    matrice[r.ruolo][r.permesso] = !!r.consentito
  }
  memoria = { catalogo: (catalogo || []) as Catalogo, matrice, scade: Date.now() + MEMORIA_MS }
  return memoria
}

export function dimenticaPermessi() {
  memoria = null
}

/** Elenco dei permessi concessi a un ruolo. */
export async function permessiDelRuolo(ruolo: Ruolo | string | null | undefined): Promise<Permesso[]> {
  const { catalogo, matrice } = await caricaPermessi()
  if (ruolo === 'admin') return catalogo.map(c => c.chiave)
  if (!ruolo || ruolo === 'odv') return []
  return catalogo.filter(c => matrice[ruolo]?.[c.chiave]).map(c => c.chiave)
}

export async function haPermesso(ruolo: Ruolo | string | null | undefined, permesso: Permesso): Promise<boolean> {
  if (ruolo === 'admin') return true
  return (await permessiDelRuolo(ruolo)).includes(permesso)
}

export async function etichettaPermesso(permesso: Permesso): Promise<string> {
  const { catalogo } = await caricaPermessi()
  return catalogo.find(c => c.chiave === permesso)?.etichetta || permesso
}
