import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getGmailClient } from '@/lib/gmail'
import { verifyJWT } from '@/lib/jwtAuth'

/**
 * Costruisce l'HTML del corpo email — stesso stile del template contratti Evolvi.
 */
function buildHtmlBody(
  denominazione: string,
  referenteNome: string | null,
  link: string,
  giorniValidita: number,
  messaggioPersonale: string | null,
  firmaHtml?: string | null
): string {
  const saluto = referenteNome
    ? `Gentile ${referenteNome.split(' ')[0]},`
    : `Spettabile <strong>${denominazione}</strong>,`

  const intro = messaggioPersonale && messaggioPersonale.trim().length > 0
    ? messaggioPersonale.trim().replace(/\n/g, '<br>')
    : `per costruire insieme il vostro Piano della Formazione, le chiediamo di compilare un breve questionario online di rilevazione dei fabbisogni formativi.`

  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:20px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">

<!-- Header -->
<tr>
<td style="background:linear-gradient(135deg,#0d9488,#0f766e);padding:30px 40px;text-align:center;">
  <h1 style="color:#ffffff;margin:0;font-size:26px;font-weight:700;letter-spacing:0.5px;">Rilevazione Fabbisogni Formativi</h1>
  <p style="color:#ccfbf1;margin:8px 0 0;font-size:14px;">Costruiamo insieme il vostro Piano della Formazione</p>
</td>
</tr>

<!-- Body -->
<tr>
<td style="padding:35px 40px;">
  <p style="font-size:16px;color:#1f2937;margin:0 0 20px;">
    ${saluto}
  </p>
  <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 25px;">
    ${intro}
  </p>

  <!-- Box informazioni -->
  <table width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #0d9488;border-radius:8px;overflow:hidden;margin:0 0 25px;">
    <tr>
      <td style="background-color:#f0fdfa;padding:15px 20px;border-bottom:1px solid #ccfbf1;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:13px;color:#6b7280;width:45%;">Tempo stimato</td>
            <td style="font-size:15px;color:#0f766e;font-weight:700;">15 minuti</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="background-color:#ffffff;padding:15px 20px;border-bottom:1px solid #ccfbf1;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:13px;color:#6b7280;width:45%;">Modalita'</td>
            <td style="font-size:15px;color:#1f2937;font-weight:600;">Compilazione online, salvataggio automatico</td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="background-color:#f0fdfa;padding:15px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:13px;color:#6b7280;width:45%;">Validita' del link</td>
            <td style="font-size:15px;color:#0f766e;font-weight:700;">${giorniValidita} giorni</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- CTA Button -->
  <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 30px;">
    <tr>
      <td align="center">
        <table cellpadding="0" cellspacing="0">
          <tr>
            <td style="background:linear-gradient(135deg,#0d9488,#0f766e);border-radius:8px;">
              <a href="${link}" style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;letter-spacing:0.3px;">
                Compila il questionario &rarr;
              </a>
            </td>
          </tr>
        </table>
        <p style="font-size:12px;color:#9ca3af;margin:12px 0 0;">
          Se il pulsante non funziona, copi e incolli questo link nel browser:<br>
          <span style="color:#0f766e;word-break:break-all;">${link}</span>
        </p>
      </td>
    </tr>
  </table>

  <p style="font-size:14px;color:#6b7280;line-height:1.6;margin:0 0 8px;">Cosa contiene il questionario:</p>
  <ol style="font-size:14px;color:#374151;line-height:1.8;margin:0 0 25px;padding-left:20px;">
    <li>Anagrafica e contesto aziendale (alcuni dati pre-compilati)</li>
    <li>Strategia formativa e obiettivi</li>
    <li>Stato della formazione obbligatoria</li>
    <li>Aree di sviluppo competenze</li>
    <li>Modalita', budget e vincoli</li>
    <li>Priorita' e valutazione</li>
  </ol>

  <p style="font-size:15px;color:#374151;line-height:1.6;margin:0 0 30px;">
    Per qualsiasi chiarimento puo' rispondere direttamente a questa email.
  </p>

  <!-- Firma -->
  <table width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid #e5e7eb;padding-top:20px;">
    <tr>
      <td>
        <p style="font-size:15px;color:#1f2937;margin:0 0 10px;">Cordiali saluti,</p>
        ${firmaHtml || `<p style="font-size:14px;color:#0f766e;font-weight:700;margin:0 0 3px;">BLM Project Srl</p>
        <p style="font-size:12px;color:#6b7280;margin:0;line-height:1.5;">
          Tel. +39 0171 41 42 05 | info@blmproject.com<br>
          www.blmproject.com
        </p>`}
      </td>
    </tr>
  </table>
</td>
</tr>

<!-- Footer -->
<tr>
<td style="background-color:#f9fafb;padding:15px 40px;text-align:center;border-top:1px solid #e5e7eb;">
  <p style="font-size:11px;color:#9ca3af;margin:0;">
    Questa email e' stata inviata automaticamente dal Gestionale Evolvi.
  </p>
</td>
</tr>

</table>
</td></tr>
</table>
</body>
</html>`
}

/**
 * Costruisce il messaggio MIME (HTML, no allegati).
 */
function buildMimeMessage(params: {
  from: string
  to: string
  subject: string
  htmlBody: string
}): string {
  const { from, to, subject, htmlBody } = params
  const subjectB64 = Buffer.from(subject, 'utf-8').toString('base64')
  const encodedSubject = `=?UTF-8?B?${subjectB64}?=`
  const htmlBase64 = Buffer.from(htmlBody, 'utf-8').toString('base64')

  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    htmlBase64,
  ].join('\r\n')
}

/**
 * POST — Invia email al cliente con il link per compilare il questionario.
 *
 * Body atteso (tutti opzionali):
 *   {
 *     destinatario_email?: string,    // override email del cliente; default cliente.email/pec
 *     messaggio_personale?: string,   // testo libero che sostituisce l'introduzione di default
 *     eh_sollecito?: boolean          // true = re-invio (non cambia stato BOZZA→INVIATA)
 *   }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; rilevazioneId: string }> }
) {
  try {
    const auth = await verifyJWT(request)
    if (!auth) {
      return Response.json({ success: false, error: 'Non autorizzato' }, { status: 401 })
    }

    const { id: clienteId, rilevazioneId } = await params
    const body = await request.json().catch(() => ({}))
    const ehSollecito = !!body.eh_sollecito
    const messaggioPersonale = typeof body.messaggio_personale === 'string'
      ? body.messaggio_personale
      : null

    // 1. Recupera rilevazione
    const { data: ril, error: errRiv } = await supabase
      .from('scadenze_bandi_fabbisogno_rilevazioni')
      .select('*')
      .eq('id', rilevazioneId)
      .eq('cliente_id', clienteId)
      .single()

    if (errRiv || !ril) {
      return Response.json({ success: false, error: 'Rilevazione non trovata' }, { status: 404 })
    }

    if (['COMPLETATA', 'ARCHIVIATA'].includes(ril.stato)) {
      return Response.json(
        { success: false, error: `Rilevazione ${ril.stato.toLowerCase()}: invio non possibile` },
        { status: 400 }
      )
    }

    // 2. Recupera cliente
    const { data: cliente, error: errCliente } = await supabase
      .from('scadenze_bandi_clienti')
      .select('id, denominazione, email, pec, legale_rappresentante_nome, legale_rappresentante_cognome')
      .eq('id', clienteId)
      .single()

    if (errCliente || !cliente) {
      return Response.json({ success: false, error: 'Cliente non trovato' }, { status: 404 })
    }

    const destinatario = body.destinatario_email || cliente.email || cliente.pec
    if (!destinatario) {
      return Response.json(
        { success: false, error: 'Email/PEC del cliente non configurata. Specifica un destinatario.' },
        { status: 400 }
      )
    }

    const referenteNome = [
      cliente.legale_rappresentante_nome,
      cliente.legale_rappresentante_cognome,
    ].filter(Boolean).join(' ') || null

    // 3. Recupera utente per firma e From
    const { data: utente } = await supabase
      .from('scadenze_bandi_utenti')
      .select('nome, cognome, gmail_email, email, firma_email_html')
      .eq('id', auth.userId)
      .single()

    const senderName = utente ? `${utente.nome} ${utente.cognome} BLMProject` : 'BLMProject'
    const senderEmail = utente?.gmail_email || utente?.email || ''
    const fromHeader = senderEmail ? `${senderName} <${senderEmail}>` : senderName

    // 4. Costruisce link al questionario
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const link = `${baseUrl.replace(/\/$/, '')}/fabbisogno/${ril.token}`

    // 5. Calcola giorni residui di validita' del token
    const giorniValidita = ril.token_scadenza
      ? Math.max(1, Math.ceil((new Date(ril.token_scadenza).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : 90

    // 6. Subject
    const subject = ehSollecito
      ? `Promemoria — Questionario fabbisogni formativi (${cliente.denominazione})`
      : `Rilevazione fabbisogni formativi — ${cliente.denominazione}`

    // 7. Costruisce HTML
    const htmlBody = buildHtmlBody(
      cliente.denominazione,
      referenteNome,
      link,
      giorniValidita,
      messaggioPersonale,
      utente?.firma_email_html
    )

    // 8. Gmail client
    let gmail
    try {
      gmail = await getGmailClient(auth.userId)
    } catch (gmailAuthError) {
      const errMsg = gmailAuthError instanceof Error ? gmailAuthError.message : 'errore Gmail'
      return Response.json({
        success: false,
        error: `Errore autenticazione Gmail: ${errMsg}. Verifica di aver collegato Gmail nelle impostazioni.`,
      }, { status: 401 })
    }

    // 9. Invio
    const rawMessage = buildMimeMessage({ from: fromHeader, to: destinatario, subject, htmlBody })
    const encodedMessage = Buffer.from(rawMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '')

    const sendRes = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedMessage },
    })

    // 10. Aggiorna stato rilevazione
    const updates: Record<string, unknown> = {
      data_invio: new Date().toISOString(),
      inviata_da_utente_id: auth.userId,
    }
    if (!ehSollecito && ril.stato === 'BOZZA') {
      updates.stato = 'INVIATA'
    }

    const { data: updated, error: errUp } = await supabase
      .from('scadenze_bandi_fabbisogno_rilevazioni')
      .update(updates)
      .eq('id', rilevazioneId)
      .select()
      .single()

    if (errUp) throw errUp

    return Response.json({
      success: true,
      data: {
        rilevazione: updated,
        email: {
          to: destinatario,
          subject,
          messageId: sendRes.data.id,
        },
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore nell\'invio email'
    console.error('[API fabbisogno] send-email Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
