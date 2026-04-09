import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getValidGoogleToken } from '@/lib/googleAuth'
import { createDriveClient } from '@/lib/googleDrive'

// GET - Recupera singolo contratto Evolvi con info cliente
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Recupera il contratto
    const { data: contratto, error: contrattoError } = await supabase
      .from('scadenze_bandi_contratti_evolvi')
      .select('*')
      .eq('id', id)
      .single()

    if (contrattoError) {
      if (contrattoError.code === 'PGRST116') {
        return Response.json({
          success: false,
          error: 'Contratto non trovato'
        }, { status: 404 })
      }
      throw contrattoError
    }

    // Recupera dati cliente
    const { data: cliente, error: clienteError } = await supabase
      .from('scadenze_bandi_clienti')
      .select('denominazione, partita_iva, codice_fiscale, indirizzo_fatturazione, citta_fatturazione, provincia_fatturazione, cap_fatturazione, pec, email, telefono, legale_rappresentante_nome, legale_rappresentante_cognome')
      .eq('id', contratto.cliente_id)
      .single()

    if (clienteError) {
      console.error('Errore nel recupero dati cliente:', clienteError)
    }

    return Response.json({
      success: true,
      data: {
        ...contratto,
        cliente: cliente || null
      }
    })

  } catch (error: any) {
    console.error('Errore nel recupero contratto Evolvi:', error)
    return Response.json({
      success: false,
      error: error.message || 'Errore nel recupero del contratto Evolvi'
    }, { status: 500 })
  }
}

// PUT - Aggiorna contratto Evolvi
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Escludi campi non aggiornabili
    const { id: _id, created_at: _ca, numero_contratto: _nc, cliente: _cl, ...updateData } = body

    const { data, error } = await supabase
      .from('scadenze_bandi_contratti_evolvi')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return Response.json({
          success: false,
          error: 'Contratto non trovato'
        }, { status: 404 })
      }
      throw error
    }

    return Response.json({
      success: true,
      data,
      message: 'Contratto Evolvi aggiornato con successo'
    })

  } catch (error: any) {
    console.error('Errore nell\'aggiornamento contratto Evolvi:', error)
    return Response.json({
      success: false,
      error: error.message || 'Errore nell\'aggiornamento del contratto Evolvi'
    }, { status: 500 })
  }
}

// DELETE - Elimina contratto Evolvi
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Recupera il contratto con i file IDs
    const { data: contratto, error: fetchError } = await supabase
      .from('scadenze_bandi_contratti_evolvi')
      .select('stato, numero_contratto, contract_word_id, contract_pdf_id')
      .eq('id', id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return Response.json({
          success: false,
          error: 'Contratto non trovato'
        }, { status: 404 })
      }
      throw fetchError
    }

    // Elimina file da Google Drive (se esistono)
    const driveFileIds = [contratto.contract_word_id, contratto.contract_pdf_id].filter(Boolean)
    if (driveFileIds.length > 0) {
      try {
        const googleAccessToken = await getValidGoogleToken()
        if (googleAccessToken) {
          const drive = await createDriveClient(googleAccessToken)
          for (const fileId of driveFileIds) {
            try {
              await drive.files.delete({ fileId })
            } catch (driveErr: any) {
              // File potrebbe essere già stato eliminato manualmente
              if (driveErr?.code !== 404) {
                console.warn(`Errore eliminazione file Drive ${fileId}:`, driveErr.message)
              }
            }
          }
        }
      } catch (driveError) {
        console.warn('Errore accesso Google Drive, procedo con eliminazione DB:', driveError)
      }
    }

    // Elimina record correlati: contract tracking
    await supabase
      .from('scadenze_bandi_contract_tracking')
      .delete()
      .eq('contratto_evolvi_id', id)

    // Elimina record correlati: scadenze contrattuali
    await supabase
      .from('scadenze_bandi_scadenze_contrattuali')
      .delete()
      .eq('entity_id', id)
      .eq('entity_type', 'CONTRATTO_EVOLVI')

    // Elimina record correlati: fatture
    await supabase
      .from('scadenze_bandi_fatture_evolvi')
      .delete()
      .eq('contratto_evolvi_id', id)

    // Elimina il contratto
    const { error } = await supabase
      .from('scadenze_bandi_contratti_evolvi')
      .delete()
      .eq('id', id)

    if (error) throw error

    return Response.json({
      success: true,
      message: `Contratto "${contratto.numero_contratto || id}" eliminato con successo`
    })

  } catch (error: any) {
    console.error('Errore nell\'eliminazione contratto Evolvi:', error)
    return Response.json({
      success: false,
      error: error.message || 'Errore nell\'eliminazione del contratto Evolvi'
    }, { status: 500 })
  }
}
