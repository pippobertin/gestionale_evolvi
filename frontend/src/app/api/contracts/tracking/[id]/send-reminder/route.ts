import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getValidGoogleToken } from '@/lib/googleAuth'
import { google } from 'googleapis'

// POST - Invia sollecito email per contratto non firmato
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: trackingId } = await params

    // Recupera tracking record con dati cliente
    const { data: tracking, error: trackingError } = await supabase
      .from('scadenze_bandi_contract_tracking')
      .select('*')
      .eq('id', trackingId)
      .single()

    if (trackingError) {
      if (trackingError.code === 'PGRST116') {
        return Response.json({
          success: false,
          error: 'Record di tracking non trovato'
        }, { status: 404 })
      }
      throw trackingError
    }

    // Recupera dati cliente
    const { data: cliente, error: clienteError } = await supabase
      .from('scadenze_bandi_clienti')
      .select('denominazione, email, pec')
      .eq('id', tracking.cliente_id)
      .single()

    if (clienteError || !cliente) {
      return Response.json({
        success: false,
        error: 'Cliente non trovato'
      }, { status: 404 })
    }

    // Determina email destinazione
    const recipientEmail = cliente.email || cliente.pec
    if (!recipientEmail) {
      return Response.json({
        success: false,
        error: 'Email/PEC del cliente non configurata'
      }, { status: 400 })
    }

    // Ottieni token Gmail
    const googleAccessToken = await getValidGoogleToken()
    if (!googleAccessToken) {
      return Response.json({
        success: false,
        error: 'Gmail non configurato - impossibile inviare sollecito'
      }, { status: 401 })
    }

    // Componi e invia email sollecito
    const reminderCount = (tracking.reminder_sent_count || 0) + 1
    const subject = `Sollecito n.${reminderCount} - Contratto in attesa di firma`

    const emailBody = `
Gentile ${cliente.denominazione},

con la presente ci permettiamo di sollecitarvi in merito al contratto che vi abbiamo inviato${tracking.email_sent_at ? ` in data ${new Date(tracking.email_sent_at).toLocaleDateString('it-IT')}` : ''}.

Ad oggi non risulta pervenuta la copia firmata del documento.

${tracking.contract_document_url ? `Il contratto è sempre disponibile al seguente link:\n${tracking.contract_document_url}\n` : ''}
Vi preghiamo di provvedere alla firma e restituzione del contratto nel più breve tempo possibile.

Per qualsiasi chiarimento o richiesta, non esitate a contattarci.

Cordiali saluti,
Team BLM Project Srl
Email: info@blmproject.com
`

    // Crea client Gmail e invia
    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: googleAccessToken })
    const gmail = google.gmail({ version: 'v1', auth })

    const emailContent = [
      `To: ${recipientEmail}`,
      `Subject: ${subject}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      '',
      emailBody
    ].join('\n')

    const encodedMessage = Buffer.from(emailContent)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    })

    console.log('Sollecito contratto inviato:', response.data.id)

    // Aggiorna tracking record
    const { data: updatedTracking, error: updateError } = await supabase
      .from('scadenze_bandi_contract_tracking')
      .update({
        reminder_sent_count: reminderCount,
        last_reminder_sent_at: new Date().toISOString(),
        overall_status: 'REMINDED'
      })
      .eq('id', trackingId)
      .select()
      .single()

    if (updateError) {
      console.error('Errore aggiornamento tracking dopo sollecito:', updateError)
    }

    return Response.json({
      success: true,
      data: updatedTracking,
      message: `Sollecito n.${reminderCount} inviato con successo a ${recipientEmail}`
    })

  } catch (error: any) {
    console.error('Errore nell\'invio sollecito contratto:', error)
    return Response.json({
      success: false,
      error: error.message || 'Errore nell\'invio del sollecito'
    }, { status: 500 })
  }
}
