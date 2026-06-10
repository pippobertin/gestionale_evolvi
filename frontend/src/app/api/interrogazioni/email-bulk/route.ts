/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyJWT } from '@/lib/jwtAuth'
import { getGmailClient } from '@/lib/gmail'
import { getAmbito } from '@/lib/interrogazioni/registry'
import { eseguiInterrogazione, leggiCampo } from '@/lib/interrogazioni/queryBuilder'

const LIMITE_DESTINATARI = 100
const DELAY_TRA_INVII_MS = 800   // 0.8s tra un'email e l'altra

/**
 * POST /api/interrogazioni/email-bulk
 *
 * Body:
 *   {
 *     ambito: string,
 *     filtri: Record<string, ValoreFiltro>,
 *     oggetto: string,
 *     corpo: string,                          // template, {nome} viene sostituito
 *     anteprima_destinatari?: boolean         // se true non spedisce, restituisce solo la lista
 *   }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyJWT(request)
    if (!auth) {
      return Response.json({ success: false, error: 'Non autorizzato' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const ambito = getAmbito(body.ambito as string)
    if (!ambito) {
      return Response.json({ success: false, error: 'Ambito sconosciuto' }, { status: 400 })
    }
    if (!ambito.azione_email) {
      return Response.json({ success: false, error: 'Questo ambito non supporta l\'invio email' }, { status: 400 })
    }

    const oggetto = (body.oggetto || '').toString().trim()
    const corpo = (body.corpo || '').toString()
    const soloAnteprima = body.anteprima_destinatari === true

    if (!soloAnteprima && (!oggetto || !corpo)) {
      return Response.json({ success: false, error: 'Oggetto e corpo email sono obbligatori' }, { status: 400 })
    }

    // Esegui ricerca senza paginazione
    const { righe } = await eseguiInterrogazione({
      ambito,
      filtri: body.filtri || {},
      senza_paginazione: true,
    })

    // Estrai destinatari validi e deduplichiamo per email
    const visti = new Set<string>()
    const destinatari: Array<{ email: string; nome: string }> = []
    for (const riga of righe) {
      const email = (leggiCampo(riga, ambito.azione_email.campo_email) as string)
        || (ambito.azione_email.campo_email_fallback
          ? (leggiCampo(riga, ambito.azione_email.campo_email_fallback) as string)
          : '')
      const emailNorm = (email || '').toString().trim().toLowerCase()
      if (!emailNorm || visti.has(emailNorm)) continue
      // Validazione minima
      if (!emailNorm.match(/^[^@\s]+@[^@\s]+\.[^@\s]+$/)) continue
      visti.add(emailNorm)
      const nome = (leggiCampo(riga, ambito.azione_email.campo_nome) as string) || emailNorm
      destinatari.push({ email: emailNorm, nome })
    }

    if (destinatari.length === 0) {
      return Response.json({
        success: false,
        error: 'Nessun destinatario valido nel subset filtrato (controlla che il campo email sia popolato).',
      }, { status: 400 })
    }

    if (destinatari.length > LIMITE_DESTINATARI) {
      return Response.json({
        success: false,
        error: `Troppi destinatari (${destinatari.length}). Massimo consentito: ${LIMITE_DESTINATARI}. Raffina i filtri.`,
      }, { status: 400 })
    }

    if (soloAnteprima) {
      return Response.json({
        success: true,
        data: { destinatari, totale: destinatari.length },
      })
    }

    // Recupera utente per il From + firma
    const { data: utente } = await supabase
      .from('scadenze_bandi_utenti')
      .select('nome, cognome, gmail_email, email, firma_email_html')
      .eq('id', auth.userId)
      .single()

    const senderName = utente ? `${utente.nome} ${utente.cognome} BLMProject` : 'BLMProject'
    const senderEmail = utente?.gmail_email || utente?.email || ''
    const fromHeader = senderEmail ? `${senderName} <${senderEmail}>` : senderName

    let gmail: any
    try {
      gmail = await getGmailClient(auth.userId)
    } catch (e: any) {
      return Response.json({
        success: false,
        error: `Gmail non collegato o token scaduto: ${e.message}`,
      }, { status: 401 })
    }

    // Invio sequenziale con delay
    const risultati: Array<{ email: string; nome: string; success: boolean; error?: string }> = []
    for (const d of destinatari) {
      try {
        const corpoPersonalizzato = corpo.replace(/\{nome\}/g, d.nome)
        const htmlBody = buildHtml(corpoPersonalizzato, utente?.firma_email_html)
        const raw = buildMimeMessage({
          from: fromHeader,
          to: d.email,
          subject: oggetto,
          htmlBody,
        })
        const encoded = Buffer.from(raw)
          .toString('base64')
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/, '')
        await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encoded } })
        risultati.push({ email: d.email, nome: d.nome, success: true })
      } catch (e: any) {
        risultati.push({ email: d.email, nome: d.nome, success: false, error: e.message || 'Errore invio' })
      }
      await sleep(DELAY_TRA_INVII_MS)
    }

    const totaleSuccess = risultati.filter(r => r.success).length
    return Response.json({
      success: true,
      data: {
        totale_destinatari: destinatari.length,
        inviati: totaleSuccess,
        falliti: destinatari.length - totaleSuccess,
        dettagli: risultati,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore invio email'
    console.error('[API interrogazioni/email-bulk] Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function buildHtml(corpo: string, firmaHtml?: string | null): string {
  const corpoHtml = corpo
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')

  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f4f4f4;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:20px 0;background:#f4f4f4;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
<tr><td style="padding:32px 36px 20px;font-size:15px;color:#374151;line-height:1.6;">
${corpoHtml}
</td></tr>
<tr><td style="padding:12px 36px 28px;border-top:1px solid #e5e7eb;">
${firmaHtml || `<p style="font-size:14px;color:#0f766e;font-weight:700;margin:0 0 3px;">BLM Project Srl</p>
<p style="font-size:12px;color:#6b7280;margin:0;line-height:1.5;">
  Tel. +39 0171 41 42 05 | info@blmproject.com<br>www.blmproject.com
</p>`}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

function buildMimeMessage(p: { from: string; to: string; subject: string; htmlBody: string }): string {
  const subjectB64 = Buffer.from(p.subject, 'utf-8').toString('base64')
  const encodedSubject = `=?UTF-8?B?${subjectB64}?=`
  const htmlBase64 = Buffer.from(p.htmlBody, 'utf-8').toString('base64')
  return [
    `From: ${p.from}`,
    `To: ${p.to}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    htmlBase64,
  ].join('\r\n')
}
