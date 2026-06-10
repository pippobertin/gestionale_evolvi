import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

// POST - Converti prospect in cliente
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const { decisione, note } = body

    const DECISIONI_AMMESSE = ['EVOLVI', 'SPOT', 'FPI', 'CONSULENTI']
    if (!decisione || !DECISIONI_AMMESSE.includes(decisione)) {
      return Response.json({
        success: false,
        error: `Il campo decisione è obbligatorio e deve essere uno tra: ${DECISIONI_AMMESSE.join(', ')}`
      }, { status: 400 })
    }

    // Recupera il prospect
    const { data: prospect, error: prospectError } = await supabase
      .from('scadenze_bandi_prospect')
      .select('*')
      .eq('id', id)
      .single()

    if (prospectError) {
      if (prospectError.code === 'PGRST116') {
        return Response.json({
          success: false,
          error: 'Prospect non trovato'
        }, { status: 404 })
      }
      throw prospectError
    }

    // Verifica che il prospect non sia già convertito
    if (prospect.stato === 'convertito') {
      return Response.json({
        success: false,
        error: 'Questo prospect è già stato convertito in cliente. Per modificare la categoria, apri direttamente la scheda del cliente esistente.'
      }, { status: 400 })
    }

    // Verifica esistenza di un cliente con la stessa P.IVA.
    // Il client puo' forzare il duplicato passando force_duplicate: true nel body.
    const forceDuplicate = body.force_duplicate === true
    if (prospect.partita_iva && !forceDuplicate) {
      const { data: clientiEsistenti } = await supabase
        .from('scadenze_bandi_clienti')
        .select('id, denominazione, categoria_evolvi')
        .eq('partita_iva', prospect.partita_iva)
        .limit(1)

      if (clientiEsistenti && clientiEsistenti.length > 0) {
        const esistente = clientiEsistenti[0]
        return Response.json({
          success: false,
          error: 'cliente_duplicato',
          message: `Esiste già un cliente con questa P.IVA: ${esistente.denominazione} (${esistente.categoria_evolvi}). Per procedere comunque creando un duplicato, rilancia la richiesta con force_duplicate: true.`,
          cliente_esistente: esistente,
        }, { status: 409 })
      }
    }

    // Mappa la decisione del prospect nella categoria del cliente.
    // SPOT è l'unico caso che cambia denominazione (CLIENTE_SPOT).
    const mappaCategoria: Record<string, string> = {
      EVOLVI: 'EVOLVI',
      SPOT: 'CLIENTE_SPOT',
      FPI: 'FPI',
      CONSULENTI: 'CONSULENTI',
    }
    const categoriaEvolvi = mappaCategoria[decisione] || 'CLIENTE_SPOT'

    const clienteData: Record<string, any> = {
      denominazione: prospect.denominazione,
      partita_iva: prospect.partita_iva || null,
      codice_fiscale: prospect.codice_fiscale || null,
      email: prospect.email || null,
      pec: prospect.pec || null,
      telefono: prospect.telefono || null,
      sito_web: prospect.sito_web || null,
      indirizzo_fatturazione: prospect.indirizzo || null,
      cap_fatturazione: prospect.cap || null,
      citta_fatturazione: prospect.citta || null,
      provincia_fatturazione: prospect.provincia || null,
      // dimensione: e' una GENERATED column calcolata dal DB in base a
      // ula, ultimo_fatturato, attivo_bilancio (UE 2003/361/CE).
      // Per garantire la classificazione MICRO alla conversione (in
      // assenza di dati reali) impostiamo valori minimi placeholder:
      // questi vanno verificati e corretti nella scheda cliente quando
      // si dispongono dei dati reali (vedi anche nota auto-generata).
      numero_dipendenti: prospect.numero_dipendenti || null,
      ula: prospect.numero_dipendenti ?? 1,
      attivo_bilancio: 100,
      ultimo_fatturato: prospect.ultimo_fatturato ?? 100,
      legale_rappresentante_nome: prospect.legale_rappresentante_nome || null,
      legale_rappresentante_cognome: prospect.legale_rappresentante_cognome || null,
      legale_rappresentante_email: prospect.legale_rappresentante_email || null,
      legale_rappresentante_telefono: prospect.legale_rappresentante_telefono || null,
      ateco_2025: prospect.ateco_2025 || null,
      categoria_evolvi: categoriaEvolvi,
      note: [
        note || prospect.note || null,
        '⚠ Dati di dimensionamento (ULA, fatturato, attivo bilancio) impostati su valori provvisori al momento della conversione. Verificare e aggiornare per ottenere la classificazione UE corretta.',
      ].filter(Boolean).join('\n\n'),
    }

    // Crea il nuovo cliente
    const { data: newCliente, error: clienteError } = await supabase
      .from('scadenze_bandi_clienti')
      .insert([clienteData])
      .select()
      .single()

    if (clienteError) throw clienteError

    const utente = body.convertito_da || 'system'
    const now = new Date().toISOString()

    // Aggiorna il prospect: stato=convertito, cliente_id, data_conversione
    const { data: updatedProspect, error: updateError } = await supabase
      .from('scadenze_bandi_prospect')
      .update({
        stato: 'convertito',
        decisione: decisione,
        cliente_id: newCliente.id,
        data_conversione: now,
        convertito_da: utente,
        data_decisione: now,
        deciso_da: utente
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      // Rollback manuale: cancella il cliente appena creato per evitare
      // clienti orfani quando l'UPDATE prospect fallisce.
      await supabase
        .from('scadenze_bandi_clienti')
        .delete()
        .eq('id', newCliente.id)
      throw updateError
    }

    // Inserisci record nella history (best effort: non rollback se fallisce)
    const { error: historyError } = await supabase
      .from('scadenze_bandi_prospect_history')
      .insert([{
        prospect_id: id,
        stato_precedente: prospect.stato,
        stato_nuovo: 'convertito',
        note: `Convertito in cliente (${categoriaEvolvi}). Cliente ID: ${newCliente.id}${note ? '. Note: ' + note : ''}`,
        utente
      }])
    if (historyError) {
      console.warn('Conversione completata, history non scritta:', historyError)
    }

    return Response.json({
      success: true,
      data: {
        prospect: updatedProspect,
        cliente: newCliente
      },
      message: `Prospect convertito con successo in cliente con categoria ${categoriaEvolvi}`
    })

  } catch (error: any) {
    console.error('Errore nella conversione prospect:', error)
    return Response.json({
      success: false,
      error: error.message || 'Errore nella conversione del prospect in cliente'
    }, { status: 500 })
  }
}
