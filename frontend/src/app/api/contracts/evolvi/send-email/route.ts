import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getGmailClient } from '@/lib/gmail'
import { verifyJWT } from '@/lib/jwtAuth'

export async function POST(req: NextRequest) {
  try {
    const { contrattoId, customMessage } = await req.json()

    if (!contrattoId) {
      return Response.json({ message: 'ID contratto richiesto' }, { status: 400 })
    }

    // 1. Recupera contratto
    const { data: contratto, error: contrattoError } = await supabase
      .from('scadenze_bandi_contratti_evolvi')
      .select('*')
      .eq('id', contrattoId)
      .single()

    if (contrattoError || !contratto) {
      return Response.json({ message: 'Contratto non trovato' }, { status: 404 })
    }

    // 2. Recupera dati cliente
    const { data: cliente, error: clienteError } = await supabase
      .from('scadenze_bandi_clienti')
      .select('denominazione, email, pec')
      .eq('id', contratto.cliente_id)
      .single()

    if (clienteError || !cliente) {
      return Response.json({ message: 'Cliente non trovato' }, { status: 404 })
    }

    // 3. Determina email destinazione
    const clientEmail = cliente.email || cliente.pec
    if (!clientEmail) {
      return Response.json({ message: 'Email/PEC del cliente non configurata' }, { status: 400 })
    }

    // 4. Ottieni client Gmail con token dell'utente loggato
    const decoded = await verifyJWT(req)
    const userId = decoded?.userId

    let gmail
    try {
      gmail = await getGmailClient(userId)
    } catch (gmailAuthError: any) {
      console.error('Errore autenticazione Gmail:', gmailAuthError)
      return Response.json({
        success: false,
        message: `Errore autenticazione Gmail: ${gmailAuthError.message}. Verifica di aver collegato Gmail nelle impostazioni.`
      }, { status: 401 })
    }

    // 5. Componi e invia email
    const subject = `Contratto Metodo Evolvi - ${cliente.denominazione} - ${contratto.numero_contratto}`

    const defaultMessage = `
Gentile ${cliente.denominazione},

siamo lieti di inviarvi il contratto per il servizio Metodo Evolvi.

Numero Contratto: ${contratto.numero_contratto}
Periodo: dal ${contratto.data_inizio ? new Date(contratto.data_inizio).toLocaleDateString('it-IT') : 'N/A'} al ${contratto.data_fine ? new Date(contratto.data_fine).toLocaleDateString('it-IT') : 'N/A'}
Importo Annuale: ${contratto.importo_annuale ? Number(contratto.importo_annuale).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }) : 'N/A'}

${contratto.contract_pdf_url ? `Il contratto approvato in formato PDF è disponibile al seguente link:\n${contratto.contract_pdf_url}` : contratto.contract_word_url ? `Il contratto è disponibile al seguente link:\n${contratto.contract_word_url}` : ''}

Vi preghiamo di:
1. Verificare il contenuto del contratto
2. Firmare il documento
3. Restituirci una copia firmata via email

Cordiali saluti,
Team BLM Project Srl
`

    const emailBody = customMessage || defaultMessage

    const emailContent = [
      `To: ${clientEmail}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset="UTF-8"',
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
      requestBody: { raw: encodedMessage }
    })

    // 6. Aggiorna contratto
    await supabase
      .from('scadenze_bandi_contratti_evolvi')
      .update({
        stato: 'inviato',
        inviato_a_email: clientEmail,
        inviato_il: new Date().toISOString()
      })
      .eq('id', contrattoId)

    // 7. Crea record di tracking
    try {
      await supabase.from('scadenze_bandi_contract_tracking').insert({
        entity_type: 'CONTRATTO_EVOLVI',
        entity_id: contrattoId,
        cliente_id: contratto.cliente_id,
        contract_document_url: contratto.contract_pdf_url || contratto.contract_word_url,
        email_sent: true,
        email_sent_at: new Date().toISOString(),
        email_sent_to: clientEmail,
        email_message_id: response.data.id || null,
        email_delivery_status: 'SENT',
        overall_status: 'SENT'
      })
    } catch (trackingError) {
      console.warn('Warning: tracking record non creato:', trackingError)
    }

    return Response.json({
      success: true,
      message: 'Email inviata con successo',
      data: {
        emailId: response.data.id,
        recipient: clientEmail
      }
    })

  } catch (error: any) {
    console.error('Errore invio email contratto Evolvi:', error)
    return Response.json({
      success: false,
      message: `Errore durante invio email: ${error.message || 'errore sconosciuto'}`
    }, { status: 500 })
  }
}
