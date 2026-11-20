import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/jwtAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { registraEvento } from '@/lib/registro'
import {
  ETICHETTE_CANALE, ETICHETTE_EVENTO, GRUPPI_EVENTO, etichettaTabella, tabellePerArea
} from '@/lib/registroEtichette'

/**
 * Registro delle operazioni (fase 4A), solo amministratori.
 * GET con filtri: da, a (AAAA-MM-GG), utente (id o "nessuno"), gruppo (vedi
 * GRUPPI_EVENTO), area (etichetta), cliente (testo sulla denominazione), q
 * (testo libero sulla descrizione), esito, pagina. Con formato=csv scarica il
 * risultato filtrato (fino a 10.000 righe) in un file apribile con Excel.
 */

const PER_PAGINA = 100
const MAX_ESPORTAZIONE = 10000
const UUID = /^[0-9a-fA-F-]{36}$/

/** Scarto dell'ora italiana in un dato giorno (+01:00 d'inverno, +02:00 d'estate). */
function scartoRoma(giorno: string): string {
  const parti = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Rome', timeZoneName: 'shortOffset' })
    .formatToParts(new Date(`${giorno}T12:00:00Z`))
  const nome = parti.find(p => p.type === 'timeZoneName')?.value || 'GMT+1'
  const ore = parseInt(nome.replace('GMT', '') || '1', 10)
  return `${ore >= 0 ? '+' : '-'}${String(Math.abs(ore)).padStart(2, '0')}:00`
}

function escapeLike(testo: string) {
  return testo.replace(/[%_,()]/g, ' ').trim()
}

async function leggiRegistro(params: URLSearchParams, colonne: string, conteggio: boolean, dalla: number, alla: number) {
  let query = supabaseAdmin
    .from('scadenze_bandi_registro_operazioni')
    .select(colonne, conteggio ? { count: 'exact' } : undefined)

  const da = params.get('da')
  const a = params.get('a')
  if (da && /^\d{4}-\d{2}-\d{2}$/.test(da)) query = query.gte('quando', `${da}T00:00:00${scartoRoma(da)}`)
  if (a && /^\d{4}-\d{2}-\d{2}$/.test(a)) query = query.lte('quando', `${a}T23:59:59.999${scartoRoma(a)}`)

  const utente = params.get('utente')
  if (utente === 'nessuno') query = query.is('utente_id', null)
  else if (utente && UUID.test(utente)) query = query.eq('utente_id', utente)

  const gruppo = params.get('gruppo')
  if (gruppo && GRUPPI_EVENTO[gruppo]) query = query.in('evento', GRUPPI_EVENTO[gruppo].eventi)

  const area = params.get('area')
  if (area) {
    const tabelle = tabellePerArea(area)
    if (tabelle.length) query = query.in('tabella', tabelle)
  }

  const esito = params.get('esito')
  if (esito && ['ok', 'negato', 'errore'].includes(esito)) query = query.eq('esito', esito)

  const q = escapeLike(params.get('q') || '')
  if (q) query = query.ilike('descrizione', `%${q}%`)

  const cliente = escapeLike(params.get('cliente') || '')
  if (cliente) {
    const { data: clienti } = await supabaseAdmin
      .from('scadenze_bandi_clienti')
      .select('id')
      .ilike('denominazione', `%${cliente}%`)
      .limit(50)
    const ids = (clienti || []).map(c => c.id)
    // Anche i clienti eliminati: la denominazione resta nella descrizione del registro
    query = ids.length
      ? query.or(`cliente_id.in.(${ids.join(',')}),descrizione.ilike.%${cliente}%`)
      : query.ilike('descrizione', `%${cliente}%`)
  }

  return await query
    .order('quando', { ascending: false })
    .order('id', { ascending: false })
    .range(dalla, alla)
}

function cellaCsv(valore: unknown): string {
  if (valore === null || valore === undefined) return ''
  const testo = typeof valore === 'string' ? valore : JSON.stringify(valore)
  return `"${testo.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request)
  if (!admin) return NextResponse.json({ error: 'Permessi insufficienti' }, { status: 403 })

  const params = request.nextUrl.searchParams
  const colonne = 'id, quando, utente_id, utente_nome, canale, evento, tabella, record_id, cliente_id, descrizione, campi, prima, dopo, esito, dettagli'

  if (params.get('formato') === 'csv') {
    // Il database restituisce al massimo 1.000 righe per richiesta: si legge a blocchi
    const righe: any[] = []
    for (let dalla = 0; dalla < MAX_ESPORTAZIONE; dalla += 1000) {
      const { data, error } = await leggiRegistro(params, colonne, false, dalla, dalla + 999)
      if (error) return NextResponse.json({ error: 'Esportazione non riuscita' }, { status: 500 })
      righe.push(...((data || []) as any[]))
      if (!data || data.length < 1000) break
    }

    const intestazione = ['Data e ora', 'Persona', 'Canale', 'Evento', 'Area', 'Oggetto', 'Campi modificati', 'Esito', 'Valori precedenti', 'Valori nuovi', 'Dettagli']
    const corpo = righe.map(r => [
      new Date(r.quando).toLocaleString('it-IT', { timeZone: 'Europe/Rome' }),
      r.utente_nome || (r.utente_id ? r.utente_id : ETICHETTE_CANALE[r.canale] || r.canale),
      ETICHETTE_CANALE[r.canale] || r.canale,
      ETICHETTE_EVENTO[r.evento] || r.evento,
      etichettaTabella(r.tabella),
      r.descrizione,
      (r.campi || []).join(', '),
      r.esito,
      r.prima,
      r.dopo,
      r.dettagli
    ].map(cellaCsv).join(';'))
    const csv = '﻿' + [intestazione.map(cellaCsv).join(';'), ...corpo].join('\r\n')

    await registraEvento({
      evento: 'esportazione_registro', utenteId: admin.userId, request,
      descrizione: `Esportazione del registro: ${righe.length} righe`,
      dettagli: { filtri: Object.fromEntries(Array.from(params.entries()).filter(([k]) => k !== 'formato')) }
    })

    const oggi = new Date().toISOString().slice(0, 10)
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="registro_operazioni_${oggi}.csv"`
      }
    })
  }

  const pagina = Math.max(0, parseInt(params.get('pagina') || '0', 10) || 0)
  const { data, error, count } = await leggiRegistro(
    params, colonne, true, pagina * PER_PAGINA, pagina * PER_PAGINA + PER_PAGINA - 1
  )
  if (error) {
    console.error('[registro] lettura:', error.message)
    return NextResponse.json({ error: 'Registro non disponibile' }, { status: 500 })
  }

  // Nomi dei clienti collegati, per mostrarli accanto all'operazione
  const idsClienti = Array.from(new Set(((data || []) as any[]).map(r => r.cliente_id).filter(Boolean)))
  const nomiClienti: Record<string, string> = {}
  if (idsClienti.length) {
    const { data: clienti } = await supabaseAdmin
      .from('scadenze_bandi_clienti')
      .select('id, denominazione')
      .in('id', idsClienti)
    for (const c of clienti || []) nomiClienti[c.id] = c.denominazione
  }

  const { data: utenti } = await supabaseAdmin
    .from('scadenze_bandi_utenti')
    .select('id, nome, cognome')
    .order('nome')

  return NextResponse.json({
    righe: data || [],
    totale: count || 0,
    perPagina: PER_PAGINA,
    nomiClienti,
    utenti: (utenti || []).map(u => ({ id: u.id, nome: `${u.nome || ''} ${u.cognome || ''}`.trim() }))
  })
}
