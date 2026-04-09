import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getValidGoogleToken } from '@/lib/googleAuth'
import { gmail_v1, google } from 'googleapis'

interface EmailData {
  clientEmail: string
  clientName: string
  projectTitle: string
  contractUrl: string
  bandoName: string
}

export async function POST(req: NextRequest) {
  try {
    const { progettoId, contractId, contractUrl, customMessage } = await req.json()

    if (!progettoId || !contractId || !contractUrl) {
      return Response.json({
        message: 'ID progetto, ID contratto e URL contratto richiesti'
      }, { status: 400 })
    }

    // 1. Recupera dati progetto per email (query separate per evitare problemi di relazioni)
    const { data: baseProgetto, error: projectError } = await supabase
      .from('scadenze_bandi_progetti')
      .select('*')
      .eq('id', progettoId)
      .single()

    if (projectError || !baseProgetto) {
      return Response.json({ message: 'Progetto non trovato' }, { status: 404 })
    }

    // Recupera dati cliente
    const { data: clienteData, error: clienteError } = await supabase
      .from('scadenze_bandi_clienti')
      .select('denominazione, email, pec')
      .eq('id', baseProgetto.cliente_id)
      .single()

    // Recupera dati bando
    const { data: bandoData, error: bandoError } = await supabase
      .from('scadenze_bandi_bandi')
      .select('nome, ente_erogatore')
      .eq('id', baseProgetto.bando_id)
      .single()

    if (clienteError || bandoError) {
      return Response.json({
        message: 'Errore recupero dati cliente/bando',
        error: clienteError?.message || bandoError?.message
      }, { status: 404 })
    }

    // Componi oggetto progetto
    const progetto = {
      ...baseProgetto,
      scadenze_bandi_clienti: clienteData,
      scadenze_bandi_bandi: bandoData
    }

    // 2. Determina email destinazione: email || pec
    const clientEmail = progetto.scadenze_bandi_clienti.email || progetto.scadenze_bandi_clienti.pec
    if (!clientEmail) {
      return Response.json({
        message: 'Email/PEC del cliente non configurata'
      }, { status: 400 })
    }

    const emailType = progetto.scadenze_bandi_clienti.email ? 'email' : 'PEC'
    console.log(`📧 Invio contratto via ${emailType}: ${clientEmail}`)

    // 3. Prepara dati per email
    const emailData: EmailData = {
      clientEmail,
      clientName: progetto.scadenze_bandi_clienti.denominazione,
      projectTitle: progetto.titolo_progetto,
      contractUrl,
      bandoName: progetto.scadenze_bandi_bandi.nome
    }

    // 4. Ottieni token Gmail
    const googleAccessToken = await getValidGoogleToken()
    if (!googleAccessToken) {
      return Response.json({
        success: false,
        message: 'Gmail non configurato'
      }, { status: 401 })
    }

    // 5. Invia email
    const emailResult = await sendContractEmail(googleAccessToken, emailData, customMessage)

    if (!emailResult.success) {
      return Response.json({
        success: false,
        message: 'Errore invio email',
        error: emailResult.error
      }, { status: 500 })
    }

    // 6. Log invio email nel database (opzionale)
    await logEmailSent(progettoId, clientEmail, contractId)

    // 7. Crea record di tracking contratto
    try {
      await supabase.from('scadenze_bandi_contract_tracking').upsert({
        entity_type: 'PROGETTO',
        entity_id: progettoId,
        cliente_id: baseProgetto.cliente_id,
        contract_document_url: contractUrl,
        email_sent: true,
        email_sent_at: new Date().toISOString(),
        email_sent_to: clientEmail,
        email_message_id: emailResult.emailId || null,
        email_delivery_status: 'SENT',
        overall_status: 'SENT'
      }, { onConflict: 'entity_type,entity_id', ignoreDuplicates: false })
    } catch (trackingError) {
      console.warn('Warning: tracking record non creato:', trackingError)
    }

    return Response.json({
      success: true,
      message: 'Email inviata con successo',
      data: {
        emailId: emailResult.emailId,
        recipient: clientEmail,
        contractUrl
      }
    })

  } catch (error: any) {
    console.error('Errore invio email contratto:', error)
    return Response.json({
      success: false,
      message: 'Errore durante invio email',
      error: error.message
    }, { status: 500 })
  }
}

// Invia email con contratto allegato
async function sendContractEmail(
  accessToken: string,
  emailData: EmailData,
  customMessage?: string
): Promise<{ success: boolean; emailId?: string; error?: string }> {
  try {
    // Crea client Gmail
    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: accessToken })
    const gmail = google.gmail({ version: 'v1', auth })

    // Template email
    const subject = `Contratto di consulenza - Progetto: ${emailData.projectTitle}`

    const defaultMessage = `
Gentile ${emailData.clientName},

siamo lieti di inviarvi in allegato il contratto di consulenza per il progetto:

**${emailData.projectTitle}**
Bando di riferimento: ${emailData.bandoName}

Il contratto è disponibile al seguente link:
${emailData.contractUrl}

Vi preghiamo di:
1. Scaricare e verificare il contenuto del contratto
2. Firmare il documento in formato digitale o stamparlo e firmarlo
3. Restituirci una copia firmata via email

Per qualsiasi chiarimento o modifica, non esitate a contattarci.

Cordiali saluti,
Team BLM Project Srl
Email: info@blmproject.com
Tel: [NUMERO_TELEFONO]
`

    const emailBody = customMessage || defaultMessage

    // Crea email in formato RFC 2822
    const emailContent = [
      `To: ${emailData.clientEmail}`,
      `Subject: ${subject}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      '',
      emailBody
    ].join('\n')

    // Codifica in base64
    const encodedMessage = Buffer.from(emailContent)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    // Invia email
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage
      }
    })

    console.log('✅ Email contratto inviata:', response.data.id)

    return {
      success: true,
      emailId: response.data.id ?? undefined
    }

  } catch (error: any) {
    console.error('❌ Errore invio email Gmail:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// Log invio email nel database per tracciabilità
async function logEmailSent(progettoId: string, emailRecipient: string, contractId: string) {
  try {
    const { error } = await supabase
      .from('email_log')
      .insert({
        progetto_id: progettoId,
        tipo_email: 'contratto',
        destinatario: emailRecipient,
        oggetto: `Contratto di consulenza - Progetto`,
        stato: 'inviata',
        metadata: {
          contract_id: contractId,
          sent_at: new Date().toISOString()
        },
        created_at: new Date().toISOString()
      })

    if (error) {
      console.error('⚠️ Errore log email:', error)
      // Non bloccare il flusso per errori di logging
    } else {
      console.log('📝 Email loggata nel database')
    }
  } catch (error) {
    console.error('⚠️ Errore logging email:', error)
    // Non bloccare il flusso
  }
}