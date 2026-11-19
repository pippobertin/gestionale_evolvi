import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { indiceClienti, salvaAiutiMese, registraErroreLettura, ultimiMesi, type AiutoRna } from '@/lib/rna/importer'

/**
 * POST /api/rna/agente
 *
 * Unico punto di accesso al database per l'agente RNA che gira sul Mac
 * (rna.gov.it non risponde ai server cloud: il Mac scarica e legge i file,
 * il gestionale salva). L'agente non ha più alcuna chiave del database.
 *
 * Autenticazione: header `x-rna-agent-secret` = RNA_AGENT_SECRET.
 * Corpo: { azione: 'avvio' | 'codici' | 'aggiorna' | 'salva_mese' | 'errore_mese' | 'battito', ... }
 */

export const maxDuration = 60

const R = 'scadenze_bandi_rna_richieste'
const AGENTE = 'scadenze_bandi_rna_agente'
const GIORNO = 86400000

// Campi della richiesta che l'agente può aggiornare
const CAMPI_AGGIORNABILI = new Set([
  'stato', 'avviata_at', 'mesi_totali', 'mesi_completati', 'errore', 'mese_corrente',
  'aiuti_clienti', 'nuovi', 'aggiornati', 'collegati_auto', 'mesi_in_errore', 'completata_at'
])

function autorizzato(req: NextRequest): boolean {
  const atteso = process.env.RNA_AGENT_SECRET
  const ricevuto = req.headers.get('x-rna-agent-secret')
  if (!atteso || !ricevuto) return false
  const a = Buffer.from(atteso)
  const b = Buffer.from(ricevuto)
  return a.length === b.length && timingSafeEqual(a, b)
}

async function battito(macchina: string, stato: string) {
  await supabaseAdmin.from(AGENTE).upsert(
    { id: macchina, ultimo_contatto_at: new Date().toISOString(), stato },
    { onConflict: 'id' }
  )
}

async function ultimaOk(filtro: (q: any) => any): Promise<Date | null> {
  const { data } = await filtro(supabaseAdmin.from(R).select('completata_at').eq('stato', 'OK'))
    .order('completata_at', { ascending: false }).limit(1)
  return data && data[0]?.completata_at ? new Date(data[0].completata_at) : null
}

// Stessa logica che prima stava nell'agente sul Mac
async function prossimaRichiesta(): Promise<any | null> {
  const { data: attesa } = await supabaseAdmin.from(R).select('*').eq('stato', 'IN_ATTESA')
    .order('created_at', { ascending: true }).limit(1)
  if (attesa && attesa[0]) return attesa[0]

  const adesso = Date.now()
  const meseCorrente = ultimiMesi(1)[0]
  const ultimoCompleto = await ultimaOk(q => q.eq('mese_da', '2020_01'))
  const ultimoQualsiasi = await ultimaOk(q => q)

  // Dopo un aggiornamento automatico fallito nelle ultime 6 ore non se ne crea un altro
  const { data: fallite } = await supabaseAdmin.from(R).select('id').eq('origine', 'AUTOMATICA').eq('stato', 'ERRORE')
    .gte('created_at', new Date(adesso - 6 * 3600000).toISOString()).limit(1)
  if (fallite && fallite.length) return null

  let da: string | null = null
  if (!ultimoCompleto || adesso - ultimoCompleto.getTime() > 30 * GIORNO) da = '2020_01'
  else if (!ultimoQualsiasi || adesso - ultimoQualsiasi.getTime() > 7 * GIORNO) da = ultimiMesi(4)[3]
  if (!da) return null

  const { data: nuova, error } = await supabaseAdmin.from(R)
    .insert({ mese_da: da, mese_a: meseCorrente, origine: 'AUTOMATICA', stato: 'IN_ATTESA' })
    .select('*').single()
  if (error) throw new Error(`Creazione richiesta automatica: ${error.message}`)
  return nuova
}

export async function POST(req: NextRequest) {
  if (!autorizzato(req)) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corpo non valido' }, { status: 400 })
  }
  const macchina = String(body?.macchina || 'mac').slice(0, 100)

  try {
    switch (body?.azione) {
      case 'avvio': {
        await battito(macchina, 'in ascolto')
        // Richieste rimaste "in corso" (Mac spento a metà) tornano in coda
        await supabaseAdmin.from(R).update({ stato: 'IN_ATTESA', avviata_at: null }).eq('stato', 'IN_CORSO')
        const richiesta = await prossimaRichiesta()
        return NextResponse.json({ richiesta })
      }

      case 'battito': {
        await battito(macchina, String(body.stato || 'in ascolto').slice(0, 200))
        return NextResponse.json({ ok: true })
      }

      case 'codici': {
        // Solo i codici fiscali / P.IVA normalizzati dei clienti, per filtrare il file RNA sul Mac
        const indice = await indiceClienti(supabaseAdmin)
        return NextResponse.json({ codici: Array.from(indice.keys()) })
      }

      case 'aggiorna': {
        const id = body.id
        if (!id || typeof body.campi !== 'object') {
          return NextResponse.json({ error: 'id e campi richiesti' }, { status: 400 })
        }
        const campi: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(body.campi)) {
          if (CAMPI_AGGIORNABILI.has(k)) campi[k] = v
        }
        const { error } = await supabaseAdmin.from(R).update(campi).eq('id', id)
        if (error) throw new Error(error.message)
        return NextResponse.json({ ok: true })
      }

      case 'salva_mese': {
        const mese = String(body.mese || '')
        if (!/^\d{4}_\d{2}$/.test(mese) || !Array.isArray(body.aiuti)) {
          return NextResponse.json({ error: 'mese (AAAA_MM) e aiuti richiesti' }, { status: 400 })
        }
        const origine = (['CRON', 'BACKFILL'].includes(body.origine) ? body.origine : 'MANUALE') as 'CRON' | 'BACKFILL' | 'MANUALE'
        const indice = await indiceClienti(supabaseAdmin)
        const esito = await salvaAiutiMese({
          client: supabaseAdmin,
          mese,
          origine,
          indice,
          aiuti: body.aiuti as AiutoRna[],
          aiutiLetti: Number(body.aiuti_letti) || 0,
        })
        return NextResponse.json({ esito })
      }

      case 'errore_mese': {
        const mese = String(body.mese || '')
        const origine = (['CRON', 'BACKFILL'].includes(body.origine) ? body.origine : 'MANUALE') as 'CRON' | 'BACKFILL' | 'MANUALE'
        const esito = await registraErroreLettura(supabaseAdmin, mese, origine, String(body.errore || 'Errore di lettura').slice(0, 1000), Number(body.aiuti_letti) || 0)
        return NextResponse.json({ esito })
      }

      default:
        return NextResponse.json({ error: 'Azione non riconosciuta' }, { status: 400 })
    }
  } catch (err) {
    console.error('[rna/agente]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Errore interno' }, { status: 500 })
  }
}
