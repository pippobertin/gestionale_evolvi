/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Importazione degli Open Data del Registro Nazionale Aiuti (RNA).
 *
 * Fonte: https://www.rna.gov.it/open-data/aiuti — un file XML per mese di
 * concessione (OpenData_Aiuti_AAAA_MM.xml), aggiornato settimanalmente,
 * licenza CC BY 4.0.
 *
 * Il file viene letto in streaming (fino a ~350 MB decompressi) e vengono
 * tenuti solo gli aiuti il cui beneficiario ha codice fiscale o P.IVA uguale
 * a quello di un cliente del gestionale. Gli aiuti vengono salvati in
 * scadenze_bandi_rna_aiuti (upsert per COR, quindi rieseguibile).
 *
 * Classificazione: ogni aiuto entra tra gli "altri aiuti". Diventa "nostro"
 * solo se viene collegato a un contributo, a mano oppure automaticamente
 * quando nel gestionale esiste già il contributo corrispondente (stesso COR,
 * oppure stesso cliente, anno ±1 e importo ±1% con un solo candidato).
 *
 * Il file non usa alias di import e non ha dipendenze: lo stesso codice gira
 * nelle route Next.js e nello script locale (node --experimental-strip-types).
 * Il client Supabase viene passato da chi chiama.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ----------------------------------------------------------------
// Tipi
// ----------------------------------------------------------------

export type FormaContributo =
  | 'FONDO_PERDUTO' | 'CREDITO_IMPOSTA' | 'FINANZIAMENTO_AGEVOLATO'
  | 'GARANZIA' | 'CONTRIBUTO_INTERESSI' | 'MISTO'

export interface StrumentoRna {
  des_strumento: string | null
  elemento_aiuto: number
  importo_nominale: number
}

export interface ComponenteRna {
  des_procedimento: string | null
  cod_regolamento: string | null
  des_regolamento: string | null
  des_obiettivo: string | null
  settore_attivita: string | null
  strumenti: StrumentoRna[]
}

export interface AiutoRna {
  cor: string
  car: string | null
  titolo_misura: string | null
  des_tipo_misura: string | null
  soggetto_concedente: string | null
  data_concessione: string | null
  titolo_progetto: string | null
  descrizione_progetto: string | null
  cup: string | null
  atto_concessione: string | null
  link_atto_concessione: string | null
  link_trasparenza: string | null
  codice_fiscale_beneficiario: string
  denominazione_beneficiario: string | null
  des_tipo_beneficiario: string | null
  regione_beneficiario: string | null
  componenti: ComponenteRna[]
}

export interface EsitoImportMese {
  mese: string
  esito: 'OK' | 'ERRORE'
  aiuti_letti: number
  aiuti_clienti: number
  nuovi: number
  aggiornati: number
  collegati_auto: number
  durata_ms: number
  errore?: string
}

// ----------------------------------------------------------------
// Utilità
// ----------------------------------------------------------------

export const RNA_BASE_URL = 'https://www.rna.gov.it/sites/rna.mise.gov.it/files/opendata'

/**
 * URL del file del mese. I mesi con più di 500.000 aiuti sono divisi in più
 * file: OpenData_Aiuti_AAAA_MM.xml, poi _002, _003… (parte >= 2).
 */
export function urlFileMese(mese: string, parte = 1): string {
  const suffisso = parte > 1 ? `_${String(parte).padStart(3, '0')}` : ''
  return `${RNA_BASE_URL}/OpenData_Aiuti_${mese}${suffisso}.xml`
}

/** Numero massimo di aiuti per file: se un file lo raggiunge, esiste la parte successiva. */
const AIUTI_PER_FILE = 500000

/** 'AAAA_MM' dei mesi da `da` a `a` compresi (entrambi 'AAAA_MM'). */
export function elencoMesi(da: string, a: string): string[] {
  const [ya, ma] = da.split('_').map(Number)
  const [yb, mb] = a.split('_').map(Number)
  const out: string[] = []
  let y = ya, m = ma
  while (y < yb || (y === yb && m <= mb)) {
    out.push(`${y}_${String(m).padStart(2, '0')}`)
    m += 1
    if (m > 12) { m = 1; y += 1 }
  }
  return out
}

/** Gli ultimi `n` mesi fino a quello di `oggi` compreso, dal più recente. */
export function ultimiMesi(n: number, oggi: Date = new Date()): string[] {
  const out: string[] = []
  let y = oggi.getUTCFullYear(), m = oggi.getUTCMonth() + 1
  for (let i = 0; i < n; i++) {
    out.push(`${y}_${String(m).padStart(2, '0')}`)
    m -= 1
    if (m < 1) { m = 12; y -= 1 }
  }
  return out
}

/** Normalizza codice fiscale / P.IVA per l'abbinamento. */
export function normalizzaCodice(v: unknown): string | null {
  if (v === null || v === undefined) return null
  let s = String(v).replace(/[\s.\-]/g, '').toUpperCase()
  if (s.startsWith('IT') && /^\d+$/.test(s.slice(2))) s = s.slice(2)
  if (/^\d+$/.test(s) && s.length >= 8 && s.length < 11) s = s.padStart(11, '0')
  return s || null
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

/** Primo valore del tag `nome` nel frammento (null se assente o vuoto). */
function tag(xml: string, nome: string): string | null {
  const ap = `<${nome}>`
  const i = xml.indexOf(ap)
  if (i < 0) return null
  const j = xml.indexOf(`</${nome}>`, i + ap.length)
  if (j < 0) return null
  const v = decodeEntities(xml.slice(i + ap.length, j)).trim()
  return v === '' ? null : v
}

/** Tutti i blocchi <nome>...</nome> nel frammento. */
function blocchi(xml: string, nome: string): string[] {
  const out: string[] = []
  const ap = `<${nome}>`, ch = `</${nome}>`
  let from = 0
  for (;;) {
    const i = xml.indexOf(ap, from)
    if (i < 0) break
    const j = xml.indexOf(ch, i + ap.length)
    if (j < 0) break
    out.push(xml.slice(i + ap.length, j))
    from = j + ch.length
  }
  return out
}

const num = (v: string | null) => {
  const n = v == null ? 0 : Number(v.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}
const round2 = (n: number) => Math.round(n * 100) / 100

function parseAiuto(xml: string, cf: string): AiutoRna | null {
  const cor = tag(xml, 'COR')
  if (!cor) return null
  const componenti: ComponenteRna[] = blocchi(xml, 'COMPONENTE_AIUTO').map(c => ({
    des_procedimento: tag(c, 'DES_PROCEDIMENTO'),
    cod_regolamento: tag(c, 'COD_REGOLAMENTO'),
    des_regolamento: tag(c, 'DES_REGOLAMENTO'),
    des_obiettivo: tag(c, 'DES_OBIETTIVO'),
    settore_attivita: tag(c, 'SETTORE_ATTIVITA'),
    strumenti: blocchi(c, 'STRUMENTO_AIUTO').map(s => ({
      des_strumento: tag(s, 'DES_STRUMENTO'),
      elemento_aiuto: num(tag(s, 'ELEMENTO_DI_AIUTO')),
      importo_nominale: num(tag(s, 'IMPORTO_NOMINALE')),
    })),
  }))
  const cup = tag(xml, 'CUP')
  return {
    cor,
    car: tag(xml, 'CAR'),
    titolo_misura: tag(xml, 'TITOLO_MISURA'),
    des_tipo_misura: tag(xml, 'DES_TIPO_MISURA'),
    soggetto_concedente: tag(xml, 'SOGGETTO_CONCEDENTE'),
    data_concessione: tag(xml, 'DATA_CONCESSIONE'),
    titolo_progetto: tag(xml, 'TITOLO_PROGETTO'),
    descrizione_progetto: tag(xml, 'DESCRIZIONE_PROGETTO'),
    cup: cup && cup.toLowerCase() !== 'n.d.' ? cup : null,
    atto_concessione: tag(xml, 'ATTO_CONCESSIONE'),
    link_atto_concessione: tag(xml, 'LINK_ATTO_CONCESSIONE'),
    link_trasparenza: tag(xml, 'LINK_TRASPARENZA_NAZIONALE'),
    codice_fiscale_beneficiario: cf,
    denominazione_beneficiario: tag(xml, 'DENOMINAZIONE_BENEFICIARIO'),
    des_tipo_beneficiario: tag(xml, 'DES_TIPO_BENEFICIARIO'),
    regione_beneficiario: tag(xml, 'REGIONE_BENEFICIARIO'),
    componenti,
  }
}

/**
 * Legge tutti i file del mese (anche le parti _002, _003… dei mesi molto
 * grandi) e chiama `onAiuto` per ogni aiuto il cui beneficiario è in
 * `codiciAmmessi`. Restituisce il numero di aiuti letti.
 */
export async function leggiFileMese(
  mese: string,
  codiciAmmessi: Set<string>,
  onAiuto: (a: AiutoRna) => void
): Promise<number> {
  let totale = 0
  for (let parte = 1; parte <= 20; parte++) {
    const letti = await leggiFile(urlFileMese(mese, parte), codiciAmmessi, onAiuto)
    totale += letti
    if (letti < AIUTI_PER_FILE) break
  }
  return totale
}

/**
 * Scarica un file Open Data e chiama `onAiuto` per gli aiuti dei beneficiari
 * ammessi. Tollerante ai caratteri non validi presenti negli XML RNA (non usa
 * un parser XML rigoroso). Un file inesistente (404) vale 0 aiuti.
 */
async function leggiFile(
  url: string,
  codiciAmmessi: Set<string>,
  onAiuto: (a: AiutoRna) => void
): Promise<number> {
  const res = await fetch(url, { headers: { 'Accept-Encoding': 'gzip' } })
  if (res.status === 404) return 0 // mese o parte non (ancora) pubblicati
  if (!res.ok || !res.body) throw new Error(`Download ${url.split('/').pop()}: HTTP ${res.status}`)

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  const AP = '<AIUTO>', CH = '</AIUTO>'
  let buf = ''
  let letti = 0

  const consuma = () => {
    let from = 0
    for (;;) {
      const i = buf.indexOf(AP, from)
      if (i < 0) { buf = buf.slice(Math.max(from, buf.length - AP.length)); return }
      const j = buf.indexOf(CH, i + AP.length)
      if (j < 0) { buf = buf.slice(i); return }
      const xml = buf.slice(i + AP.length, j)
      from = j + CH.length
      letti++
      const cf = normalizzaCodice(tag(xml, 'CODICE_FISCALE_BENEFICIARIO'))
      if (cf && codiciAmmessi.has(cf)) {
        const a = parseAiuto(xml, cf)
        if (a) onAiuto(a)
      }
    }
  }

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    consuma()
  }
  buf += decoder.decode()
  consuma()
  return letti
}

// ----------------------------------------------------------------
// Classificazione degli strumenti RNA
// ----------------------------------------------------------------

/**
 * Converte le descrizioni DES_STRUMENTO RNA nella forma del gestionale.
 * La categoria RNA "Sovvenzione/Contributo in conto interessi" comprende sia
 * il fondo perduto sia il contributo in conto interessi: si propone
 * FONDO_PERDUTO, da confermare quando l'aiuto viene portato tra i nostri.
 */
export function formaDaStrumenti(strumenti: string[]): FormaContributo | null {
  const una = (s: string): FormaContributo => {
    const t = s.toLowerCase()
    // "Garanzia (se del caso con un riferimento alla decisione della Commissione…)"
    // è una garanzia; "abbuono delle commissioni di garanzia" invece è una sovvenzione.
    if (t.startsWith('garanzia') || (t.includes('garanzia') && !t.includes('commissioni'))) return 'GARANZIA'
    if (t.includes('prestito') || t.includes('anticipo rimborsabile')) return 'FINANZIAMENTO_AGEVOLATO'
    if (t.includes('fiscal')) return 'CREDITO_IMPOSTA'
    if (t.includes('finanziamento del rischio')) return 'MISTO'
    return 'FONDO_PERDUTO'
  }
  const forme: FormaContributo[] = []
  strumenti.forEach(s => { const f = una(s); if (forme.indexOf(f) < 0) forme.push(f) })
  if (forme.length === 0) return null
  return forme.length > 1 ? 'MISTO' : forme[0]
}

export function ambitoAiuto(a: Pick<AiutoRna, 'titolo_misura' | 'soggetto_concedente'>): {
  ambito: 'FPI' | 'GARANZIA_PMI' | 'ALTRO'
  fondo: string | null
} {
  const t = (a.titolo_misura || '').toLowerCase()
  if (t.includes('fondi interprofessionali')) {
    return { ambito: 'FPI', fondo: (a.soggetto_concedente || '').trim() || null }
  }
  if (t.includes('fondo di garanzia per le piccole e medie imprese')) {
    return { ambito: 'GARANZIA_PMI', fondo: null }
  }
  return { ambito: 'ALTRO', fondo: null }
}

/** Regolamenti de minimis "generali" usati per la capienza da 300.000 €. */
export const REGOLAMENTI_DE_MINIMIS_GENERALI = ['CE2831/23', 'CE1407/13']

function uniq(arr: Array<string | null>): string[] {
  const out: string[] = []
  arr.forEach(v => { if (v && out.indexOf(v) < 0) out.push(v) })
  return out
}

/** Riga per scadenze_bandi_rna_aiuti (senza i campi di collegamento). */
export function rigaDaAiuto(a: AiutoRna, clienteId: string, mese: string): Record<string, unknown> {
  const strumenti: string[] = []
  const procedimenti: Array<string | null> = []
  const regolamenti: Array<string | null> = []
  const codRegolamenti: Array<string | null> = []
  let esl = 0, nominale = 0
  a.componenti.forEach(c => {
    procedimenti.push(c.des_procedimento)
    regolamenti.push(c.des_regolamento)
    codRegolamenti.push(c.cod_regolamento)
    c.strumenti.forEach(s => {
      if (s.des_strumento) strumenti.push(s.des_strumento)
      esl += s.elemento_aiuto
      nominale += s.importo_nominale
    })
  })
  const proc = uniq(procedimenti)
  const { ambito, fondo } = ambitoAiuto(a)
  const anno = a.data_concessione ? Number(a.data_concessione.slice(0, 4)) : null
  return {
    cor: a.cor,
    car: a.car,
    titolo_misura: a.titolo_misura,
    des_tipo_misura: a.des_tipo_misura,
    soggetto_concedente: a.soggetto_concedente,
    data_concessione: a.data_concessione,
    anno_concessione: Number.isFinite(anno as number) ? anno : null,
    titolo_progetto: a.titolo_progetto,
    descrizione_progetto: a.descrizione_progetto,
    cup: a.cup,
    atto_concessione: a.atto_concessione,
    link_atto_concessione: a.link_atto_concessione,
    link_trasparenza: a.link_trasparenza,
    codice_fiscale_beneficiario: a.codice_fiscale_beneficiario,
    denominazione_beneficiario: a.denominazione_beneficiario,
    des_tipo_beneficiario: a.des_tipo_beneficiario,
    regione_beneficiario: a.regione_beneficiario,
    cliente_id: clienteId,
    procedimenti: proc,
    regolamenti: uniq(regolamenti),
    cod_regolamenti: uniq(codRegolamenti),
    strumenti: uniq(strumenti),
    forma_proposta: formaDaStrumenti(uniq(strumenti)),
    importo_nominale: round2(nominale),
    elemento_aiuto: round2(esl),
    de_minimis: proc.some(p => p.toLowerCase().includes('minimis')),
    ambito,
    fondo_interprofessionale: fondo,
    componenti: a.componenti,
    file_origine: `OpenData_Aiuti_${mese}.xml`,
  }
}

/** Testo regime per il campo regime_aiuto del contributo. */
export function regimeDaRegolamenti(regolamenti: string[]): string | null {
  const r = regolamenti.map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean)
  return r.length ? r.join('; ') : null
}

// ----------------------------------------------------------------
// Lettura paginata (Supabase restituisce al massimo 1000 righe)
// ----------------------------------------------------------------

async function selectTutto(client: SupabaseClient, tabella: string, colonne: string): Promise<any[]> {
  const out: any[] = []
  const pagina = 1000
  for (let from = 0; ; from += pagina) {
    const { data, error } = await client.from(tabella).select(colonne).range(from, from + pagina - 1)
    if (error) throw new Error(`Lettura ${tabella}: ${error.message}`)
    out.push(...(data || []))
    if (!data || data.length < pagina) break
  }
  return out
}

/** Mappa codice normalizzato -> cliente_id (clienti senza CF/P.IVA esclusi). */
export async function indiceClienti(client: SupabaseClient): Promise<Map<string, string>> {
  const clienti = await selectTutto(client, 'scadenze_bandi_clienti', 'id, codice_fiscale, partita_iva')
  const idx = new Map<string, string>()
  clienti.forEach((c: any) => {
    ;[normalizzaCodice(c.codice_fiscale), normalizzaCodice(c.partita_iva)].forEach(k => {
      if (k && !idx.has(k)) idx.set(k, c.id)
    })
  })
  return idx
}

// ----------------------------------------------------------------
// Collegamento automatico ai contributi già presenti
// ----------------------------------------------------------------

/**
 * Collega gli aiuti RNA non ancora collegati ai contributi già presenti nel
 * gestionale (solo per i clienti indicati):
 *  1. stesso COR (contributo.rna_codice_concessione)
 *  2. stesso cliente, anno ±1, importo ±1% (nominale o ESL), con un solo
 *     candidato in entrambe le direzioni.
 * Compila nel contributo solo i campi vuoti: COR, ESL, regime, ente, link
 * (e la data di concessione per i contributi non legati a un progetto).
 * Restituisce quanti collegamenti sono stati creati.
 */
export async function collegaAutomaticamente(client: SupabaseClient, clienteIds: string[]): Promise<number> {
  if (clienteIds.length === 0) return 0
  let collegati = 0
  const CH = 100
  for (let k = 0; k < clienteIds.length; k += CH) {
    const ids = clienteIds.slice(k, k + CH)
    const [{ data: aiuti, error: e1 }, { data: contributi, error: e2 }] = await Promise.all([
      client.from('scadenze_bandi_rna_aiuti')
        .select('id, cor, cliente_id, anno_concessione, data_concessione, importo_nominale, elemento_aiuto, regolamenti, soggetto_concedente, link_atto_concessione, link_trasparenza, contributo_id, escludi_collegamento_auto')
        .in('cliente_id', ids),
      client.from('scadenze_bandi_contributi_ottenuti')
        .select('id, cliente_id, anno_competenza, importo_contributo, esl, regime_aiuto, ente_erogatore, rna_codice_concessione, rna_url, data_concessione, origine, progetto_id')
        .in('cliente_id', ids),
    ])
    if (e1) throw new Error(`Lettura aiuti: ${e1.message}`)
    if (e2) throw new Error(`Lettura contributi: ${e2.message}`)

    const giaCollegati = new Set<string>()
    ;(aiuti || []).forEach((a: any) => { if (a.contributo_id) giaCollegati.add(a.contributo_id) })
    const liberiA = (aiuti || []).filter((a: any) => !a.contributo_id && !a.escludi_collegamento_auto)
    const liberiC = (contributi || []).filter((c: any) => !giaCollegati.has(c.id))

    const coppie: Array<{ a: any; c: any }> = []
    const usatiA = new Set<string>(), usatiC = new Set<string>()

    // 1. Stesso COR
    liberiA.forEach((a: any) => {
      const c = liberiC.find((x: any) => x.rna_codice_concessione && x.rna_codice_concessione.trim() === a.cor)
      if (c && !usatiC.has(c.id)) { coppie.push({ a, c }); usatiA.add(a.id); usatiC.add(c.id) }
    })

    // 2. Cliente + anno ±1 + importo ±1% (nominale o ESL).
    //    Ogni coppia compatibile riceve un punteggio: importo esatto (±1 €) prima
    //    di quello approssimato, poi anno uguale prima di anno ±1, poi scarto minore.
    //    Si collegano le coppie dalla migliore, solo se per quel contributo e per
    //    quell'aiuto non esiste un'altra coppia con lo stesso punteggio (ambiguità).
    const punteggio = (a: any, c: any): number[] | null => {
      if (a.cliente_id !== c.cliente_id || c.rna_codice_concessione) return null
      if (a.anno_concessione == null) return null
      const dAnno = Math.abs(a.anno_concessione - c.anno_competenza)
      if (dAnno > 1) return null
      const imp = Number(c.importo_contributo) || 0
      if (imp <= 0) return null
      const scarto = Math.min(
        Math.abs((Number(a.importo_nominale) || 0) - imp),
        Math.abs((Number(a.elemento_aiuto) || 0) - imp)
      )
      if (scarto > Math.max(1, imp * 0.01)) return null
      return [scarto <= 1 ? 0 : 1, dAnno, scarto]
    }
    const confronta = (x: number[], y: number[]) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2]
    const candidati: Array<{ a: any; c: any; p: number[] }> = []
    liberiA.filter((a: any) => !usatiA.has(a.id)).forEach((a: any) => {
      liberiC.filter((c: any) => !usatiC.has(c.id)).forEach((c: any) => {
        const p = punteggio(a, c)
        if (p) candidati.push({ a, c, p })
      })
    })
    candidati.sort((x, y) => confronta(x.p, y.p))
    candidati.forEach(({ a, c, p }) => {
      if (usatiA.has(a.id) || usatiC.has(c.id)) return
      const pari = candidati.filter(k =>
        (k.a.id === a.id) !== (k.c.id === c.id) &&
        !usatiA.has(k.a.id) && !usatiC.has(k.c.id) && confronta(k.p, p) === 0)
      if (pari.length > 0) return
      coppie.push({ a, c }); usatiA.add(a.id); usatiC.add(c.id)
    })

    for (const { a, c } of coppie) {
      const agg: Record<string, unknown> = {}
      if (!c.rna_codice_concessione) agg.rna_codice_concessione = a.cor
      if (c.esl == null && a.elemento_aiuto != null) agg.esl = a.elemento_aiuto
      if (!c.regime_aiuto) agg.regime_aiuto = regimeDaRegolamenti(a.regolamenti || [])
      if (!c.ente_erogatore && a.soggetto_concedente) agg.ente_erogatore = a.soggetto_concedente
      if (!c.rna_url) agg.rna_url = a.link_atto_concessione || a.link_trasparenza || null
      if (!c.data_concessione && !c.progetto_id && a.data_concessione) agg.data_concessione = a.data_concessione
      if (Object.keys(agg).length) {
        const { error } = await client.from('scadenze_bandi_contributi_ottenuti').update(agg).eq('id', c.id)
        if (error) throw new Error(`Aggiornamento contributo: ${error.message}`)
      }
      const { error } = await client.from('scadenze_bandi_rna_aiuti')
        .update({ contributo_id: c.id, collegamento_automatico: true })
        .eq('id', a.id).is('contributo_id', null)
      if (error) throw new Error(`Collegamento aiuto: ${error.message}`)
      collegati++
    }
  }
  return collegati
}

// ----------------------------------------------------------------
// Importazione di un mese
// ----------------------------------------------------------------

export async function importaMeseRna(opts: {
  client: SupabaseClient
  mese: string
  origine?: 'CRON' | 'BACKFILL' | 'MANUALE'
  indice?: Map<string, string>
}): Promise<EsitoImportMese> {
  const { client, mese, origine = 'MANUALE' } = opts
  const t0 = Date.now()
  const { data: log } = await client.from('scadenze_bandi_rna_import_log')
    .insert({ mese, origine, esito: 'IN_CORSO' }).select('id').single()
  const logId: string | undefined = (log as any)?.id

  const esito: EsitoImportMese = {
    mese, esito: 'OK', aiuti_letti: 0, aiuti_clienti: 0, nuovi: 0, aggiornati: 0, collegati_auto: 0, durata_ms: 0,
  }

  try {
    const indice = opts.indice ?? await indiceClienti(client)
    const codici = new Set<string>(Array.from(indice.keys()))
    const trovati = new Map<string, AiutoRna>()
    esito.aiuti_letti = await leggiFileMese(mese, codici, a => { trovati.set(a.cor, a) })
    esito.aiuti_clienti = trovati.size

    const lista = Array.from(trovati.values())
    const clientiToccati = new Set<string>()
    const CH = 200
    for (let k = 0; k < lista.length; k += CH) {
      const blocco = lista.slice(k, k + CH)
      const cors = blocco.map(a => a.cor)
      const { data: esistenti, error: eSel } = await client.from('scadenze_bandi_rna_aiuti')
        .select('cor, contributo_id, importo_nominale, elemento_aiuto, data_concessione, modificato_da_rna_at')
        .in('cor', cors)
      if (eSel) throw new Error(`Lettura aiuti esistenti: ${eSel.message}`)
      const perCor = new Map<string, any>()
      ;(esistenti || []).forEach((e: any) => perCor.set(e.cor, e))

      const righe = blocco.map(a => {
        const clienteId = indice.get(a.codice_fiscale_beneficiario) as string
        clientiToccati.add(clienteId)
        const riga = rigaDaAiuto(a, clienteId, mese)
        const e = perCor.get(a.cor)
        let modificato = e?.modificato_da_rna_at ?? null
        if (e && e.contributo_id) {
          const cambiato =
            round2(Number(e.importo_nominale) || 0) !== riga.importo_nominale ||
            round2(Number(e.elemento_aiuto) || 0) !== riga.elemento_aiuto ||
            (e.data_concessione || null) !== (riga.data_concessione || null)
          if (cambiato) modificato = new Date().toISOString()
        }
        riga.modificato_da_rna_at = modificato
        if (e) esito.aggiornati++; else esito.nuovi++
        return riga
      })

      const { error: eUp } = await client.from('scadenze_bandi_rna_aiuti').upsert(righe, { onConflict: 'cor' })
      if (eUp) throw new Error(`Salvataggio aiuti: ${eUp.message}`)
    }

    esito.collegati_auto = await collegaAutomaticamente(client, Array.from(clientiToccati))
  } catch (err) {
    esito.esito = 'ERRORE'
    esito.errore = err instanceof Error ? err.message : String(err)
  }

  esito.durata_ms = Date.now() - t0
  if (logId) {
    await client.from('scadenze_bandi_rna_import_log').update({
      esito: esito.esito,
      aiuti_letti: esito.aiuti_letti,
      aiuti_clienti: esito.aiuti_clienti,
      nuovi: esito.nuovi,
      aggiornati: esito.aggiornati,
      collegati_auto: esito.collegati_auto,
      durata_ms: esito.durata_ms,
      errore: esito.errore ?? null,
      completato_at: new Date().toISOString(),
    }).eq('id', logId)
  }
  return esito
}
