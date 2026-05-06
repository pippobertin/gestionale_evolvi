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

    if (!decisione || !['EVOLVI', 'SPOT'].includes(decisione)) {
      return Response.json({
        success: false,
        error: 'Il campo decisione è obbligatorio e deve essere "EVOLVI" o "SPOT"'
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
        error: 'Questo prospect è già stato convertito in cliente'
      }, { status: 400 })
    }

    // Mappa i campi del prospect ai campi del cliente
    const categoriaEvolvi = decisione === 'EVOLVI' ? 'EVOLVI' : 'CLIENTE_SPOT'

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
      dimensione: prospect.dimensione || null,
      numero_dipendenti: prospect.numero_dipendenti || null,
      ultimo_fatturato: prospect.ultimo_fatturato || null,
      legale_rappresentante_nome: prospect.legale_rappresentante_nome || null,
      legale_rappresentante_cognome: prospect.legale_rappresentante_cognome || null,
      legale_rappresentante_email: prospect.legale_rappresentante_email || null,
      legale_rappresentante_telefono: prospect.legale_rappresentante_telefono || null,
      ateco_2025: prospect.ateco_2025 || null,
      categoria_evolvi: categoriaEvolvi,
      note: note || prospect.note || null
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

    if (updateError) throw updateError

    // Inserisci record nella history
    await supabase
      .from('scadenze_bandi_prospect_history')
      .insert([{
        prospect_id: id,
        stato_precedente: prospect.stato,
        stato_nuovo: 'convertito',
        note: `Convertito in cliente (${categoriaEvolvi}). Cliente ID: ${newCliente.id}${note ? '. Note: ' + note : ''}`,
        utente
      }])

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
