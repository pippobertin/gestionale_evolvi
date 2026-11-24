import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getValidGoogleToken } from '@/lib/googleAuth'
import { CALENDAR_ID } from '@/lib/calendarioStudio'
import { oggiItalia } from '@/lib/accessoUtente'

/**
 * Controllo automatico delle pagine dei bandi.
 *
 * Per ogni bando da controllare (con progetti inviati e in attesa del decreto,
 * oppure acceso a mano) legge la pagina ufficiale e le altre pagine indicate,
 * estrae i collegamenti e li confronta con quelli già visti. Un collegamento
 * nuovo con parole come graduatoria, esiti, ammessi è una novità "graduatoria";
 * un PDF o un foglio nuovo senza quelle parole è un "documento". La prima
 * lettura di una pagina registra tutto come già visto, senza avvisi.
 *
 * Per le novità "graduatoria" nasce una scadenza "Controllare la graduatoria"
 * per ciascun responsabile dei progetti del bando in attesa del decreto, con
 * l'evento nel calendario dello studio se l'account Google lo permette.
 */

const TIMEOUT_MS = 15000
const MAX_BYTES = 3_000_000
const MAX_SOTTOPAGINE = 5
// Nome generico del programma che legge le pagine (nessun dato dello studio)
const AGENTE = 'Mozilla/5.0 (compatible; ControlloBandi/1.0)'

export type Link = { url: string; testo: string }
type EsitoLettura =
  | { esito: 'ok'; link: Link[]; messaggio: string }
  | { esito: 'non_controllabile' | 'errore'; messaggio: string }

export const normalizza = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

// Parole che fanno pensare a una graduatoria o a un esito (testo e indirizzo del collegamento)
const PAROLE: { etichetta: string; re: RegExp }[] = [
  { etichetta: 'graduatoria', re: /graduator/ },
  { etichetta: 'esiti', re: /\besit[oi]\b/ },
  { etichetta: 'ammessi', re: /\b(non )?ammess[aeio]\b|ammissibil/ },
  { etichetta: 'beneficiari', re: /beneficiari/ },
  { etichetta: 'decreto di concessione', re: /decret[oi] (di )?concession|concessione (dei |del )?(contribut|agevolazion|finanziament)/ },
  { etichetta: 'approvazione elenco', re: /approvazione (dell'?|degli |delle )?elench|elenco (delle |dei )?(domande|imprese|progetti|beneficiari)/ },
  { etichetta: 'finanziati', re: /\bfinanziat[ei]\b|non finanziabil|finanziabil/ },
  { etichetta: 'istruttoria', re: /istruttori/ }
]
const DOCUMENTO = /\.(pdf|xlsx?|ods|csv|zip|p7m|docx?|odt)(\?|#|$)/i
// Sottopagine dello stesso sito che conviene seguire
const SOTTOPAGINA = /notizi|news|avvis|comunicat|esit|graduator|document|allegat|aggiornament|novita/

export function paroleTrovate(link: Link): string[] {
  let percorso = link.url
  try { percorso = decodeURIComponent(link.url) } catch { /* indirizzo con caratteri non validi: si usa com'è */ }
  const dove = normalizza(`${link.testo} ${percorso.replace(/[-_/.]+/g, ' ')}`)
  return PAROLE.filter(p => p.re.test(dove)).map(p => p.etichetta)
}

const testoPulito = (html: string) => html
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"')
  .replace(/&agrave;/g, 'à').replace(/&egrave;/g, 'è').replace(/&eacute;/g, 'é').replace(/&igrave;/g, 'ì').replace(/&ograve;/g, 'ò').replace(/&ugrave;/g, 'ù')
  .replace(/\s+/g, ' ').trim()

/** Indirizzo confrontabile: assoluto, senza ancora e senza barra finale. */
export function indirizzo(href: string, base: string): string | null {
  try {
    const u = new URL(href.trim(), base)
    if (!/^https?:$/.test(u.protocol)) return null
    u.hash = ''
    return u.toString().replace(/\/$/, '')
  } catch { return null }
}

export function estraiLink(html: string, base: string): Link[] {
  const visti = new Map<string, Link>()
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    const attr = m[1]
    const href = /href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attr)
    if (!href) continue
    const url = indirizzo(href[2] ?? href[3] ?? href[4] ?? '', base)
    if (!url || url === base.replace(/#.*$/, '').replace(/\/$/, '')) continue
    const titolo = /title\s*=\s*"([^"]*)"/i.exec(attr)?.[1] || ''
    const testo = (testoPulito(m[2]) || titolo).slice(0, 300)
    const prima = visti.get(url)
    if (!prima || (!prima.testo && testo)) visti.set(url, { url, testo })
  }
  return Array.from(visti.values())
}

/** Legge una pagina e dice se si può controllare. */
export async function leggiPagina(url: string): Promise<EsitoLettura> {
  let r: Response
  try {
    r = await fetch(url, {
      headers: { 'User-Agent': AGENTE, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'it-IT,it;q=0.9' },
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store'
    })
  } catch (e) {
    const msg = e instanceof Error && e.name === 'TimeoutError' ? 'il sito non ha risposto in tempo' : 'il sito non è raggiungibile'
    return { esito: 'errore', messaggio: msg }
  }
  if (r.status === 401 || r.status === 403 || r.status === 429) {
    return { esito: 'non_controllabile', messaggio: `il sito blocca i controlli automatici (codice ${r.status})` }
  }
  if (r.status === 404 || r.status === 410) return { esito: 'errore', messaggio: 'la pagina non esiste più: controlla l\'indirizzo' }
  if (!r.ok) return { esito: 'errore', messaggio: `il sito ha risposto con un errore (codice ${r.status})` }
  const tipo = r.headers.get('content-type') || ''
  if (!/html|xml/i.test(tipo)) {
    return { esito: 'non_controllabile', messaggio: 'l\'indirizzo porta a un documento, non a una pagina: indica la pagina che lo contiene' }
  }
  const buf = await r.arrayBuffer()
  const html = new TextDecoder('utf-8').decode(buf.byteLength > MAX_BYTES ? buf.slice(0, MAX_BYTES) : buf)
  const base = r.url || url
  const link = estraiLink(html, base)
  const testo = testoPulito(html)
  if (/<input[^>]+type\s*=\s*["']?password/i.test(html) && link.length < 30) {
    return { esito: 'non_controllabile', messaggio: 'la pagina richiede l\'accesso con le credenziali' }
  }
  if (/cf-browser-verification|challenge-platform|just a moment\.\.\./i.test(html)) {
    return { esito: 'non_controllabile', messaggio: 'il sito blocca i controlli automatici (verifica anti-robot)' }
  }
  if (link.length < 5 && testo.length < 600) {
    return { esito: 'non_controllabile', messaggio: 'la pagina carica i contenuti con JavaScript e a una lettura automatica risulta vuota' }
  }
  return { esito: 'ok', link, messaggio: `${link.length} collegamenti letti` }
}

type Pagina = {
  id: string; bando_id: string; url: string; origine: string; attiva: boolean
  link_noti: string[]; ultimo_controllo: string | null
}
type Novita = { pagina_id: string; url: string; testo: string; tipo: 'graduatoria' | 'documento'; parole: string[] }

/** Bandi da controllare: accesi a mano, oppure in automatico con progetti inviati in attesa del decreto. */
export async function bandiDaControllare(): Promise<string[]> {
  const [{ data: bandi }, { data: progetti }] = await Promise.all([
    supabaseAdmin.from('scadenze_bandi_bandi').select('id, controllo_pagina, link_bando_ufficiale'),
    supabaseAdmin.from('scadenze_bandi_progetti_view').select('bando_id, fase, stato_calcolato')
  ])
  const inAttesa = new Set((progetti || [])
    .filter((p: any) => p.stato_calcolato === 'DECRETO_ATTESO' && (!p.fase || p.fase === 'inviata'))
    .map((p: any) => p.bando_id))
  return (bandi || [])
    .filter((b: any) => b.controllo_pagina === 'acceso' || (b.controllo_pagina !== 'spento' && inAttesa.has(b.id)))
    .map((b: any) => b.id)
}

/** Allinea la pagina che viene dal link ufficiale del bando. */
async function allineaLinkUfficiale(bandoId: string): Promise<void> {
  const { data: bando } = await supabaseAdmin.from('scadenze_bandi_bandi').select('link_bando_ufficiale').eq('id', bandoId).maybeSingle()
  const link = bando?.link_bando_ufficiale ? indirizzo(bando.link_bando_ufficiale, bando.link_bando_ufficiale) : null
  const { data: ufficiale } = await supabaseAdmin.from('scadenze_bandi_controllo_pagine')
    .select('id, url').eq('bando_id', bandoId).eq('origine', 'link_ufficiale').maybeSingle()
  if (!link) {
    if (ufficiale) await supabaseAdmin.from('scadenze_bandi_controllo_pagine').delete().eq('id', ufficiale.id)
    return
  }
  if (ufficiale?.url === link) return
  if (ufficiale) {
    // Link cambiato: si riparte da capo con il nuovo indirizzo
    await supabaseAdmin.from('scadenze_bandi_controllo_pagine')
      .update({ url: link, link_noti: [], ultimo_controllo: null, esito: null, messaggio: null, updated_at: new Date().toISOString() })
      .eq('id', ufficiale.id)
  } else {
    await supabaseAdmin.from('scadenze_bandi_controllo_pagine')
      .upsert({ bando_id: bandoId, url: link, origine: 'link_ufficiale', etichetta: 'Pagina ufficiale del bando' }, { onConflict: 'bando_id,url', ignoreDuplicates: true })
  }
}

async function controllaPagina(p: Pagina): Promise<{ novita: Novita[]; link: Link[] }> {
  const lettura = await leggiPagina(p.url)
  const ora = new Date().toISOString()
  if (lettura.esito !== 'ok') {
    await supabaseAdmin.from('scadenze_bandi_controllo_pagine')
      .update({ esito: lettura.esito, messaggio: lettura.messaggio, ultimo_controllo: ora, updated_at: ora }).eq('id', p.id)
    return { novita: [], link: [] }
  }
  const noti = new Set(p.link_noti || [])
  const primaLettura = !p.ultimo_controllo || noti.size === 0
  const novita: Novita[] = []
  if (!primaLettura) {
    for (const l of lettura.link) {
      if (noti.has(l.url)) continue
      const parole = paroleTrovate(l)
      if (parole.length) novita.push({ pagina_id: p.id, url: l.url, testo: l.testo, tipo: 'graduatoria', parole })
      else if (DOCUMENTO.test(l.url)) novita.push({ pagina_id: p.id, url: l.url, testo: l.testo, tipo: 'documento', parole: [] })
    }
  }
  // I collegamenti già visti restano anche se spariscono dalla pagina (al massimo 3000)
  const tutti = Array.from(new Set(lettura.link.map(l => l.url).concat(Array.from(noti)))).slice(0, 3000)
  await supabaseAdmin.from('scadenze_bandi_controllo_pagine').update({
    esito: 'ok',
    messaggio: primaLettura ? `prima lettura: ${lettura.link.length} collegamenti registrati come già visti` : lettura.messaggio,
    link_noti: tutti, ultimo_controllo: ora, updated_at: ora
  }).eq('id', p.id)
  return { novita, link: lettura.link }
}

/** Sottopagine dello stesso sito da seguire (notizie, avvisi, esiti, documenti). */
async function aggiungiSottopagine(bandoId: string, principale: Pagina, link: Link[]): Promise<void> {
  const { data: esistenti } = await supabaseAdmin.from('scadenze_bandi_controllo_pagine').select('url, origine').eq('bando_id', bandoId)
  const gia = new Set((esistenti || []).map((e: any) => e.url))
  let posti = MAX_SOTTOPAGINE - (esistenti || []).filter((e: any) => e.origine === 'sottopagina').length
  if (posti <= 0) return
  const host = new URL(principale.url).host
  for (const l of link) {
    if (posti <= 0) break
    if (gia.has(l.url) || DOCUMENTO.test(l.url)) continue
    let u: URL
    try { u = new URL(l.url) } catch { continue }
    if (u.host !== host) continue
    if (!SOTTOPAGINA.test(normalizza(`${l.testo} ${u.pathname}`))) continue
    const { error } = await supabaseAdmin.from('scadenze_bandi_controllo_pagine')
      .insert({ bando_id: bandoId, url: l.url, origine: 'sottopagina', etichetta: (l.testo || u.pathname).slice(0, 120) })
    if (!error) { posti--; gia.add(l.url) }
  }
}

/** Evento nel calendario dello studio, se l'account Google lo permette. */
async function eventoCalendario(titolo: string, descrizione: string, data: string, invitati: string[]): Promise<boolean> {
  try {
    const token = await getValidGoogleToken()
    if (!token) return false
    const fine = new Date(`${data}T12:00:00Z`); fine.setUTCDate(fine.getUTCDate() + 1)
    const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: titolo, description: descrizione,
        start: { date: data }, end: { date: fine.toISOString().slice(0, 10) },
        attendees: invitati.map(email => ({ email })),
        reminders: { useDefault: true }
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    })
    return r.ok
  } catch { return false }
}

/** Scadenza "Controllare la graduatoria" per ciascun responsabile dei progetti in attesa del decreto. */
async function creaScadenze(bandoId: string, novita: { url: string; testo: string | null }[]): Promise<{ scadenze: number; calendario: boolean }> {
  const [{ data: bando }, { data: progetti }, { data: utenti }] = await Promise.all([
    supabaseAdmin.from('scadenze_bandi_bandi').select('nome').eq('id', bandoId).maybeSingle(),
    supabaseAdmin.from('scadenze_bandi_progetti_view').select('id, cliente_id, titolo_progetto, cliente_denominazione, fase, stato_calcolato, rp_id, email_referente_interno').eq('bando_id', bandoId),
    supabaseAdmin.from('scadenze_bandi_utenti').select('id, email')
  ])
  const emailDi = new Map((utenti || []).map((u: any) => [u.id, u.email]))
  const inAttesa = (progetti || []).filter((p: any) => p.stato_calcolato === 'DECRETO_ATTESO' && (!p.fase || p.fase === 'inviata'))
  // Un responsabile, una scadenza: con l'elenco dei suoi progetti nel bando
  const perResponsabile = new Map<string, any[]>()
  for (const p of inAttesa) {
    const email = (p.rp_id && emailDi.get(p.rp_id)) || p.email_referente_interno
    if (!email) continue
    perResponsabile.set(email, [...(perResponsabile.get(email) || []), p])
  }
  const oggi = oggiItalia()
  const titolo = `Controllare la graduatoria: ${bando?.nome || 'bando'}`
  const elencoNovita = novita.map(n => `- ${n.testo || 'documento'}: ${n.url}`).join('\n')
  let scadenze = 0
  for (const [email, suoi] of Array.from(perResponsabile.entries())) {
    const note = `Sul sito dell'ente sono comparsi collegamenti che sembrano una graduatoria o un esito:\n${elencoNovita}\n\nProgetti in attesa del decreto: ${suoi.map((p: any) => `${p.cliente_denominazione || ''} (${p.titolo_progetto || ''})`).join('; ')}.\nSegnalato dal controllo automatico delle pagine dei bandi.`
    const { error } = await supabaseAdmin.from('scadenze_bandi_scadenze').insert({
      titolo, data_scadenza: oggi, stato: 'non_iniziata', priorita: 'alta', responsabile_email: email,
      bando_id: bandoId, progetto_id: suoi.length === 1 ? suoi[0].id : null, cliente_id: suoi.length === 1 ? suoi[0].cliente_id : null,
      note
    })
    if (!error) scadenze++
  }
  const calendario = scadenze > 0
    ? await eventoCalendario(titolo, elencoNovita, oggi, Array.from(perResponsabile.keys()))
    : false
  return { scadenze, calendario }
}

export type RisultatoBando = { bandoId: string; pagine: number; novita: number; graduatorie: number; scadenze: number; calendario: boolean }

/** Controlla tutte le pagine attive di un bando. */
export async function controllaBando(bandoId: string): Promise<RisultatoBando> {
  await allineaLinkUfficiale(bandoId)
  const leggi = async () => (await supabaseAdmin.from('scadenze_bandi_controllo_pagine')
    .select('id, bando_id, url, origine, attiva, link_noti, ultimo_controllo').eq('bando_id', bandoId).eq('attiva', true)).data as Pagina[] | null
  let pagine = (await leggi()) || []
  const trovate: Novita[] = []
  // Prima le pagine principali (che possono indicare sottopagine), poi le sottopagine
  for (const p of pagine.filter(x => x.origine !== 'sottopagina')) {
    const { novita, link } = await controllaPagina(p)
    trovate.push(...novita)
    if (link.length) await aggiungiSottopagine(bandoId, p, link)
  }
  pagine = (await leggi()) || []
  for (const p of pagine.filter(x => x.origine === 'sottopagina')) {
    trovate.push(...(await controllaPagina(p)).novita)
  }
  // Una novità per collegamento e per bando (anche se compare in più pagine)
  const uniche = Array.from(new Map(trovate.map(n => [n.url, n])).values())
  let inserite: any[] = []
  if (uniche.length) {
    const { data } = await supabaseAdmin.from('scadenze_bandi_controllo_novita')
      .upsert(uniche.map(n => ({ bando_id: bandoId, ...n, testo: n.testo || null })), { onConflict: 'bando_id,url', ignoreDuplicates: true })
      .select('id, url, testo, tipo')
    inserite = data || []
  }
  const graduatorie = inserite.filter(n => n.tipo === 'graduatoria')
  let esito = { scadenze: 0, calendario: false }
  if (graduatorie.length) {
    esito = await creaScadenze(bandoId, graduatorie)
    await supabaseAdmin.from('scadenze_bandi_controllo_novita').update({ scadenze_create: esito.scadenze }).in('id', graduatorie.map(n => n.id))
  }
  return { bandoId, pagine: pagine.length, novita: inserite.length, graduatorie: graduatorie.length, ...esito }
}

/** Controllo di tutti i bandi da controllare, pochi alla volta. */
export async function controllaTuttiIBandi(): Promise<RisultatoBando[]> {
  const ids = await bandiDaControllare()
  const risultati: RisultatoBando[] = []
  const coda = [...ids]
  const lavoratore = async () => {
    while (coda.length) {
      const id = coda.shift()!
      try { risultati.push(await controllaBando(id)) } catch (e) { console.error('[controllo-bandi]', id, e) }
    }
  }
  await Promise.all([lavoratore(), lavoratore(), lavoratore()])
  return risultati
}
