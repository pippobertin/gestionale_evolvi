import type { NextRequest } from 'next/server'
import { supabaseAdmin } from './supabaseAdmin'

/**
 * Eventi del registro delle operazioni che non nascono da una modifica ai dati
 * (le modifiche le registra il database da solo): accessi, uscite, cambi di
 * password, email inviate. Un errore di scrittura non blocca mai l'operazione.
 */

export type EventoRegistro =
  | 'accesso'
  | 'accesso_negato'
  | 'uscita'
  | 'cambio_password'
  | 'reimpostazione_password'
  | 'email_inviata'
  | 'esportazione_registro'
  | 'permesso_negato'
  | 'deroga_approvazione'
  | 'permessi_modificati'

type DatiEvento = {
  evento: EventoRegistro
  utenteId?: string | null
  descrizione?: string
  esito?: 'ok' | 'negato' | 'errore'
  clienteId?: string | null
  tabella?: string
  recordId?: string
  dettagli?: Record<string, unknown>
  request?: NextRequest
}

function ipCliente(request?: NextRequest): string | null {
  if (!request) return null
  const inoltrato = request.headers.get('x-forwarded-for')
  return inoltrato?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || null
}

export async function registraEvento(dati: DatiEvento): Promise<void> {
  try {
    let utenteNome: string | null = null
    if (dati.utenteId) {
      const { data } = await supabaseAdmin
        .from('scadenze_bandi_utenti')
        .select('nome, cognome')
        .eq('id', dati.utenteId)
        .maybeSingle()
      utenteNome = data ? `${data.nome || ''} ${data.cognome || ''}`.trim() || null : null
    }

    const dettagli: Record<string, unknown> = { ...(dati.dettagli || {}) }
    if (dati.request) {
      dettagli.ip = ipCliente(dati.request)
      dettagli.dispositivo = dati.request.headers.get('user-agent')
    }

    const { error } = await supabaseAdmin.from('scadenze_bandi_registro_operazioni').insert({
      utente_id: dati.utenteId || null,
      utente_nome: utenteNome,
      canale: 'server',
      evento: dati.evento,
      tabella: dati.tabella || null,
      record_id: dati.recordId || null,
      cliente_id: dati.clienteId || null,
      descrizione: dati.descrizione?.slice(0, 300) || null,
      esito: dati.esito || 'ok',
      dettagli: Object.keys(dettagli).length ? dettagli : null
    })
    if (error) console.error('[registro] evento non registrato:', error.message)
  } catch (e) {
    console.error('[registro] evento non registrato:', e instanceof Error ? e.message : e)
  }
}
