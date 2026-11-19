/**
 * Agente RNA per il Mac (lanciato da launchd ogni 5 minuti, vedi rna-mac-install.sh).
 *
 * rna.gov.it non risponde ai server cloud, quindi il Mac scarica e legge i
 * file Open Data e il gestionale salva i dati. L'agente NON accede più
 * direttamente al database: parla solo con la route /api/rna/agente del
 * gestionale, autenticandosi con RNA_AGENT_SECRET.
 *
 * A ogni giro:
 *   1. "avvio": segnala che il Mac è attivo, rimette in coda le richieste
 *      rimaste a metà e riceve la prossima richiesta da eseguire (manuale dal
 *      pulsante "Aggiorna da RNA", oppure automatica: ultimi 4 mesi ogni 7
 *      giorni, storico dal 2020 ogni 30 giorni)
 *   2. per ogni mese: legge il file RNA filtrando sui codici dei clienti e
 *      invia gli aiuti trovati al gestionale, che li salva
 *
 * Variabili (in .env.local accanto all'agente):
 *   RNA_AGENT_URL     indirizzo del gestionale (predefinito https://gestionale.blmproject.com)
 *   RNA_AGENT_SECRET  segreto condiviso con il gestionale (variabile omonima su Vercel)
 *
 * Uso manuale:  node --experimental-strip-types scripts/rna-agent.mts
 */
import { readFileSync, existsSync } from 'node:fs'
import { hostname } from 'node:os'
import { leggiFileMese, elencoMesi, type AiutoRna } from '../src/lib/rna/importer.ts'

if (existsSync('.env.local')) {
  for (const riga of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = riga.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
  }
}
const BASE = (process.env.RNA_AGENT_URL || 'https://gestionale.blmproject.com').replace(/\/$/, '')
const SEGRETO = process.env.RNA_AGENT_SECRET
if (!SEGRETO) { console.error('Manca RNA_AGENT_SECRET in .env.local'); process.exit(1) }
const macchina = hostname().replace(/\.local$/, '') || 'mac'
const ora = () => new Date().toISOString()

async function chiama(azione: string, dati: Record<string, unknown> = {}): Promise<any> {
  const res = await fetch(`${BASE}/api/rna/agente`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-rna-agent-secret': SEGRETO as string },
    body: JSON.stringify({ azione, macchina, ...dati }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`${azione}: HTTP ${res.status} ${json?.error || ''}`.trim())
  return json
}

const aggiorna = (id: string, campi: Record<string, unknown>) => chiama('aggiorna', { id, campi })

async function esegui(req: any) {
  const mesi = elencoMesi(req.mese_da, req.mese_a)
  const origine = req.origine === 'AUTOMATICA' ? 'CRON' : 'MANUALE'
  await aggiorna(req.id, { stato: 'IN_CORSO', avviata_at: ora(), mesi_totali: mesi.length, mesi_completati: 0, errore: null })
  console.log(`${ora()} richiesta ${req.origine} ${req.mese_da} → ${req.mese_a} (${mesi.length} mesi)`)

  const { codici } = await chiama('codici')
  const ammessi = new Set<string>(codici)
  const tot = { clienti: 0, nuovi: 0, aggiornati: 0, collegati: 0, errori: 0 }
  const errori: string[] = []

  for (let i = 0; i < mesi.length; i++) {
    const mese = mesi[i]
    await chiama('battito', { stato: `in corso ${mese}` })
    await aggiorna(req.id, { mese_corrente: mese })

    let e: any
    const aiuti: AiutoRna[] = []
    let letti = 0
    try {
      letti = await leggiFileMese(mese, ammessi, a => { aiuti.push(a) })
      e = (await chiama('salva_mese', { mese, origine, aiuti, aiuti_letti: letti })).esito
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      e = (await chiama('errore_mese', { mese, origine, errore: msg, aiuti_letti: letti })).esito
    }

    tot.clienti += e.aiuti_clienti; tot.nuovi += e.nuovi; tot.aggiornati += e.aggiornati; tot.collegati += e.collegati_auto
    if (e.esito !== 'OK') { tot.errori++; errori.push(`${mese}: ${e.errore}`) }
    console.log(`  ${mese} ${e.esito} clienti ${e.aiuti_clienti} nuovi ${e.nuovi} collegati ${e.collegati_auto}${e.errore ? ' ' + e.errore : ''}`)
    await aggiorna(req.id, {
      mesi_completati: i + 1, aiuti_clienti: tot.clienti, nuovi: tot.nuovi,
      aggiornati: tot.aggiornati, collegati_auto: tot.collegati, mesi_in_errore: tot.errori,
    })
  }

  await aggiorna(req.id, {
    stato: tot.errori === mesi.length ? 'ERRORE' : 'OK',
    errore: errori.length ? errori.slice(0, 5).join(' | ') : null,
    mese_corrente: null,
    completata_at: ora(),
  })
}

try {
  const { richiesta } = await chiama('avvio')
  if (richiesta) await esegui(richiesta)
  await chiama('battito', { stato: 'in ascolto' })
} catch (err) {
  console.error(ora(), 'Errore agente RNA:', err instanceof Error ? err.message : err)
  process.exitCode = 1
}
