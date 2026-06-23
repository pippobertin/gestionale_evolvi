/**
 * Configurazione ambito "Bandi esterni ↔ Clienti".
 *
 * Match deterministico (lista della spesa del cliente vs bandi esterni Agevolando),
 * aggregato PER CLIENTE: una riga per cliente con il riepilogo dei bandi in match.
 * Si appoggia alla vista `vista_match_bandi_per_cliente` (vista live).
 *
 * Vincolo legale: i contenuti Agevolando sono a uso interno. Per questo l'ambito
 * NON espone l'azione email (che invierebbe ai clienti): solo export interni e
 * creazione di scadenze interne ("ricontattare il cliente per i suoi bandi").
 */

import type { DefinizioneAmbito } from './registry'
import { TIPOLOGIE_INVESTIMENTO } from '@/lib/tipologieInvestimento'

// Le 14 voci sono gia' etichette leggibili: value === label.
const CATEGORIE_OPTS = TIPOLOGIE_INVESTIMENTO.map((t) => ({ value: t, label: t }))

export const ambitoMatchBandi: DefinizioneAmbito = {
  id: 'match_bandi',
  label: 'Bandi esterni ↔ Clienti',
  descrizione:
    'Clienti la cui "lista della spesa" combacia con bandi esterni attivi o in apertura. Uso interno.',
  tabella: 'vista_match_bandi_per_cliente',
  join_cliente: false, // la vista e' gia' denormalizzata coi campi cliente
  ordinamento_default: { campo: 'n_bandi', direzione: 'desc' },
  sotto_ambiti: [
    {
      id: 'cliente',
      label: 'Cliente',
      filtri: [
        { campo: 'cliente_denominazione', label: 'Azienda (contiene)', tipo: 'text' },
        { campo: 'cliente_provincia', label: 'Provincia (contiene)', tipo: 'text', placeholder: 'Es. VR' },
      ],
    },
    {
      id: 'match',
      label: 'Opportunità',
      filtri: [
        {
          campo: 'categorie_coperte',
          label: 'Categorie coperte',
          tipo: 'multiselect_array',
          opzioni: CATEGORIE_OPTS,
        },
        { campo: 'n_bandi', label: 'N. bandi in match', tipo: 'number_range' },
        { campo: 'n_bandi_in_apertura', label: 'di cui in apertura', tipo: 'number_range' },
      ],
    },
  ],
  colonne_risultati: [
    { campo: 'cliente_denominazione', label: 'Azienda', formato: 'testo', larghezza_excel: 35 },
    { campo: 'cliente_partita_iva', label: 'P. IVA', formato: 'testo', larghezza_excel: 14 },
    { campo: 'cliente_provincia', label: 'Prov.', formato: 'testo', larghezza_excel: 8 },
    { campo: 'n_bandi', label: 'N. bandi', formato: 'numero', larghezza_excel: 10 },
    { campo: 'n_bandi_attivi', label: 'Attivi', formato: 'numero', larghezza_excel: 9 },
    { campo: 'n_bandi_in_apertura', label: 'In apertura', formato: 'numero', larghezza_excel: 12 },
    { campo: 'categorie_coperte', label: 'Categorie coperte', formato: 'array', larghezza_excel: 40 },
    { campo: 'bandi_titoli', label: 'Bandi in match', formato: 'array', larghezza_excel: 60 },
  ],
  azioni_bulk: ['export_excel', 'export_pdf', 'crea_scadenza'],
  azione_scadenza: { campo_cliente_id: 'cliente_id', campo_nome: 'cliente_denominazione' },
}
