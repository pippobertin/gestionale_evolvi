/**
 * Importazione degli Open Data RNA per un intervallo di mesi.
 *
 * Uso (dalla cartella frontend):
 *   node --experimental-strip-types scripts/rna-import.mts 2020_01 2026_10
 *   node --experimental-strip-types scripts/rna-import.mts 2026_09          (un solo mese)
 *
 * Legge NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY da .env.local
 * (o dall'ambiente). Rieseguibile: gli aiuti vengono aggiornati per COR.
 */
import { readFileSync, existsSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { importaMeseRna, indiceClienti, elencoMesi } from '../src/lib/rna/importer.ts'

function caricaEnv() {
  if (!existsSync('.env.local')) return
  for (const riga of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = riga.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
  }
}

caricaEnv()
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('Mancano NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

const [da, a = da] = process.argv.slice(2)
if (!da || !/^\d{4}_\d{2}$/.test(da) || !/^\d{4}_\d{2}$/.test(a)) {
  console.error('Uso: node --experimental-strip-types scripts/rna-import.mts AAAA_MM [AAAA_MM]')
  process.exit(1)
}

const client = createClient(url, key, { auth: { persistSession: false } })
const indice = await indiceClienti(client)
console.log(`Clienti abbinabili (codici): ${indice.size}`)

const totali = { letti: 0, clienti: 0, nuovi: 0, aggiornati: 0, collegati: 0, errori: 0 }
for (const mese of elencoMesi(da, a)) {
  const e = await importaMeseRna({ client, mese, origine: 'BACKFILL', indice })
  totali.letti += e.aiuti_letti
  totali.clienti += e.aiuti_clienti
  totali.nuovi += e.nuovi
  totali.aggiornati += e.aggiornati
  totali.collegati += e.collegati_auto
  if (e.esito !== 'OK') totali.errori++
  console.log(
    `${mese}  ${e.esito.padEnd(6)} letti ${String(e.aiuti_letti).padStart(7)}  clienti ${String(e.aiuti_clienti).padStart(4)}` +
    `  nuovi ${String(e.nuovi).padStart(4)}  agg. ${String(e.aggiornati).padStart(4)}  collegati ${e.collegati_auto}` +
    `  ${(e.durata_ms / 1000).toFixed(1)}s${e.errore ? '  ERRORE: ' + e.errore : ''}`
  )
}
console.log('Totale:', totali)
