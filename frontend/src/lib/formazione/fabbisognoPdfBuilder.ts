/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Costruisce un documento pdfmake per la rilevazione fabbisogno completata.
 * Restituisce il docDefinition; la generazione del Buffer e' a carico
 * dell'endpoint, che istanzia il PdfPrinter con i font corretti.
 */

// ----------------------------------------------------------------
// Etichette per gli enum (replicate dal componente manager)
// ----------------------------------------------------------------

const ROLE_LABELS: Record<string, string> = {
  TITOLARE_AMMINISTRATORE: 'Titolare / Amministratore',
  DIRETTORE_GENERALE: 'Direttore Generale',
  HR_MANAGER: 'HR Manager / Responsabile del personale',
  RESPONSABILE_FUNZIONE: 'Responsabile di funzione / area',
  RESPONSABILE_STABILIMENTO: 'Responsabile di stabilimento / sede',
  ALTRO: 'Altro',
}

const POPOLAZIONE_TARGET_LABELS: Record<string, string> = {
  TUTTA_AZIENDA: "Tutta l'azienda",
  FUNZIONE_SPECIFICA: 'Una specifica funzione / reparto',
  OPERATIVI: 'Solo figure operative / operai',
  IMPIEGATI: 'Solo figure impiegatizie',
  QUADRI_DIRIGENTI: 'Solo quadri e dirigenti',
  NEOASSUNTI: 'Neoassunti / nuove risorse',
}

const PIANO_LABELS: Record<string, string> = {
  SI_AGGIORNATO: 'Sì, aggiornato annualmente',
  SI_NON_AGGIORNATO: 'Sì, ma non aggiornato di recente',
  NO_CASO_PER_CASO: 'No, si pianifica caso per caso',
  NO_PRIMA_VOLTA: 'No, è la prima volta',
}

const CAMBIAMENTI_LABELS: Record<string, string> = {
  TECNOLOGIE: 'Nuove tecnologie / software',
  RIORGANIZZAZIONE: 'Riorganizzazione interna',
  COMMERCIALE: 'Espansione commerciale / nuovi mercati',
  NORMATIVE: 'Nuove normative / adempimenti',
  CRESCITA: 'Crescita personale / nuove assunzioni',
  NESSUNO: 'Nessun cambiamento rilevante',
}

const SCADENZE_LABELS: Record<string, string> = {
  SI: 'Sì',
  NO: 'No',
  DA_VERIFICARE: 'Da verificare',
}

const AREE_GAP_LABELS: Record<string, string> = {
  TECNICHE_RUOLO: 'Competenze tecniche di ruolo',
  DIGITALI_IA: 'Competenze digitali / IA',
  LINGUE: 'Lingue straniere',
  LEADERSHIP: 'Leadership e gestione collaboratori',
  COMUNICAZIONE: 'Comunicazione e teamwork',
  VENDITA: 'Vendita e gestione cliente',
  PROJECT_MGMT: 'Project management',
  LEAN_QUALITA: 'Qualità, lean, miglioramento continuo',
  CONTROLLO_GESTIONE: 'Controllo di gestione',
  COMPLIANCE: 'Compliance e contrattualistica',
  BENESSERE: 'Salute, benessere, gestione stress',
  ALTRO: 'Altro',
}

const FIGURE_LABELS: Record<string, string> = {
  OPERAI: 'Operai / personale operativo',
  IMPIEGATI_AMM: 'Impiegati amministrativi',
  TECNICI: 'Tecnici specializzati',
  COMMERCIALI: 'Commerciali / agenti',
  QUADRI: 'Quadri / responsabili intermedi',
  DIRIGENTI: 'Dirigenti / management',
  NEOASSUNTI: 'Neoassunti',
  TUTTE: 'Tutte le figure in egual misura',
}

const MODALITA_LABELS: Record<string, string> = {
  AULA_SEDE: 'Aula in sede',
  AULA_ESTERNA: 'Aula esterna / ente formativo',
  WEBINAR: 'Webinar / FAD sincrona',
  BLENDED: 'Blended (online + presenza)',
  ON_THE_JOB: 'Affiancamento on the job',
  COACHING: 'Coaching / mentoring individuale',
}

const BUDGET_LABELS: Record<string, string> = {
  FINO_3000: 'Fino a 3.000 €',
  '3001_10000': '3.001 — 10.000 €',
  '10001_30000': '10.001 — 30.000 €',
  OLTRE_30000: 'Oltre 30.000 €',
  NON_DEFINITO: 'Non definito',
}

const VINCOLI_LABELS: Record<string, string> = {
  LIBERARE_PERSONE: 'Difficoltà a liberare le persone',
  TURNI_RIGIDI: 'Turni / orari rigidi',
  SEDI_DISTACCATE: 'Sedi distaccate / personale disperso',
  BUDGET: 'Budget limitato',
  MOTIVAZIONE: 'Scarsa motivazione del personale',
  NESSUNO: 'Nessun vincolo rilevante',
}

const ORIZZONTE_LABELS: Record<string, string> = {
  ENTRO_3_MESI: 'Entro 3 mesi (urgente)',
  ENTRO_6_MESI: 'Entro 6 mesi',
  ENTRO_FINE_ANNO: 'Entro fine anno',
  PLURIENNALE: 'Pianificazione pluriennale',
}

const MISURAZIONE_LABELS: Record<string, string> = {
  TEST: 'Test / verifiche di apprendimento',
  FEEDBACK: 'Feedback partecipanti',
  PERFORMANCE: 'Valutazione performance post-formazione',
  KPI: 'Indicatori KPI aziendali',
  NON_MISURATA: 'Non viene misurata',
  ALTRO: 'Altro',
}

const STATO_OBBLIGO_LABELS: Record<string, string> = {
  ADEMPIUTO: 'Adempiuto',
  DA_RINNOVARE: 'Da rinnovare',
  NON_SVOLTO: 'Non svolto',
  NON_APPLICABILE: 'Non applicabile',
}

const TIPO_OBBLIGO_LABELS: Record<string, string> = {
  FORMAZIONE_LAVORATORI_RISCHIO_BASSO: 'Sicurezza lavoratori — rischio basso',
  FORMAZIONE_LAVORATORI_RISCHIO_MEDIO: 'Sicurezza lavoratori — rischio medio',
  FORMAZIONE_LAVORATORI_RISCHIO_ALTO: 'Sicurezza lavoratori — rischio alto',
  RSPP: 'RSPP',
  DIRIGENTI_SSL: 'Sicurezza dirigenti / datori di lavoro',
  PREPOSTI: 'Sicurezza preposti',
  RLS: 'RLS — Rappresentante Lavoratori per la Sicurezza',
  ANTINCENDIO_BASSO: 'Antincendio — rischio basso',
  ANTINCENDIO_MEDIO: 'Antincendio — rischio medio',
  ANTINCENDIO_ALTO: 'Antincendio — rischio alto',
  PRIMO_SOCCORSO: 'Primo soccorso',
  HACCP: 'HACCP',
  PRIVACY_GDPR: 'Privacy / GDPR',
  ANTIRICICLAGGIO: 'Antiriciclaggio',
  RESPONSABILITA_AMMINISTRATIVA_231: 'D.Lgs. 231/01',
  USO_ATTREZZATURE: 'Uso attrezzature / Accordo Stato-Regioni',
  ALTRO: 'Altro',
}

const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']

// ----------------------------------------------------------------
// Helpers di formattazione
// ----------------------------------------------------------------

function lookup(map: Record<string, string>, v: string | null | undefined): string {
  if (!v) return '—'
  return map[v] || v
}

function lookupArr(map: Record<string, string>, arr: string[] | null | undefined): string {
  if (!arr || arr.length === 0) return '—'
  return arr.map(v => lookup(map, v)).join(' · ')
}

function fmtData(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch {
    return iso
  }
}

function fmtVal(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—'
  return String(v)
}

// Etichette di intestazione/colore
const COL_TEAL = '#0d9488'
const COL_TEAL_BG = '#f0fdfa'
const COL_GRAY_BG = '#f9fafb'
const COL_GRAY_BORDER = '#e5e7eb'
const COL_TEXT = '#1f2937'
const COL_MUTED = '#6b7280'

// ----------------------------------------------------------------
// Componenti riusabili (oggetti pdfmake)
// ----------------------------------------------------------------

function sectionHeader(letter: string, title: string): any {
  return {
    table: {
      widths: [25, '*'],
      body: [
        [
          {
            text: letter,
            color: 'white',
            bold: true,
            fontSize: 14,
            alignment: 'center',
            fillColor: COL_TEAL,
            margin: [0, 6, 0, 4],
          },
          {
            text: title,
            bold: true,
            fontSize: 12,
            color: COL_TEAL,
            fillColor: COL_TEAL_BG,
            margin: [10, 8, 0, 4],
          },
        ],
      ],
    },
    layout: 'noBorders',
    margin: [0, 16, 0, 8],
  }
}

function questionBlock(label: string, value: string | any, notaInline?: string): any {
  return {
    stack: [
      { text: label, bold: true, fontSize: 9.5, color: COL_TEXT, margin: [0, 2, 0, 2] },
      typeof value === 'string'
        ? { text: value || '—', fontSize: 10, color: value ? COL_TEXT : COL_MUTED }
        : value,
      ...(notaInline
        ? [{ text: notaInline, fontSize: 8, italics: true, color: COL_MUTED, margin: [0, 1, 0, 0] }]
        : []),
    ],
    margin: [0, 0, 0, 8],
  }
}

function fieldGrid(items: Array<{ label: string; value: string }>): any {
  const rows: any[][] = []
  for (let i = 0; i < items.length; i += 2) {
    const a = items[i]
    const b = items[i + 1]
    rows.push([
      {
        stack: [
          { text: a.label, bold: true, fontSize: 9, color: COL_TEXT },
          { text: a.value || '—', fontSize: 10, color: a.value ? COL_TEXT : COL_MUTED, margin: [0, 1, 0, 0] },
        ],
      },
      b
        ? {
            stack: [
              { text: b.label, bold: true, fontSize: 9, color: COL_TEXT },
              { text: b.value || '—', fontSize: 10, color: b.value ? COL_TEXT : COL_MUTED, margin: [0, 1, 0, 0] },
            ],
          }
        : {},
    ])
  }
  return {
    table: { widths: ['*', '*'], body: rows },
    layout: { defaultBorder: false, paddingTop: () => 4, paddingBottom: () => 4, paddingLeft: () => 0, paddingRight: () => 6 },
    margin: [0, 0, 0, 6],
  }
}

function scaleDisplay(value: number | null | undefined, leftLabel: string, rightLabel: string): any {
  const cells: any[] = []
  for (let n = 1; n <= 5; n++) {
    const active = value === n
    cells.push({
      text: String(n),
      alignment: 'center',
      bold: true,
      fontSize: 11,
      color: active ? 'white' : COL_MUTED,
      fillColor: active ? COL_TEAL : 'white',
      border: [true, true, true, true],
      borderColor: [COL_GRAY_BORDER, COL_GRAY_BORDER, COL_GRAY_BORDER, COL_GRAY_BORDER],
      margin: [0, 5, 0, 5],
    })
  }
  return {
    columns: [
      { text: leftLabel, fontSize: 9, color: COL_MUTED, width: 70, margin: [0, 6, 0, 0] },
      {
        table: { widths: [30, 30, 30, 30, 30], body: [cells] },
        layout: {
          defaultBorder: true,
          hLineColor: () => COL_GRAY_BORDER,
          vLineColor: () => COL_GRAY_BORDER,
        },
        width: 'auto',
      },
      { text: rightLabel, fontSize: 9, color: COL_MUTED, alignment: 'right', margin: [4, 6, 0, 0] },
    ],
    margin: [0, 2, 0, 6],
  }
}

function checkList(items: string[]): any {
  if (!items || items.length === 0) return { text: '—', fontSize: 10, color: COL_MUTED }
  return {
    stack: items.map(t => ({
      columns: [
        { text: '☑', width: 12, color: COL_TEAL, fontSize: 10 },
        { text: t, fontSize: 10, color: COL_TEXT },
      ],
      margin: [0, 1, 0, 1],
    })),
  }
}

// ----------------------------------------------------------------
// Sezione C — tabella obblighi formativi
// ----------------------------------------------------------------

function sezioneCTable(obblighi: Array<{ tipo_obbligo: string; stato_dichiarato: string; stato_precompilato: string | null }>): any {
  const headerCells = ['Tipologia', 'Adempiuto', 'Da rinnovare', 'Non svolto', 'N/A'].map(t => ({
    text: t,
    bold: true,
    fontSize: 9,
    color: 'white',
    fillColor: COL_TEAL,
    alignment: 'center',
    margin: [2, 4, 2, 4],
  }))

  const dataRows = obblighi.map(o => {
    const stato = o.stato_dichiarato
    const mark = (key: string) => ({
      text: stato === key ? '●' : '',
      alignment: 'center',
      color: COL_TEAL,
      fontSize: 14,
      margin: [0, 1, 0, 0],
    })
    return [
      { text: TIPO_OBBLIGO_LABELS[o.tipo_obbligo] || o.tipo_obbligo, fontSize: 9.5, margin: [2, 4, 2, 4] },
      mark('ADEMPIUTO'),
      mark('DA_RINNOVARE'),
      mark('NON_SVOLTO'),
      mark('NON_APPLICABILE'),
    ]
  })

  return {
    table: {
      headerRows: 1,
      widths: ['*', 55, 60, 55, 35],
      body: [headerCells, ...dataRows],
    },
    layout: {
      hLineColor: () => COL_GRAY_BORDER,
      vLineColor: () => COL_GRAY_BORDER,
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
    },
    margin: [0, 2, 0, 8],
  }
}

// ----------------------------------------------------------------
// Tabelle popolazione e inserimenti
// ----------------------------------------------------------------

function popolazioneTable(rows: Array<{ area: string; numero_dipendenti: number | null; note: string | null }>): any {
  if (!rows || rows.length === 0) {
    return { text: 'Nessuna riga compilata.', fontSize: 9.5, italics: true, color: COL_MUTED, margin: [0, 0, 0, 6] }
  }
  const totale = rows.reduce((acc, r) => acc + (r.numero_dipendenti || 0), 0)
  const header = ['Area / dipartimento', 'N. dipendenti', 'Note'].map(t => ({
    text: t, bold: true, fontSize: 9, color: 'white', fillColor: COL_TEAL, margin: [3, 4, 3, 4],
  }))
  const body = rows.map(r => [
    { text: r.area, fontSize: 10, margin: [3, 3, 3, 3] },
    { text: r.numero_dipendenti != null ? String(r.numero_dipendenti) : '—', fontSize: 10, alignment: 'center', margin: [3, 3, 3, 3] },
    { text: r.note || '', fontSize: 9, italics: true, color: COL_MUTED, margin: [3, 3, 3, 3] },
  ])
  body.push([
    { text: 'TOTALE', bold: true, fontSize: 10, fillColor: COL_GRAY_BG, margin: [3, 4, 3, 4] },
    { text: String(totale), bold: true, fontSize: 10, alignment: 'center', color: COL_TEAL, fillColor: COL_GRAY_BG, margin: [3, 4, 3, 4] },
    { text: '', fillColor: COL_GRAY_BG, margin: [3, 4, 3, 4] },
  ] as any)
  return {
    table: { headerRows: 1, widths: ['*', 70, 150], body: [header, ...body] },
    layout: { hLineColor: () => COL_GRAY_BORDER, vLineColor: () => COL_GRAY_BORDER, hLineWidth: () => 0.5, vLineWidth: () => 0.5 },
    margin: [0, 2, 0, 8],
  }
}

function inserimentiTable(rows: Array<{ area: string; numero_inserimenti: number | null; periodo: string | null }>): any {
  if (!rows || rows.length === 0) {
    return { text: 'Nessun inserimento previsto.', fontSize: 9.5, italics: true, color: COL_MUTED, margin: [0, 0, 0, 6] }
  }
  const header = ['Area', 'N. inserimenti', 'Periodo'].map(t => ({
    text: t, bold: true, fontSize: 9, color: 'white', fillColor: COL_TEAL, margin: [3, 4, 3, 4],
  }))
  const body = rows.map(r => [
    { text: r.area, fontSize: 10, margin: [3, 3, 3, 3] },
    { text: r.numero_inserimenti != null ? String(r.numero_inserimenti) : '—', fontSize: 10, alignment: 'center', margin: [3, 3, 3, 3] },
    { text: r.periodo || '—', fontSize: 10, margin: [3, 3, 3, 3] },
  ])
  return {
    table: { headerRows: 1, widths: ['*', 80, 140], body: [header, ...body] },
    layout: { hLineColor: () => COL_GRAY_BORDER, vLineColor: () => COL_GRAY_BORDER, hLineWidth: () => 0.5, vLineWidth: () => 0.5 },
    margin: [0, 2, 0, 8],
  }
}

// ----------------------------------------------------------------
// Costruzione docDefinition completa
// ----------------------------------------------------------------

export interface FabbisognoPdfInput {
  rilevazione: any
  cliente: { denominazione?: string; partita_iva?: string } | null
  popolazione: Array<{ area: string; numero_dipendenti: number | null; note: string | null }>
  inserimenti_previsti: Array<{ area: string; numero_inserimenti: number | null; periodo: string | null }>
  obblighi_dichiarati: Array<{ tipo_obbligo: string; stato_dichiarato: string; stato_precompilato: string | null }>
}

export function buildFabbisognoDocDefinition(input: FabbisognoPdfInput): any {
  const r = input.rilevazione
  const cliente = input.cliente || {}

  // Intestazione: dati anagrafici
  const dataCompletamento = fmtData(r.data_completamento || r.updated_at)

  // ===== SEZIONE A =====
  const sezioneA = [
    sectionHeader('A', 'Anagrafica referente e contesto aziendale'),
    questionBlock('A1. Nome e cognome del referente', fmtVal(r.referente_nome)),
    questionBlock('A2. Ruolo / funzione ricoperta', lookup(ROLE_LABELS, r.referente_ruolo)),
    questionBlock('A3. Settore / attività e codice ATECO', fmtVal(r.ateco_dichiarato)),
    questionBlock('A4. CCNL applicato', fmtVal(r.ccnl_dichiarato)),
    questionBlock('A5. Numero dipendenti totali', fmtVal(r.numero_dipendenti_dichiarato)),
    { text: 'A6. Mappatura popolazione aziendale', bold: true, fontSize: 9.5, margin: [0, 6, 0, 2] },
    popolazioneTable(input.popolazione),
    { text: 'A7. Inserimenti previsti nei prossimi 6-12 mesi', bold: true, fontSize: 9.5, margin: [0, 4, 0, 2] },
    inserimentiTable(input.inserimenti_previsti),
    questionBlock(
      'A8. Per quale popolazione si compila il questionario',
      checkList((r.popolazione_target || []).map((v: string) => POPOLAZIONE_TARGET_LABELS[v] || v))
    ),
    ...(r.popolazione_target_specifica
      ? [questionBlock('A9. Specifica funzione / reparto', fmtVal(r.popolazione_target_specifica))]
      : []),
  ]

  // ===== SEZIONE B =====
  const sezioneB = [
    sectionHeader('B', 'Contesto e strategia formativa'),
    questionBlock('B1. L\'azienda ha già un piano formazione strutturato?', lookup(PIANO_LABELS, r.piano_formazione_esistente)),
    questionBlock('B2. Obiettivi strategici per i prossimi 12 mesi', fmtVal(r.obiettivi_strategici)),
    questionBlock('B3. Cambiamenti organizzativi o di mercato previsti', checkList((r.cambiamenti_previsti || []).map((v: string) => CAMBIAMENTI_LABELS[v] || v))),
  ]

  // ===== SEZIONE C =====
  const sezioneC: any[] = [
    sectionHeader('C', 'Formazione obbligatoria'),
    {
      text: 'C1. Stato della formazione obbligatoria per le tipologie dichiarate dal cliente',
      bold: true,
      fontSize: 9.5,
      margin: [0, 2, 0, 4],
    },
  ]
  if (input.obblighi_dichiarati.length > 0) {
    sezioneC.push(sezioneCTable(input.obblighi_dichiarati))
    const discrepanze = input.obblighi_dichiarati.filter(o => o.stato_precompilato && o.stato_precompilato !== o.stato_dichiarato)
    if (discrepanze.length > 0) {
      sezioneC.push({
        text: `⚠ ${discrepanze.length} discrepanza/e rispetto a quanto risulta nel gestionale. Voci interessate: ` +
          discrepanze.map(d => TIPO_OBBLIGO_LABELS[d.tipo_obbligo] || d.tipo_obbligo).join(', ') + '.',
        fontSize: 8.5,
        italics: true,
        color: '#92400e',
        fillColor: '#fef3c7',
        margin: [0, 2, 0, 6],
      })
    }
  } else {
    sezioneC.push({ text: 'Nessuna dichiarazione fornita.', fontSize: 9.5, italics: true, color: COL_MUTED, margin: [0, 2, 0, 6] })
  }
  sezioneC.push(questionBlock('C2. Scadenze imminenti (entro 6 mesi) per corsi obbligatori', lookup(SCADENZE_LABELS, r.scadenze_imminenti)))
  sezioneC.push(questionBlock('C3. Altri obblighi formativi specifici di settore', fmtVal(r.altri_obblighi_settore)))

  // ===== SEZIONE D =====
  const sezioneD = [
    sectionHeader('D', 'Fabbisogni formativi non obbligatori'),
    questionBlock('D1. Aree di gap competenza', checkList((r.aree_gap_competenze || []).map((v: string) => AREE_GAP_LABELS[v] || v))),
    questionBlock('D2. Altri fabbisogni non elencati', fmtVal(r.altri_fabbisogni)),
    { text: 'D3. Livello competenza attuale del personale nelle aree critiche', bold: true, fontSize: 9.5, margin: [0, 4, 0, 4] },
    scaleDisplay(r.livello_competenze_attuali, 'Molto basso', 'Molto alto'),
    questionBlock('D4. Figure professionali prioritarie', checkList((r.figure_prioritarie || []).map((v: string) => FIGURE_LABELS[v] || v))),
  ]

  // ===== SEZIONE E =====
  const sezioneE = [
    sectionHeader('E', 'Modalità, budget e vincoli'),
    questionBlock('E1. Modalità di erogazione compatibili', checkList((r.modalita_erogazione || []).map((v: string) => MODALITA_LABELS[v] || v))),
    questionBlock('E2. Budget annuo indicativo (formazione non obbligatoria)', lookup(BUDGET_LABELS, r.budget_annuo)),
    questionBlock('E3. Vincoli organizzativi alla formazione', checkList((r.vincoli_organizzativi || []).map((v: string) => VINCOLI_LABELS[v] || v))),
    questionBlock(
      'E4. Picchi di operatività (mesi da evitare)',
      (r.picchi_operativita || []).length > 0
        ? checkList((r.picchi_operativita as number[]).map(m => MESI[m - 1]))
        : '—'
    ),
  ]

  // ===== SEZIONE F =====
  const sezioneF = [
    sectionHeader('F', 'Valutazione e priorità'),
    questionBlock('F1. Orizzonte temporale di intervento', lookup(ORIZZONTE_LABELS, r.orizzonte_temporale)),
    { text: 'F2. Strategicità della formazione per gli obiettivi aziendali', bold: true, fontSize: 9.5, margin: [0, 4, 0, 4] },
    scaleDisplay(r.strategicita_formazione, 'Per nulla', 'Assolutamente'),
    questionBlock('F3. Misurazione dell\'efficacia della formazione', checkList((r.misurazione_efficacia || []).map((v: string) => MISURAZIONE_LABELS[v] || v))),
    questionBlock('F4. Note libere', fmtVal(r.note_libere)),
  ]

  // ===== INTESTAZIONE PAGINA =====
  const intestazione = [
    {
      table: {
        widths: ['*'],
        body: [[
          {
            stack: [
              { text: 'RILEVAZIONE DEI FABBISOGNI FORMATIVI', bold: true, fontSize: 16, color: 'white', alignment: 'center' },
              { text: 'Questionario compilato', fontSize: 10, color: '#ccfbf1', alignment: 'center', margin: [0, 2, 0, 0] },
            ],
            fillColor: COL_TEAL,
            margin: [0, 14, 0, 14],
          },
        ]],
      },
      layout: 'noBorders',
      margin: [0, 0, 0, 16],
    },
    fieldGrid([
      { label: 'Azienda', value: cliente.denominazione || '—' },
      { label: 'P. IVA', value: cliente.partita_iva || '—' },
      { label: 'Titolo rilevazione', value: r.titolo || '—' },
      { label: 'Anno di riferimento', value: r.anno_riferimento?.toString() || '—' },
      { label: 'Compilato il', value: dataCompletamento },
      { label: 'Stato', value: r.stato || '—' },
    ]),
    {
      text: 'Obiettivo: raccogliere una visione strategica e organizzativa dei fabbisogni formativi dell\'azienda per costruire un Piano della Formazione efficace e mirato.',
      fontSize: 8.5,
      italics: true,
      color: COL_MUTED,
      margin: [0, 4, 0, 0],
    },
  ]

  return {
    pageSize: 'A4',
    pageMargins: [40, 50, 40, 55],
    defaultStyle: { font: 'Helvetica', fontSize: 10, color: COL_TEXT, lineHeight: 1.25 },
    content: [
      ...intestazione,
      ...sezioneA,
      ...sezioneB,
      ...sezioneC,
      ...sezioneD,
      ...sezioneE,
      ...sezioneF,
    ],
    footer: function (currentPage: number, pageCount: number) {
      return {
        columns: [
          { text: 'Gestionale Evolvi · BLM Project', fontSize: 8, color: COL_MUTED, margin: [40, 20, 0, 0] },
          { text: `Pagina ${currentPage} di ${pageCount}`, fontSize: 8, color: COL_MUTED, alignment: 'right', margin: [0, 20, 40, 0] },
        ],
      }
    },
  }
}
