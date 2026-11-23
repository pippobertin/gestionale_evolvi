/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabaseAdmin } from './supabaseAdmin'

/**
 * Report semestrale all'OdV (modulo M.05). Struttura delle sezioni come nel
 * modulo del consulente, voci precompilate con i dati dei registri del
 * gestionale; le voci senza dati nel gestionale le compila il responsabile.
 */

export type Voce = { chiave: string; etichetta: string; auto: boolean; numero: string; dettaglio: string; nota: string }
export type Sezione = {
  titolo: string; compila: string; nessuna_novita: boolean; voci: Voce[]; testo: string
  confermata_da: string | null; confermata_il: string | null
}
export type Sezioni = Record<string, Sezione>

const V = (chiave: string, etichetta: string, auto = false): Voce => ({ chiave, etichetta, auto, numero: '', dettaglio: '', nota: '' })

export function strutturaReport(): Sezioni {
  const s = (titolo: string, compila: string, voci: Voce[]): Sezione =>
    ({ titolo, compila, nessuna_novita: false, voci, testo: '', confermata_da: null, confermata_il: null })
  return {
    '1': s('Rapporti con PA ed enti finanziatori', 'RAP, RFI, AU', [
      V('contatti_pa', 'Contatti rilevanti annotati (richieste di chiarimento o variazione, esiti, controlli, incontri)', true),
      V('anomalie_pa', 'Anomalie o richieste indebite ricevute'),
      V('controlli', 'Verifiche, controlli o audit ricevuti e relativo esito', true),
      V('stesso_bando', 'Pratiche con più clienti sullo stesso bando e misure adottate', true),
      V('ritardi', 'Scadenze con gli enti superate (integrazioni e rendiconti)', true),
      V('rettifiche', 'Errori rilevati dopo l\'invio e rettifiche', true)
    ]),
    '2': s('Conflitti, omaggi e liberalità', 'AU', [
      V('dichiarazioni', 'Dichiarazioni degli interessi aggiornate o nuove (M.04)', true),
      V('conflitti', 'Conflitti annotati nel Registro dei conflitti', true),
      V('omaggi', 'Omaggi oltre soglia offerti o ricevuti'),
      V('liberalita', 'Sponsorizzazioni ed erogazioni liberali deliberate')
    ]),
    '3': s('Pagamenti e qualifiche', 'AMM, AU', [
      V('pagamenti', 'Pagamenti fuori dall\'ordinario (oltre 5.000 euro, nuovi beneficiari, anticipi, compensi a segnalatori)', true),
      V('qualifiche', 'Schede di qualifica compilate o rinnovate (M.01)', true),
      V('qualifiche_anomalie', 'Schede con anomalie e decisioni dell\'AU', true),
      V('rinnovi_scaduti', 'Rinnovi annuali scaduti e non ancora fatti', true)
    ]),
    '4': s('Sicurezza, privacy e sistemi', 'AU (RSPP), AMM (RLS), RAP (sistemi)', [
      V('infortuni', 'Infortuni e quasi infortuni'),
      V('incidenti', 'Incidenti informatici o violazioni di dati (registro incidenti)'),
      V('esportazioni', 'Esportazioni mensili del gestionale riuscite / previste', true),
      V('backup_workspace', 'Backup di Google Workspace verificati'),
      V('ripristino', 'Prova di ripristino annuale (data ed esito)', true),
      V('personale', 'Ingressi e uscite di personale con checklist completata (M.06)', true),
      V('deleghe', 'Deleghe dei clienti attive e riesami semestrali', true)
    ]),
    '5': s('Formazione e intelligenza artificiale', 'RFI', [
      V('presenze', 'Anomalie su registri presenze e attestati'),
      V('ia', 'Nuovi sviluppi di IA avviati, con scheda di valutazione e verbale di test'),
      V('formazione_231', 'Formazione 231 erogata al personale')
    ]),
    '6': s('Segnalazioni', 'AU', [
      V('segnalazioni', 'Segnalazioni ricevute nel periodo e non già comunicate all\'OdV (senza dati che identifichino il segnalante)')
    ]),
    '7': s('Altro', 'tutti i responsabili', [
      V('deroghe', 'Deroghe decise nel periodo', true)
    ])
  }
}

export function periodoSemestre(anno: number, semestre: 1 | 2) {
  return semestre === 1
    ? { dal: `${anno}-01-01`, al: `${anno}-06-30`, scadenza: `${anno}-07-31` }
    : { dal: `${anno}-07-01`, al: `${anno}-12-31`, scadenza: `${anno + 1}-01-31` }
}

/** Ultimo semestre concluso alla data indicata (AAAA-MM-GG). */
export function semestreConcluso(oggi: string): { anno: number; semestre: 1 | 2 } {
  const anno = Number(oggi.slice(0, 4)), mese = Number(oggi.slice(5, 7))
  return mese >= 7 ? { anno, semestre: 1 } : { anno: anno - 1, semestre: 2 }
}

const it = (d?: string | null) => (d ? d.slice(0, 10).split('-').reverse().join('/') : '')
const euro = (n: number) => n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })
const uno = (x: any) => (Array.isArray(x) ? x[0] : x) || {}
function elenco(righe: string[], max = 15) {
  if (righe.length <= max) return righe.join('\n')
  return [...righe.slice(0, max), `e altri ${righe.length - max}`].join('\n')
}
const TIPO_CONTATTO: Record<string, string> = { richiesta_formale: 'richiesta formale', comunicazione_esito: 'esito', controllo: 'controllo', incontro: 'incontro', altro: 'altro' }

/** Dati del periodo letti dai registri: per ogni voce automatica numero e dettaglio. */
export async function datiAutomatici(dal: string, al: string): Promise<Record<string, { numero: string; dettaglio: string }>> {
  const fine = `${al}T23:59:59.999+01:00`, inizio = `${dal}T00:00:00+01:00`
  const annoFine = Number(al.slice(0, 4))
  const [contatti, conflitti, integrazioni, rendiconti, rettifiche, dichiarazioni, utenti, compensi, qualifiche, tutteQualifiche,
    backup, checklist, deleghe, deroghe, contratti, passaggi] = await Promise.all([
    supabaseAdmin.from('scadenze_bandi_contatti_pa').select('data, ente, tipo, oggetto, esito, scadenze_bandi_progetti(titolo_progetto)').gte('data', dal).lte('data', al).order('data'),
    supabaseAdmin.from('scadenze_bandi_conflitti').select('data, origine, descrizione, misure, decisione').gte('data', dal).lte('data', al).order('data'),
    supabaseAdmin.from('scadenze_bandi_integrazioni').select('oggetto, scadenza, data_invio, segnalato_ritardo_il, scadenze_bandi_progetti(titolo_progetto)').gte('segnalato_ritardo_il', inizio).lte('segnalato_ritardo_il', fine),
    supabaseAdmin.from('scadenze_bandi_rendiconti').select('descrizione, scadenza, data_invio, segnalato_ritardo_il, scadenze_bandi_progetti(titolo_progetto)').gte('segnalato_ritardo_il', inizio).lte('segnalato_ritardo_il', fine),
    supabaseAdmin.from('scadenze_bandi_rettifiche').select('data_rilevazione, errore, modalita, data_rettifica, scadenze_bandi_progetti(titolo_progetto)').gte('data_rilevazione', dal).lte('data_rilevazione', al),
    supabaseAdmin.from('scadenze_bandi_dichiarazioni_interessi').select('utente_id, anno, tipo, esito, dichiarata_il').gte('dichiarata_il', inizio).lte('dichiarata_il', fine),
    supabaseAdmin.from('scadenze_bandi_utenti').select('id, nome, cognome, attivo, livello_permessi, accesso_fino_al'),
    supabaseAdmin.from('scadenze_bandi_compensi_segnalatori').select('importo, pagato_il, pagamento_riferimento, scadenze_bandi_segnalatori(nome)').gte('pagato_il', dal).lte('pagato_il', al),
    supabaseAdmin.from('scadenze_bandi_qualifiche').select('soggetto_tipo, denominazione, esito, anomalia, decisione, compilata_il').gte('compilata_il', dal).lte('compilata_il', al),
    supabaseAdmin.from('scadenze_bandi_qualifiche').select('denominazione, cliente_id, continuativo, compilata_il, scade_il'),
    supabaseAdmin.from('scadenze_bandi_backup_registro').select('tipo, esito, eseguito_il, cosa, note').gte('eseguito_il', inizio).lte('eseguito_il', fine),
    supabaseAdmin.from('scadenze_bandi_checklist_personale').select('tipo, persona, utente_id, completata_il, created_at'),
    supabaseAdmin.from('scadenze_bandi_deleghe').select('piattaforma, valida_al, revocata_il, riesaminata_il, created_at, scadenze_bandi_clienti(denominazione)'),
    supabaseAdmin.from('scadenze_bandi_deroghe').select('data, oggetto, motivazione, decisione').gte('data', dal).lte('data', al),
    supabaseAdmin.from('scadenze_bandi_contract_tracking').select('approvato_il, deroga_approvazione').not('deroga_approvazione', 'is', null).gte('approvato_il', inizio).lte('approvato_il', fine),
    supabaseAdmin.from('scadenze_bandi_pratica_passaggi').select('quando, a_fase, deroga, scadenze_bandi_progetti(titolo_progetto)').not('deroga', 'is', null).gte('quando', inizio).lte('quando', fine)
  ])
  const nomi: Record<string, string> = {}
  for (const u of utenti.data || []) nomi[u.id] = `${u.nome || ''} ${u.cognome || ''}`.trim()
  const r: Record<string, { numero: string; dettaglio: string }> = {}

  // 1. PA ed enti
  const c = contatti.data || []
  r.contatti_pa = { numero: String(c.length), dettaglio: elenco(c.map((x: any) => `${it(x.data)} · ${x.ente || ''} · ${TIPO_CONTATTO[x.tipo] || x.tipo} · ${x.oggetto || ''}${uno(x.scadenze_bandi_progetti).titolo_progetto ? ` (${uno(x.scadenze_bandi_progetti).titolo_progetto})` : ''}`)) }
  const ctrl = c.filter((x: any) => x.tipo === 'controllo')
  r.controlli = { numero: String(ctrl.length), dettaglio: elenco(ctrl.map((x: any) => `${it(x.data)} · ${x.ente || ''} · ${x.oggetto || ''}${x.esito ? ` · esito: ${x.esito}` : ''}`)) }
  const sb = (conflitti.data || []).filter((x: any) => x.origine === 'stesso_bando')
  r.stesso_bando = { numero: String(sb.length), dettaglio: elenco(sb.map((x: any) => `${it(x.data)} · ${x.descrizione}${x.misure ? ` · misure: ${x.misure}` : ''}`)) }
  const rit = [...(integrazioni.data || []).map((x: any) => `Integrazione «${x.oggetto || ''}» (${uno(x.scadenze_bandi_progetti).titolo_progetto || ''}), scadenza ${it(x.scadenza)}${x.data_invio ? `, inviata il ${it(x.data_invio)}` : ', non inviata'}`),
    ...(rendiconti.data || []).map((x: any) => `Rendiconto «${x.descrizione || ''}» (${uno(x.scadenze_bandi_progetti).titolo_progetto || ''}), scadenza ${it(x.scadenza)}${x.data_invio ? `, inviato il ${it(x.data_invio)}` : ', non inviato'}`)]
  r.ritardi = { numero: String(rit.length), dettaglio: elenco(rit) }
  const ret = rettifiche.data || []
  r.rettifiche = { numero: String(ret.length), dettaglio: elenco(ret.map((x: any) => `${it(x.data_rilevazione)} · ${uno(x.scadenze_bandi_progetti).titolo_progetto || ''} · ${x.errore}${x.data_rettifica ? ` · rettificato il ${it(x.data_rettifica)}` : ' · da rettificare'}`)) }

  // 2. Conflitti e interessi
  const dic = dichiarazioni.data || []
  const tenuti = (utenti.data || []).filter((u: any) => u.attivo && u.livello_permessi !== 'odv')
  const conDichiarazione = new Set((await supabaseAdmin.from('scadenze_bandi_dichiarazioni_interessi').select('utente_id').eq('anno', annoFine)).data?.map((x: any) => x.utente_id) || [])
  const mancanti = tenuti.filter((u: any) => !conDichiarazione.has(u.id)).map((u: any) => nomi[u.id])
  const ESITO: Record<string, string> = { nessun_conflitto: 'nessun conflitto', conflitto_annotato: 'conflitto annotato' }
  r.dichiarazioni = {
    numero: String(dic.length),
    dettaglio: [elenco(dic.map((x: any) => `${nomi[x.utente_id] || ''} · ${x.tipo} ${x.anno} · ${x.esito ? ESITO[x.esito] : 'da valutare'}`)),
      mancanti.length ? `Non ancora presentate per il ${annoFine}: ${mancanti.join(', ')}` : ''].filter(Boolean).join('\n')
  }
  const cf = conflitti.data || []
  r.conflitti = { numero: String(cf.length), dettaglio: elenco(cf.map((x: any) => `${it(x.data)} · ${x.descrizione} · ${x.decisione ? `decisione: ${x.decisione}` : 'in attesa della decisione'}`)) }

  // 3. Pagamenti e qualifiche
  const pag = compensi.data || []
  const totale = pag.reduce((t: number, x: any) => t + Number(x.importo || 0), 0)
  r.pagamenti = { numero: String(pag.length), dettaglio: [pag.length ? `Compensi a segnalatori pagati: ${euro(totale)}` : '', elenco(pag.map((x: any) => `${uno(x.scadenze_bandi_segnalatori).nome || ''} · ${euro(Number(x.importo || 0))} · pagato il ${it(x.pagato_il)}${x.pagamento_riferimento ? ` (${x.pagamento_riferimento})` : ''}`))].filter(Boolean).join('\n') }
  const q = qualifiche.data || []
  const perTipo: Record<string, number> = {}
  for (const x of q as any[]) perTipo[x.soggetto_tipo] = (perTipo[x.soggetto_tipo] || 0) + 1
  r.qualifiche = { numero: String(q.length), dettaglio: Object.entries(perTipo).map(([t, n]) => `${t}: ${n}`).join(', ') }
  const DEC: Record<string, string> = { procedere: 'procedere', procedere_cautele: 'procedere con cautele', non_procedere: 'non procedere' }
  const anom = q.filter((x: any) => x.esito === 'anomalia')
  r.qualifiche_anomalie = { numero: String(anom.length), dettaglio: elenco(anom.map((x: any) => `${x.denominazione} · ${x.anomalia || ''} · ${x.decisione ? `AU: ${DEC[x.decisione]}` : 'in attesa dell\'AU'}`)) }
  const tq = (tutteQualifiche.data || []) as any[]
  const scadute = tq.filter(x => x.continuativo && x.scade_il && x.scade_il <= al && !tq.some(y =>
    y !== x && y.compilata_il > x.compilata_il && ((x.cliente_id && y.cliente_id === x.cliente_id) || y.denominazione.trim().toLowerCase() === x.denominazione.trim().toLowerCase())))
  r.rinnovi_scaduti = { numero: String(scadute.length), dettaglio: elenco(scadute.map(x => `${x.denominazione} · scaduta il ${it(x.scade_il)}`)) }

  // 4. Sistemi e personale
  const bk = (backup.data || []) as any[]
  const mesiOk = new Set(bk.filter(x => x.tipo === 'esportazione' && x.esito === 'ok').map(x => String(x.eseguito_il).slice(0, 7)))
  const mesi: string[] = []
  for (let d = new Date(`${dal}T12:00:00Z`); d.toISOString().slice(0, 10) <= al; d.setUTCMonth(d.getUTCMonth() + 1)) mesi.push(d.toISOString().slice(0, 7))
  const mancantiMesi = mesi.filter(m => !mesiOk.has(m))
  r.esportazioni = { numero: `${mesi.length - mancantiMesi.length} / ${mesi.length}`, dettaglio: mancantiMesi.length ? `Mesi senza esportazione riuscita: ${mancantiMesi.map(m => m.split('-').reverse().join('/')).join(', ')}` : 'Esportazione riuscita in ogni mese' }
  const prove = bk.filter(x => x.tipo === 'prova_ripristino')
  r.ripristino = { numero: String(prove.length), dettaglio: prove.length ? elenco(prove.map(x => `${it(x.eseguito_il)} · ${x.esito === 'ok' ? 'riuscita' : x.esito} · ${x.cosa || ''}`)) : 'Nessuna prova di ripristino nel semestre (va fatta almeno una volta l\'anno)' }
  const cl = (checklist.data || []) as any[]
  const fatte = cl.filter(x => x.completata_il && x.completata_il >= inizio && x.completata_il <= fine)
  const aperte = cl.filter(x => !x.completata_il)
  const usciti = (utenti.data || []).filter((u: any) => u.accesso_fino_al && u.accesso_fino_al >= dal && u.accesso_fino_al <= al
    && !cl.some(x => x.tipo === 'uscita' && x.utente_id === u.id && x.completata_il))
  const TIPO_CL: Record<string, string> = { ingresso_interno: 'ingresso', ingresso_esterno: 'ingresso esterno', uscita: 'uscita' }
  r.personale = {
    numero: String(fatte.length),
    dettaglio: [elenco(fatte.map(x => `${x.persona} · ${TIPO_CL[x.tipo]} · completata il ${it(x.completata_il)}`)),
      aperte.length ? `Checklist ancora aperte: ${aperte.map(x => `${x.persona} (${TIPO_CL[x.tipo]})`).join(', ')}` : '',
      usciti.length ? `Accesso terminato nel semestre senza checklist di uscita completata: ${usciti.map((u: any) => nomi[u.id]).join(', ')}` : ''].filter(Boolean).join('\n')
  }
  const dl = (deleghe.data || []) as any[]
  const attive = dl.filter(x => !x.revocata_il && !(x.valida_al && x.valida_al < al))
  const daRiesaminare = attive.filter(x => new Date(x.riesaminata_il || x.created_at).getTime() < new Date(`${al}T00:00:00Z`).getTime() - 182 * 86400000)
  r.deleghe = { numero: String(attive.length), dettaglio: [elenco(attive.map(x => `${uno(x.scadenze_bandi_clienti).denominazione || ''} · ${x.piattaforma}`)), daRiesaminare.length ? `Riesame semestrale da fare: ${daRiesaminare.map(x => `${uno(x.scadenze_bandi_clienti).denominazione || ''} (${x.piattaforma})`).join(', ')}` : ''].filter(Boolean).join('\n') }

  // 7. Deroghe
  const der = [
    ...(deroghe.data || []).map((x: any) => `${it(x.data)} · ${x.oggetto} · ${x.decisione || 'in attesa della decisione'}`),
    ...(contratti.data || []).map((x: any) => `${it(x.approvato_il)} · contratto approvato da chi aveva generato la bozza · ${x.deroga_approvazione}`),
    ...(passaggi.data || []).map((x: any) => `${it(x.quando)} · pratica ${uno(x.scadenze_bandi_progetti).titolo_progetto || ''} passata a ${x.a_fase} in deroga · ${x.deroga}`)
  ]
  r.deroghe = { numero: String(der.length), dettaglio: elenco(der) }
  return r
}

/** Applica i dati automatici alle sezioni non ancora confermate. */
export function applicaDati(sezioni: Sezioni, dati: Record<string, { numero: string; dettaglio: string }>): Sezioni {
  const out: Sezioni = {}
  for (const [k, s] of Object.entries(sezioni)) {
    out[k] = s.confermata_il ? s : { ...s, voci: s.voci.map(v => (v.auto && dati[v.chiave] ? { ...v, ...dati[v.chiave] } : v)) }
  }
  return out
}

/** Crea il report del semestre, se non c'è già. */
export async function creaReport(anno: number, semestre: 1 | 2, utenteId: string | null) {
  const p = periodoSemestre(anno, semestre)
  const sezioni = applicaDati(strutturaReport(), await datiAutomatici(p.dal, p.al))
  return supabaseAdmin.from('scadenze_bandi_report_odv').insert({
    anno, semestre, periodo_dal: p.dal, periodo_al: p.al, scadenza: p.scadenza, sezioni,
    dati_aggiornati_il: new Date().toISOString(), creato_da: utenteId
  }).select('id').single()
}
