/**
 * Importazione manuale degli Open Data RNA per un intervallo di mesi.
 *
 * Uso (dalla cartella frontend, da una connessione italiana: rna.gov.it non
 * risponde ai server cloud):
 *   node --experimental-strip-types scripts/rna-import.mts 2020_01 2026_10
 *   node --experimental-strip-types scripts/rna-import.mts 2026_09          (un solo mese)
 *
 * Legge i file RNA in locale e invia gli aiuti al gestionale tramite la route
 * /api/rna/agente (nessun accesso diretto al database). Variabili da .env.local
 * o dall'ambiente: RNA_AGENT_URL (predefinito https://gestionale.blmproject.com)
 * e RNA_AGENT_SECRET. Rieseguibile: gli aiuti vengono aggiornati per COR.
 */
import { readFileSync, existsSync } from 'node:fs'
import { leggiFileMese, elencoMesi, type AiutoRna } from '../src/lib/rna/importer.ts'

if (existsSync('.env.local')) {
  for (const riga of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = riga.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
  }
}
const BASE = (process.env.RNA_AGENT_URL || 'https://gestionale.blmproject.com').replace(/\/$/, '')
const SEGRETO = process.env.RNA_AGENT_SECRET
if (!SEGRETO) { console.error('Manca RNA_AGENT_SECRET'); process.exit(1) }

const [da, a = da] = process.argv.slice(2)
if (!da || !/^\d{4}_\d{2}$/.test(da) || !/^\d{4}_\d{2}$/.test(a)) {
  console.error('Uso: node --experimental-strip-types scripts/rna-import.mts AAAA_MM [AAAA_MM]')
  process.exit(1)
}

async function chiama(azione: string, dati: Record<string, unknown> = {}): Promise<any> {
  const res = await fetch(`${BASE}/api/rna/agente`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-rna-agent-secret': SEGRETO as string },
    body: JSON.stringify({ azione, macchina: 'import-manuale', ...dati }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${azione}: HTTP ${res.status} ${json?.error || ''}`.trim())
  return json
}

const { codici } = await chiama('codici')
const ammessi = new Set<string>(codici)
console.log(`Clienti abbinabili (codici): ${ammessi.size}`)

const totali = { letti: 0, clienti: 0, nuovi: 0, aggiornati: 0, collegati: 0, errori: 0 }
for (const mese of elencoMesi(da, a)) {
  const t0 = Date.now()
  let e: any
  const aiuti: AiutoRna[] = []
  let letti = 0
  try {
    letti = await leggiFileMese(mese, ammessi, x => { aiuti.push(x) })
    e = (await chiama('salva_mese', { mese, origine: 'BACKFILL', aiuti, aiuti_letti: letti })).esito
  } catch (err) {
    e = (await chiama('errore_mese', { mese, origine: 'BACKFILL', errore: err instanceof Error ? err.message : String(err), aiuti_letti: letti })).esito
  }
  totali.letti += e.aiuti_letti
  totali.clienti += e.aiuti_clienti
  totali.nuovi += e.nuovi
  totali.aggiornati += e.aggiornati
  totali.collegati += e.collegati_auto
  if (e.esito !== 'OK') totali.errori++
  console.log(
    `${mese}  ${e.esito.padEnd(6)} letti ${String(e.aiuti_letti).padStart(7)}  clienti ${String(e.aiuti_clienti).padStart(4)}` +
    `  nuovi ${String(e.nuovi).padStart(4)}  agg. ${String(e.aggiornati).padStart(4)}  collegati ${e.collegati_auto}` +
    `  ${((Date.now() - t0) / 1000).toFixed(1)}s${e.errore ? '  ERRORE: ' + e.errore : ''}`
  )
}
console.log('Totale:', totali)
if (totali.errori > 0) process.exitCode = 1
