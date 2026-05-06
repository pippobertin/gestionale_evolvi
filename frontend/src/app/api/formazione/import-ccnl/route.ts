import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyJWT } from '@/lib/jwtAuth'
import * as fs from 'fs'
import * as path from 'path'

interface CsvRow {
  categoria: string
  settore: string
  contraenti: string[]
  dataStipula: Date
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ';' && !inQuotes) {
      fields.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current.trim())
  return fields
}

function parseDate(s: string): Date {
  if (!s) return new Date(1900, 0, 1)
  const parts = s.split('/')
  if (parts.length === 3) {
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
  }
  return new Date(1900, 0, 1)
}

function parseCsv(content: string): CsvRow[] {
  const lines = content.split('\n').filter(l => l.trim())
  // Skip header
  const rows: CsvRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i])
    if (fields.length < 9) continue
    const categoria = fields[8].replace(/^"|"$/g, '').trim()
    const settore = fields[2].replace(/^"|"$/g, '').trim()
    const contraentiStr = fields[3].replace(/^"|"$/g, '').trim()
    const dataStr = fields[4].replace(/^"|"$/g, '').trim()

    if (!categoria) continue

    const contraenti = contraentiStr
      .split(';')
      .map(s => s.replace(/^\(adesione di /i, '').replace(/\)$/, '').trim())
      .filter(s => s.length > 0 && s.length < 200)

    rows.push({
      categoria,
      settore,
      contraenti,
      dataStipula: parseDate(dataStr),
    })
  }
  return rows
}

// POST - Importa CCNL dal CSV CNEL
export async function POST(request: NextRequest) {
  try {
    await verifyJWT(request)

    // Read CSV from project docs or from request body
    let csvContent: string
    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('text/csv') || contentType.includes('text/plain')) {
      // CSV uploaded directly
      csvContent = await request.text()
    } else {
      // Read from local file (docs/formazione/Archivio_Corrente_CNEL.csv)
      const csvPath = path.join(process.cwd(), '..', 'docs', 'formazione', 'Archivio_Corrente_CNEL.csv')
      if (!fs.existsSync(csvPath)) {
        return Response.json({
          success: false,
          error: 'File CSV non trovato. Carica il CSV dell\'archivio CNEL.',
        }, { status: 404 })
      }
      csvContent = fs.readFileSync(csvPath, 'latin1')
    }

    const rows = parseCsv(csvContent)

    // Build unique categories: for each, keep the most recent entry
    const catMap = new Map<string, { settore: string; contraenti: string[]; data: Date }>()
    for (const row of rows) {
      const existing = catMap.get(row.categoria)
      if (!existing || row.dataStipula > existing.data) {
        catMap.set(row.categoria, {
          settore: row.settore,
          contraenti: row.contraenti,
          data: row.dataStipula,
        })
      }
    }

    // Collect all unique firmatari
    const allFirmatari = new Set<string>()
    Array.from(catMap.values()).forEach(entry => {
      for (const f of entry.contraenti) {
        allFirmatari.add(f)
      }
    })

    // Step 1: Upsert all firmatari
    const firmatariArray: string[] = []
    allFirmatari.forEach(f => firmatariArray.push(f))
    firmatariArray.sort()
    let firmatariInserted = 0
    const BATCH_SIZE = 200

    for (let i = 0; i < firmatariArray.length; i += BATCH_SIZE) {
      const batch = firmatariArray.slice(i, i + BATCH_SIZE).map(sigla => ({
        sigla,
        nome_completo: sigla,
        confederazione: detectConfederazione(sigla),
        attivo: true,
      }))
      const { error } = await supabase
        .from('scadenze_bandi_sigle_sindacali')
        .upsert(batch, { onConflict: 'sigla', ignoreDuplicates: true })
      if (error) console.error('[import-ccnl] Firmatari batch error:', error.message)
      else firmatariInserted += batch.length
    }

    // Step 2: Load all firmatari IDs
    const { data: allSigle } = await supabase
      .from('scadenze_bandi_sigle_sindacali')
      .select('id, sigla')
    const siglaIdMap = new Map<string, string>()
    for (const s of allSigle || []) {
      siglaIdMap.set(s.sigla, s.id)
    }

    // Step 3: Upsert all CCNL
    const catEntries: [string, { settore: string; contraenti: string[]; data: Date }][] = []
    catMap.forEach((info, cat) => catEntries.push([cat, info]))
    const ccnlEntries = catEntries.map(([cat, info]) => ({
      codice: cat,
      denominazione: cat,
      settore: info.settore,
      attivo: true,
    }))
    let ccnlInserted = 0

    for (let i = 0; i < ccnlEntries.length; i += BATCH_SIZE) {
      const batch = ccnlEntries.slice(i, i + BATCH_SIZE)
      const { error } = await supabase
        .from('scadenze_bandi_ccnl')
        .upsert(batch, { onConflict: 'codice', ignoreDuplicates: false })
      if (error) console.error('[import-ccnl] CCNL batch error:', error.message)
      else ccnlInserted += batch.length
    }

    // Step 4: Load all CCNL IDs
    const { data: allCcnl } = await supabase
      .from('scadenze_bandi_ccnl')
      .select('id, codice')
    const ccnlIdMap = new Map<string, string>()
    for (const c of allCcnl || []) {
      ccnlIdMap.set(c.codice, c.id)
    }

    // Step 5: Clear existing associations and re-insert
    await supabase.from('scadenze_bandi_ccnl_sigle').delete().neq('ccnl_id', '00000000-0000-0000-0000-000000000000')

    let assocInserted = 0
    const assocBatch: { ccnl_id: string; sigla_id: string }[] = []

    for (const [cat, info] of catEntries) {
      const ccnlId = ccnlIdMap.get(cat)
      if (!ccnlId) continue
      for (const firma of info.contraenti) {
        const siglaId = siglaIdMap.get(firma)
        if (!siglaId) continue
        assocBatch.push({ ccnl_id: ccnlId, sigla_id: siglaId })
      }
    }

    for (let i = 0; i < assocBatch.length; i += BATCH_SIZE) {
      const batch = assocBatch.slice(i, i + BATCH_SIZE)
      const { error } = await supabase
        .from('scadenze_bandi_ccnl_sigle')
        .upsert(batch, { onConflict: 'ccnl_id,sigla_id', ignoreDuplicates: true })
      if (error) console.error('[import-ccnl] Assoc batch error:', error.message)
      else assocInserted += batch.length
    }

    return Response.json({
      success: true,
      data: {
        ccnl: ccnlInserted,
        firmatari: firmatariInserted,
        associazioni: assocInserted,
        settori: ccnlEntries.map(e => e.settore).filter((v, i, a) => a.indexOf(v) === i).sort(),
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore importazione CCNL'
    console.error('[API import-ccnl] POST Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}

// Detect confederazione from sigla name
function detectConfederazione(sigla: string): string {
  const s = sigla.toUpperCase()
  if (s.includes('CGIL')) return 'CGIL'
  if (s.includes('CISL') || s.includes('FIM-CISL') || s.includes('FIRST-CISL')) return 'CISL'
  if (s.includes(' UIL') || s.endsWith(' UIL') || s.startsWith('UIL')) return 'UIL'
  if (s.includes('UGL')) return 'UGL'
  if (s.includes('CONFSAL') || s.includes('FESICA') || s.includes('FISALS')) return 'CONFSAL'
  if (s.includes('CISAL')) return 'CISAL'
  if (s.includes('CONF') && (s.includes('INDUSTRIA') || s.includes('COMMERCIO') || s.includes('ARTIGIAN') || s.includes('COOPERAT'))) return 'Datoriale'
  if (s.includes('CONFINDUSTRIA') || s.includes('CONFAPI') || s.includes('CONFCOMMERCIO')) return 'Datoriale'
  if (s.includes('CNA') || s.includes('CASARTIGIANI') || s.includes('CLAAI')) return 'Datoriale'
  if (s.includes('LEGACOOP') || s.includes('CONFCOOPERATIVE') || s.includes('AGCI')) return 'Datoriale'
  if (s.includes('ANCE') || s.includes('ARAN') || s.includes('ABI') || s.includes('ANIA')) return 'Datoriale'
  if (s.includes('FEDERMANAGER') || s.includes('MANAGERITALIA') || s.includes('CIDA')) return 'Dirigenti'
  return ''
}
