import type { Ruolo } from './ruoli'

/**
 * Voci del menu, raggruppate. Un solo elenco per il menu laterale e per il
 * titolo della pagina, così i nomi restano uguali ovunque.
 */
export type VoceMenu = { id: string; label: string; gruppo: string; nascostaA?: Ruolo[] }

export const VOCI_MENU: VoceMenu[] = [
  { id: 'dashboard', label: 'Cruscotto', gruppo: '' },
  { id: 'scadenze', label: 'Scadenzario', gruppo: 'Lavoro quotidiano' },
  { id: 'email', label: 'Email', gruppo: 'Lavoro quotidiano' },
  { id: 'note-inbox', label: 'Note da assegnare', gruppo: 'Lavoro quotidiano' },
  { id: 'prospect', label: 'Prospect', gruppo: 'Anagrafiche' },
  { id: 'clienti', label: 'Clienti', gruppo: 'Anagrafiche' },
  { id: 'consulenti', label: 'Segnalatori', gruppo: 'Anagrafiche' },
  { id: 'bandi', label: 'Bandi', gruppo: 'Bandi e progetti' },
  { id: 'bandi-esterni', label: 'Catalogo bandi', gruppo: 'Bandi e progetti' },
  { id: 'progetti', label: 'Progetti', gruppo: 'Bandi e progetti' },
  { id: 'reports', label: 'Analisi', gruppo: 'Analisi' },
  { id: 'modello231', label: 'Modello 231', gruppo: 'Studio' },
  { id: 'settings', label: 'Impostazioni', gruppo: 'Studio' },
  { id: 'faq', label: 'Aiuto', gruppo: 'Studio' }
]

export function titoloPagina(id: string) {
  if (id === 'interrogazioni') return 'Analisi'
  return VOCI_MENU.find(v => v.id === id)?.label || 'Cruscotto'
}

export function vociVisibili(ruolo?: Ruolo | null) {
  return VOCI_MENU.filter(v => !ruolo || !v.nascostaA?.includes(ruolo))
}
