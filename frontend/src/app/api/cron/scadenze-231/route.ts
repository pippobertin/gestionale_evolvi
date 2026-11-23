import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { oggiItalia } from '@/lib/accessoUtente'
import { creaReport, periodoSemestre, semestreConcluso } from '@/lib/reportOdv'

/**
 * Controllo giornaliero (Vercel Cron): integrazioni e rendiconti con la
 * scadenza superata senza invio vengono segnalati ad AU e OdV nel registro
 * attività, una volta per scadenza (PR.01 §4.3.6). Chi ha l'accesso scaduto
 * esce dagli elenchi delle persone autorizzate sulle deleghe (PR.03 §4.2).
 * Chiuso un semestre, prepara la bozza del report all'OdV (M.05) con i dati
 * dei registri, se non c'è già e se la scadenza di invio non è passata.
 */
export const dynamic = 'force-dynamic'

function autorizzato(request: NextRequest): boolean {
  const segreto = process.env.CRON_SECRET
  if (!segreto) return false
  const atteso = Buffer.from(`Bearer ${segreto}`)
  const dato = Buffer.from(request.headers.get('authorization') || '')
  return atteso.length === dato.length && crypto.timingSafeEqual(atteso, dato)
}

export async function GET(request: NextRequest) {
  if (!autorizzato(request)) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  const { data, error } = await supabaseAdmin.rpc('gestionale_segnala_ritardi')
  const { data: rimosse, error: e2 } = await supabaseAdmin.rpc('gestionale_rimuovi_autorizzazioni_cessate')
  let reportPreparato: string | null = null
  try {
    const oggi = oggiItalia()
    const { anno, semestre } = semestreConcluso(oggi)
    if (periodoSemestre(anno, semestre).scadenza >= oggi) {
      const { data: esiste } = await supabaseAdmin.from('scadenze_bandi_report_odv').select('id').eq('anno', anno).eq('semestre', semestre).maybeSingle()
      if (!esiste) {
        const { error: e3 } = await creaReport(anno, semestre, null)
        if (!e3) reportPreparato = `${semestre}° semestre ${anno}`
      }
    }
  } catch (e) {
    console.error('Bozza del report OdV non preparata:', e)
  }
  if (error || e2) return NextResponse.json({ ok: false, errore: (error || e2)!.message }, { status: 500 })
  return NextResponse.json({ ok: true, segnalati: data, autorizzazioni_rimosse: rimosse, report_odv_preparato: reportPreparato })
}
