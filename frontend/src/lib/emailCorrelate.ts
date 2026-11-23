/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
import { supabaseAdmin } from './supabaseAdmin'

/**
 * Email collegate a un cliente: indirizzi del cliente (email, PEC, legale
 * rappresentante, referenti) e dominio aziendale, ricerca nel Gmail di chi è
 * collegato, lettura del messaggio e PDF per l'archiviazione su Drive.
 */

const GENERICI = new Set(['gmail.com', 'googlemail.com', 'libero.it', 'hotmail.com', 'hotmail.it', 'outlook.com', 'outlook.it',
  'live.com', 'live.it', 'yahoo.com', 'yahoo.it', 'icloud.com', 'me.com', 'alice.it', 'tin.it', 'virgilio.it', 'tiscali.it',
  'fastwebnet.it', 'email.it', 'inwind.it', 'msn.com', 'aol.com', 'protonmail.com', 'proton.me'])
const PEC = /(^|\.)(pec\.|legalmail\.it$|pec\.it$|arubapec\.it$|postacert|cert\.|pecimprese\.it$|sicurezzapostale\.it$|mypec\.eu$)/

export async function indirizziCliente(clienteId: string) {
  const [{ data: c }, { data: referenti }] = await Promise.all([
    supabaseAdmin.from('scadenze_bandi_clienti').select('denominazione, email, pec, legale_rappresentante_email').eq('id', clienteId).maybeSingle(),
    supabaseAdmin.from('scadenze_bandi_clienti_referenti').select('email').eq('cliente_id', clienteId)
  ])
  const grezzi = [c?.email, c?.pec, c?.legale_rappresentante_email, ...(referenti || []).map(r => r.email)]
  const indirizzi = Array.from(new Set(grezzi.flatMap(x => String(x || '').split(/[;,\s]+/))
    .map(x => x.trim().toLowerCase()).filter(x => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(x))))
  const domini = Array.from(new Set(indirizzi.map(x => x.split('@')[1]).filter(d => !GENERICI.has(d) && !PEC.test(d))))
  return { denominazione: c?.denominazione || '', indirizzi, domini }
}

/** Ricerca Gmail: messaggi da o verso uno degli indirizzi o dei domini del cliente. */
export function queryGmail(indirizzi: string[], domini: string[], extra = '') {
  const termini = [
    ...indirizzi.flatMap(a => [`from:${a}`, `to:${a}`, `cc:${a}`]),
    ...domini.flatMap(d => [`from:${d}`, `to:${d}`])
  ]
  if (!termini.length) return null
  let q = `{${termini.join(' ')}}`
  if (q.length > 1800) q = `{${termini.slice(0, 60).join(' ')}}`
  const aggiunta = extra.replace(/[{}]/g, ' ').trim()
  return aggiunta ? `${q} ${aggiunta}` : q
}

const b64 = (s?: string | null) => (s ? Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64') : Buffer.alloc(0))

export type MessaggioLetto = {
  id: string; threadId: string; oggetto: string; mittente: string; destinatari: string; cc: string; data: string | null
  html: string; testo: string; allegati: { filename: string; mimeType: string; size: number; attachmentId: string }[]
}

export function leggiMessaggio(m: any): MessaggioLetto {
  const h = (n: string) => (m.payload?.headers || []).find((x: any) => x.name?.toLowerCase() === n)?.value || ''
  let html = '', testo = ''
  const allegati: MessaggioLetto['allegati'] = []
  const visita = (p: any) => {
    if (!p) return
    if (p.filename && p.body?.attachmentId) {
      allegati.push({ filename: p.filename, mimeType: p.mimeType, size: p.body.size || 0, attachmentId: p.body.attachmentId })
    } else if (p.mimeType === 'text/html' && p.body?.data && !html) {
      html = b64(p.body.data).toString('utf-8')
    } else if (p.mimeType === 'text/plain' && p.body?.data && !testo) {
      testo = b64(p.body.data).toString('utf-8')
    }
    for (const figlio of p.parts || []) visita(figlio)
  }
  visita(m.payload)
  return {
    id: m.id, threadId: m.threadId, oggetto: h('subject'), mittente: h('from'), destinatari: h('to'), cc: h('cc'),
    data: m.internalDate ? new Date(Number(m.internalDate)).toISOString() : null, html, testo, allegati
  }
}

/** Testo leggibile da un corpo HTML, per il PDF. */
export function htmlInTesto(html: string) {
  return html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

export async function pdfEmail(m: MessaggioLetto, casella: string): Promise<Buffer> {
  const mod = require('pdfmake')
  const pdfmake = mod?.default ?? mod
  pdfmake.fonts = { Helvetica: { normal: 'Helvetica', bold: 'Helvetica-Bold', italics: 'Helvetica-Oblique', bolditalics: 'Helvetica-BoldOblique' } }
  const corpo = m.testo || htmlInTesto(m.html) || '(messaggio senza testo)'
  const riga = (etichetta: string, valore: string) => valore ? [{ text: etichetta, bold: true, fontSize: 9 }, { text: valore, fontSize: 9 }] : null
  const intestazione = [
    riga('Da', m.mittente), riga('A', m.destinatari), riga('Cc', m.cc),
    riga('Data', m.data ? new Date(m.data).toLocaleString('it-IT', { timeZone: 'Europe/Rome' }) : ''),
    riga('Oggetto', m.oggetto),
    riga('Allegati', m.allegati.map(a => a.filename).join(', '))
  ].filter(Boolean)
  const doc = {
    pageSize: 'A4', pageMargins: [40, 40, 40, 40],
    defaultStyle: { font: 'Helvetica', fontSize: 10 },
    content: [
      { text: m.oggetto || '(senza oggetto)', fontSize: 14, bold: true, margin: [0, 0, 0, 8] },
      { table: { widths: [60, '*'], body: intestazione }, layout: 'noBorders', margin: [0, 0, 0, 10] },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#d1d5db' }], margin: [0, 0, 0, 10] },
      { text: corpo.slice(0, 200_000), fontSize: 10, lineHeight: 1.2 }
    ],
    footer: (p: number, t: number) => ({
      text: `Archiviata dal Gestionale Evolvi il ${new Date().toLocaleDateString('it-IT')} dalla casella ${casella} · pagina ${p} di ${t}`,
      alignment: 'center', fontSize: 7, color: '#9ca3af'
    })
  }
  return pdfmake.createPdf(doc).getBuffer()
}

export function nomeFileEmail(m: MessaggioLetto) {
  const data = (m.data || new Date().toISOString()).slice(0, 10)
  const oggetto = (m.oggetto || 'senza oggetto').replace(/[\\/:*?"<>|\r\n]+/g, ' ').trim().slice(0, 80)
  return `Email_${data}_${oggetto}.pdf`
}
