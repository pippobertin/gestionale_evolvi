/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Costruisce il documento pdfmake "Riepilogo contributi ottenuti" di un cliente.
 * Restituisce il docDefinition; la generazione del Buffer è a carico della route.
 */

import {
  FORMA_LABEL,
  STATO_LABEL,
  FORME_CONTRIBUTO,
  type ContributoWithJoins,
} from './types'
import { escludiDaiTotali, type RiepilogoContributi } from './riepilogo'

// ----------------------------------------------------------------
// Costanti di stile
// ----------------------------------------------------------------

const COLORE_PRIMARIO = '#0d9488'
const COLORE_TITOLI = '#0f766e'
const COLORE_GRIGIO = '#6b7280'
const COLORE_ATTENUATO = '#9ca3af'
const COLORE_LINEE = '#e5e7eb'

const MARGINI: [number, number, number, number] = [30, 60, 30, 50]
const LARGHEZZA_UTILE = 842 - MARGINI[0] - MARGINI[2]   // A4 orizzontale
const PADDING_X = 3
const LINEA = 0.5

// ----------------------------------------------------------------
// Formatter
// ----------------------------------------------------------------

const TRATTINO = '—'

const toNum = (v: number | string | null | undefined): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const fmtEuro = (v: number | string | null | undefined): string => {
  const n = toNum(v)
  if (n === null) return TRATTINO
  return new Intl.NumberFormat('it-IT', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: 0, maximumFractionDigits: 2,
    useGrouping: 'always' as any,   // forza il punto anche su 4 cifre (8.000 €)
  }).format(n)
}

const fmtPct = (v: number | string | null | undefined): string => {
  const n = toNum(v)
  if (n === null) return TRATTINO
  return `${n.toLocaleString('it-IT', { maximumFractionDigits: 2 })}%`
}

const fmtData = (d: string | null | undefined): string => {
  if (!d) return TRATTINO
  // Le date sono 'YYYY-MM-DD': le formatto senza passare dal fuso orario
  const [a, m, g] = d.slice(0, 10).split('-')
  return a && m && g ? `${g}/${m}/${a}` : d
}

const oggiIt = () =>
  new Date().toLocaleDateString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Rome',
  })

// ----------------------------------------------------------------
// Builder
// ----------------------------------------------------------------

export function buildContributiDocDefinition(opts: {
  cliente: {
    denominazione: string
    partita_iva: string | null
    codice_fiscale: string | null
    citta_fatturazione: string | null
    provincia_fatturazione: string | null
  }
  contributi: ContributoWithJoins[]
  riepilogo: RiepilogoContributi
  filtriDescrizione: string | null   // es. "Anno 2025 · Forma: Fondo perduto"; null se nessun filtro
}): any {
  const { cliente, contributi, riepilogo, filtriDescrizione } = opts
  const content: any[] = []

  // -- Blocco cliente -------------------------------------------------
  const citta = cliente.citta_fatturazione
    ? `${cliente.citta_fatturazione}${cliente.provincia_fatturazione ? ` (${cliente.provincia_fatturazione})` : ''}`
    : cliente.provincia_fatturazione
  const datiCliente = [
    cliente.partita_iva ? `P.IVA ${cliente.partita_iva}` : null,
    cliente.codice_fiscale ? `C.F. ${cliente.codice_fiscale}` : null,
    citta || null,
  ].filter(Boolean).join(' · ')

  content.push({ text: cliente.denominazione, bold: true, fontSize: 13, color: '#111827' })
  if (datiCliente) content.push({ text: datiCliente, fontSize: 9, color: COLORE_GRIGIO, margin: [0, 2, 0, 0] })
  if (filtriDescrizione) {
    content.push({ text: `Filtri applicati: ${filtriDescrizione}`, fontSize: 8.5, color: COLORE_GRIGIO, italics: true, margin: [0, 2, 0, 0] })
  }

  // -- Riquadri di sintesi --------------------------------------------
  const primo = riepilogo.anno_primo_contributo
  const ultimo = riepilogo.anno_ultimo_contributo
  const periodo = primo === null || ultimo === null
    ? TRATTINO
    : primo === ultimo ? String(primo) : `${primo} – ${ultimo}`

  const kpi = [
    ['Totale contributi', fmtEuro(riepilogo.totale_contributi)],
    ['Totale ESL', fmtEuro(riepilogo.totale_esl)],
    ['Numero contributi', String(riepilogo.numero_righe)],
    ['Periodo', periodo],
  ]
  const esclusi = riepilogo.esclusi_dai_totali
  content.push({
    margin: [0, 12, 0, esclusi > 0 ? 4 : 14],
    table: {
      widths: ['*', '*', '*', '*'],
      body: [kpi.map(([label, valore]) => ({
        fillColor: '#f0fdfc',
        margin: [6, 5, 6, 6],
        stack: [
          { text: label, fontSize: 7.5, color: COLORE_GRIGIO },
          { text: valore, fontSize: 13, bold: true, color: COLORE_TITOLI, margin: [0, 2, 0, 0] },
        ],
      }))],
    },
    layout: {
      hLineColor: () => '#99f6e4',
      vLineColor: () => '#99f6e4',
      hLineWidth: () => 0.75,
      vLineWidth: () => 0.75,
    },
  })
  if (esclusi > 0) {
    const quanti = esclusi === 1
      ? '1 contributo revocato o rinunciato'
      : `${esclusi} contributi revocati o rinunciati`
    content.push({
      text: `Esclusi dai totali: ${quanti}, riportati in grigio nel dettaglio.`,
      fontSize: 7.5,
      color: COLORE_GRIGIO,
      margin: [0, 0, 0, 14],
    })
  }

  // -- Tabella dettaglio, raggruppata per anno --------------------------
  content.push({ text: 'Dettaglio contributi', bold: true, fontSize: 10.5, color: COLORE_TITOLI, margin: [0, 0, 0, 5] })

  if (contributi.length === 0) {
    content.push({ text: 'Nessun contributo registrato', fontSize: 9, italics: true, color: COLORE_GRIGIO, margin: [0, 4, 0, 14] })
  } else {
    content.push(tabellaDettaglio(contributi, riepilogo))
  }

  // -- Riepilogo per forma ---------------------------------------------
  const formeUsate = FORME_CONTRIBUTO.filter(f => riepilogo.per_forma[f]?.count > 0)
  if (formeUsate.length > 0) {
    content.push({ text: 'Riepilogo per forma di agevolazione', bold: true, fontSize: 10.5, color: COLORE_TITOLI, margin: [0, 4, 0, 5] })
    const cella = (text: string, extra: any = {}) => ({ text, fontSize: 8, margin: [0, 3, 0, 3], ...extra })
    content.push({
      table: {
        headerRows: 1,
        widths: [190, 40, 100, 100],
        body: [
          [
            cella('Forma', { bold: true, color: 'white', fillColor: COLORE_PRIMARIO }),
            cella('N.', { bold: true, color: 'white', fillColor: COLORE_PRIMARIO, alignment: 'right' }),
            cella('Contributo', { bold: true, color: 'white', fillColor: COLORE_PRIMARIO, alignment: 'right' }),
            cella('ESL', { bold: true, color: 'white', fillColor: COLORE_PRIMARIO, alignment: 'right' }),
          ],
          ...formeUsate.map(f => {
            const v = riepilogo.per_forma[f]
            return [
              cella(FORMA_LABEL[f]),
              cella(String(v.count), { alignment: 'right' }),
              cella(fmtEuro(v.importo), { alignment: 'right' }),
              cella(fmtEuro(v.esl), { alignment: 'right' }),
            ]
          }),
          [
            cella('Totale', { bold: true }),
            cella(String(riepilogo.numero_righe), { bold: true, alignment: 'right' }),
            cella(fmtEuro(riepilogo.totale_contributi), { bold: true, alignment: 'right' }),
            cella(fmtEuro(riepilogo.totale_esl), { bold: true, alignment: 'right' }),
          ],
        ],
      },
      layout: layoutTabella(),
    })
  }

  // -- Nota finale -------------------------------------------------------
  content.push({
    text: 'Riepilogo elaborato da BLM Project sulla base dei dati registrati nel gestionale. '
      + 'Per la verifica dei massimali de minimis e del cumulo degli aiuti fa fede il '
      + 'Registro Nazionale degli Aiuti di Stato (rna.gov.it).',
    fontSize: 7,
    color: COLORE_ATTENUATO,
    margin: [0, 16, 0, 0],
  })

  const dataGenerazione = oggiIt()

  return {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: MARGINI,
    defaultStyle: { font: 'Helvetica', fontSize: 8 },
    info: { title: `Riepilogo contributi ottenuti — ${cliente.denominazione}`, author: 'BLM Project' },
    header: () => ({
      margin: [MARGINI[0], 24, MARGINI[2], 0],
      columns: [
        { text: 'Riepilogo contributi ottenuti', bold: true, fontSize: 11, color: COLORE_TITOLI },
        { text: dataGenerazione, fontSize: 9, color: COLORE_GRIGIO, alignment: 'right' },
      ],
    }),
    footer: (currentPage: number, pageCount: number) => ({
      margin: [MARGINI[0], 18, MARGINI[2], 0],
      columns: [
        { text: 'Gestionale Evolvi · BLM Project', fontSize: 7.5, color: COLORE_ATTENUATO },
        { text: `Pagina ${currentPage} di ${pageCount}`, fontSize: 7.5, color: COLORE_ATTENUATO, alignment: 'right' },
      ],
    }),
    content,
  }
}

// ----------------------------------------------------------------
// Tabella dettaglio
// ----------------------------------------------------------------

type ColonnaDettaglio = {
  label: string
  peso: number
  destra?: boolean
  valore: (c: ContributoWithJoins) => string | { text: string; [k: string]: any }
}

const COLONNE: ColonnaDettaglio[] = [
  { label: 'Bando', peso: 30, valore: c => c.bando?.nome || c.bando_denominazione_manuale || TRATTINO },
  { label: 'Ente', peso: 16, valore: c => c.bando?.ente_erogatore || c.ente_erogatore || TRATTINO },
  { label: 'Forma', peso: 14, valore: c => FORMA_LABEL[c.forma_contributo] ?? c.forma_contributo },
  { label: 'Importo progetto', peso: 12, destra: true, valore: c => fmtEuro(c.importo_progetto) },
  { label: 'Contributo', peso: 12, destra: true, valore: c => fmtEuro(c.importo_contributo) },
  { label: 'ESL', peso: 11, destra: true, valore: c => fmtEuro(c.esl) },
  { label: 'Intensità', peso: 8, destra: true, valore: c => fmtPct(c.intensita_aiuto_pct) },
  { label: 'Regime', peso: 16, valore: c => c.regime_aiuto || TRATTINO },
  {
    label: 'COR RNA',
    peso: 11,
    valore: c => c.rna_url
      ? { text: c.rna_codice_concessione || 'Apri', link: c.rna_url, color: COLORE_PRIMARIO, decoration: 'underline' }
      : (c.rna_codice_concessione || TRATTINO),
  },
  { label: 'Stato', peso: 11, valore: c => STATO_LABEL[c.stato] ?? c.stato },
  { label: 'Concessione', peso: 10, valore: c => fmtData(c.data_concessione) },
]

// Indici usati dalla riga di subtotale
const IDX_CONTRIBUTO = 4
const IDX_ESL = 5

const FONT_HEADER = 7.5
const FONT_BODY = 7

function layoutTabella() {
  return {
    hLineColor: () => COLORE_LINEE,
    vLineColor: () => COLORE_LINEE,
    hLineWidth: () => LINEA,
    vLineWidth: () => LINEA,
    paddingLeft: () => PADDING_X,
    paddingRight: () => PADDING_X,
  }
}

function tabellaDettaglio(contributi: ContributoWithJoins[], riepilogo: RiepilogoContributi): any {
  const n = COLONNE.length
  const disponibile = LARGHEZZA_UTILE - n * PADDING_X * 2 - (n + 1) * LINEA
  const sommaPesi = COLONNE.reduce((a, c) => a + c.peso, 0)
  const widths = COLONNE.map(c => Math.floor((c.peso / sommaPesi) * disponibile))

  const header = COLONNE.map(c => ({
    text: c.label,
    bold: true,
    color: 'white',
    fillColor: COLORE_PRIMARIO,
    fontSize: FONT_HEADER,
    alignment: c.destra ? 'right' : 'left',
    margin: [0, 4, 0, 4],
  }))

  // Raggruppa per anno, dal più recente
  const perAnno = new Map<number, ContributoWithJoins[]>()
  for (const c of contributi) {
    const lista = perAnno.get(c.anno_competenza) ?? []
    lista.push(c)
    perAnno.set(c.anno_competenza, lista)
  }
  const anni = Array.from(perAnno.keys()).sort((a, b) => b - a)
  const subtotali = new Map(riepilogo.per_anno.map(a => [a.anno, a]))

  const vuote = (k: number) => Array.from({ length: k }, () => ({}))
  const body: any[] = [header]

  for (const anno of anni) {
    // Intestazione anno su tutta la larghezza
    body.push([
      { text: String(anno), colSpan: n, bold: true, fontSize: 8.5, color: COLORE_TITOLI, fillColor: '#ccfbf1', margin: [0, 3, 0, 3] },
      ...vuote(n - 1),
    ])

    for (const c of perAnno.get(anno)!) {
      const attenuata = escludiDaiTotali(c.stato)
      body.push(COLONNE.map(col => {
        const v = col.valore(c)
        const base = typeof v === 'string' ? { text: v } : v
        return {
          ...base,
          fontSize: FONT_BODY,
          alignment: col.destra ? 'right' : 'left',
          margin: [0, 3, 0, 3],
          // Il link mantiene il suo colore; il resto della riga si attenua
          ...(attenuata && !('link' in base) ? { color: COLORE_ATTENUATO } : {}),
        }
      }))
    }

    // Subtotale: etichetta sulle colonne fino a "Importo progetto", poi Contributo ed ESL.
    // Viene da riepilogo.per_anno, che esclude già REVOCATO/RINUNCIATO: un anno con
    // sole righe escluse non è in per_anno e mostra 0 €.
    const sub = subtotali.get(anno)
    const stileSub = { italics: true, fontSize: FONT_BODY, alignment: 'right', margin: [0, 3, 0, 3], color: COLORE_GRIGIO }
    body.push([
      { text: `Subtotale ${anno}`, colSpan: IDX_CONTRIBUTO, ...stileSub },
      ...vuote(IDX_CONTRIBUTO - 1),
      { text: fmtEuro(sub?.importo ?? 0), ...stileSub, color: '#111827' },
      { text: fmtEuro(sub?.esl ?? 0), ...stileSub, color: '#111827' },
      { text: '', colSpan: n - IDX_ESL - 1 },
      ...vuote(n - IDX_ESL - 2),
    ])
  }

  return {
    table: {
      headerRows: 1,
      dontBreakRows: true,
      widths,
      body,
    },
    layout: layoutTabella(),
    margin: [0, 0, 0, 14],
  }
}
