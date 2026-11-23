/**
 * Vista sintetica del registro delle operazioni (fase 4C): frasi in italiano,
 * comprensibili anche a chi non è tecnico (per esempio l'OdV). Le operazioni
 * fatte insieme (stessa transazione, stessa persona) diventano una sola frase.
 */

export type RigaRegistro = {
  id: number
  quando: string
  utente_id: string | null
  utente_nome: string | null
  canale: string
  evento: string
  tabella: string | null
  record_id: string | null
  cliente_id: string | null
  descrizione: string | null
  campi: string[] | null
  prima: Record<string, unknown> | null
  dopo: Record<string, unknown> | null
  esito: string
  dettagli: Record<string, unknown> | null
  transazione?: number | null
}

export type Gruppo = {
  chiave: string
  quando: string
  categoria: 'dati' | 'eliminazione' | 'accesso' | 'sicurezza' | 'email' | 'contratti' | 'sistema'
  frase: string
  righe: RigaRegistro[]
  automatico: boolean
}

const OGGETTI: Record<string, string> = {
  scadenze_bandi_clienti: 'il cliente',
  scadenze_bandi_prospect: 'il prospect',
  scadenze_bandi_progetti: 'il progetto',
  scadenze_bandi_bandi: 'il bando',
  scadenze_bandi_bandi_esterni: 'il bando esterno',
  scadenze_bandi_scadenze: 'la scadenza',
  scadenze_bandi_scadenze_contrattuali: 'la scadenza contrattuale',
  scadenze_bandi_clienti_note: 'la nota',
  scadenze_bandi_note_bandi: 'il collegamento della nota al bando',
  scadenze_bandi_note_progetti: 'il collegamento della nota al progetto',
  scadenze_bandi_clienti_referenti: 'il referente',
  scadenze_bandi_legali_rappresentanti: 'il legale rappresentante',
  scadenze_bandi_contatti: 'il contatto',
  scadenze_bandi_clienti_documenti: 'il documento del cliente',
  scadenze_bandi_documenti_cliente: 'il documento del cliente',
  scadenze_bandi_documenti_amministrativi: 'il documento amministrativo',
  scadenze_bandi_documenti_progetto: 'il documento di progetto',
  scadenze_bandi_documenti: 'il documento del bando',
  scadenze_bandi_documenti_bando: 'il documento del bando',
  scadenze_bandi_documenti_formazione: 'il documento della formazione',
  scadenze_bandi_clienti_esercizi: "l'esercizio di bilancio",
  scadenze_bandi_collegamenti_aziendali: 'il collegamento aziendale',
  scadenze_bandi_contributi_ottenuti: 'il contributo ottenuto',
  scadenze_bandi_contract_tracking: 'il contratto di progetto',
  scadenze_bandi_contratti_evolvi: 'il contratto Metodo Evolvi',
  scadenze_bandi_calendar_events: "l'evento di calendario",
  scadenze_bandi_utenti: "l'utente",
  scadenze_bandi_gruppi_utenti: 'il gruppo di utenti',
  scadenze_bandi_piani_formativi: 'il piano formativo',
  scadenze_bandi_corsi_formativi: 'il corso',
  scadenze_bandi_partecipanti_formazione: 'il partecipante alla formazione',
  scadenze_bandi_certificazioni_obbligatorie: 'la certificazione',
  scadenze_bandi_clienti_adesioni_fpi: "l'adesione al fondo interprofessionale",
  scadenze_bandi_fabbisogno_rilevazioni: 'la rilevazione del fabbisogno',
  scadenze_bandi_clienti_esigenze: "l'esigenza del cliente",
  scadenze_bandi_consulenti_clienti: 'la segnalazione di un cliente',
  scadenze_bandi_responsabili_scadenze: 'il responsabile della scadenza',
  scadenze_bandi_backup_registro: 'la registrazione di backup',
  scadenze_bandi_ordini_lavoro: "l'ordine di lavoro",
  scadenze_bandi_contatti_pa: 'il contatto con la PA',
  scadenze_bandi_pratica_verifiche: 'la verifica della pratica',
  scadenze_bandi_pratica_passaggi: 'il passaggio di fase della pratica',
  scadenze_bandi_integrazioni: "l'integrazione richiesta dalla PA",
  scadenze_bandi_rendiconti: 'il rendiconto',
  scadenze_bandi_rettifiche: 'la rettifica',
  scadenze_bandi_qualifiche: 'la qualifica della controparte',
  scadenze_bandi_dichiarazioni_interessi: 'la dichiarazione degli interessi',
  scadenze_bandi_conflitti: 'il conflitto di interessi',
  scadenze_bandi_deleghe: 'la delega del cliente',
  scadenze_bandi_deleghe_persone: "l'autorizzazione di una persona sulla delega",
  scadenze_bandi_checklist_personale: 'la checklist di ingresso o uscita',
  scadenze_bandi_segnalatori: 'il segnalatore',
  scadenze_bandi_compensi_segnalatori: 'il compenso del segnalatore',
  scadenze_bandi_deroghe: 'la deroga',
  scadenze_bandi_report_odv: "il report semestrale all'OdV",
  scadenze_bandi_email_archiviate: "l'archiviazione di un'email"
}

const CAMPI: Record<string, string> = {
  denominazione: 'denominazione', partita_iva: 'partita IVA', codice_fiscale: 'codice fiscale',
  email: 'email', pec: 'PEC', telefono: 'telefono', indirizzo: 'indirizzo', citta: 'città', cap: 'CAP',
  ula: 'ULA', ultimo_fatturato: 'fatturato', attivo_bilancio: 'attivo di bilancio', fatturato: 'fatturato',
  attivo: 'attivo', esercizio_riferimento: 'esercizio di riferimento', esercizio: 'esercizio', fonte: 'fonte del dato',
  stato: 'stato', note: 'note', descrizione: 'descrizione', titolo: 'titolo', titolo_progetto: 'titolo del progetto',
  nome: 'nome', cognome: 'cognome', nome_bando: 'nome del bando', data_scadenza: 'data di scadenza',
  importo_totale: 'importo totale', importo_contributo: 'importo del contributo', livello_permessi: 'ruolo',
  attivo_utente: 'attivo', accesso_fino_al: 'fine dell\'accesso', password_hash: 'password',
  responsabile_id: 'responsabile', referente_interno: 'referente interno', ateco: 'codice ATECO',
  codice_ateco: 'codice ATECO', contenuto_markdown: 'testo', cliente_id: 'cliente collegato',
  overall_status: 'stato del contratto', signed_contract_received: 'contratto firmato ricevuto',
  fase: 'fase della pratica', rp_id: 'responsabile di pratica', rev_id: 'revisore', pratica_propria: 'domanda di BLM in proprio',
  trasmissione: 'chi trasmette', confermato: 'confermato dal cliente', rendicontazione: 'rendicontazione'
}

function chi(r: RigaRegistro): string {
  if (r.utente_nome) return r.utente_nome
  if (r.canale === 'sistema') return 'Il gestionale (operazione automatica)'
  if (r.canale === 'database') return 'Un intervento diretto sul database'
  return 'Una persona non identificata'
}

function oggetto(r: RigaRegistro): string {
  const tipo = r.tabella ? (OGGETTI[r.tabella] || 'un elemento') : 'un elemento'
  const nome = r.descrizione ? ` «${r.descrizione}»` : ''
  return `${tipo}${nome}`
}

export function etichettaCampoLeggibile(campo: string): string {
  return CAMPI[campo] || campo.replace(/_id$/, '').replace(/_/g, ' ')
}

function elencoCampi(campi: string[] | null): string {
  const visibili = (campi || []).filter(c => !/^(id|created_at|updated_at)$/.test(c))
  if (!visibili.length) return ''
  const nomi = visibili.map(etichettaCampoLeggibile)
  return nomi.length > 5 ? `${nomi.slice(0, 5).join(', ')} e altri ${nomi.length - 5}` : nomi.join(', ')
}

const PRIORITA = ['scadenze_bandi_clienti', 'scadenze_bandi_prospect', 'scadenze_bandi_progetti', 'scadenze_bandi_bandi',
  'scadenze_bandi_contratti_evolvi', 'scadenze_bandi_contract_tracking']

function fraseDati(righe: RigaRegistro[]): { frase: string; categoria: Gruppo['categoria'] } {
  const principale = [...righe].sort((a, b) => {
    const pa = PRIORITA.indexOf(a.tabella || ''), pb = PRIORITA.indexOf(b.tabella || '')
    return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb) || a.id - b.id
  })[0]
  const altri = righe.length - 1
  const extra = altri > 0 ? ` e ${altri} element${altri === 1 ? 'o collegato' : 'i collegati'}` : ''
  const autore = chi(principale)
  switch (principale.evento) {
    case 'inserimento':
      return { frase: `${autore} ha creato ${oggetto(principale)}${extra}`, categoria: 'dati' }
    case 'eliminazione':
      return { frase: `${autore} ha eliminato ${oggetto(principale)}${extra}`, categoria: 'eliminazione' }
    case 'ripristino':
      return { frase: `${autore} ha ripristinato ${oggetto(principale)}${extra}`, categoria: 'dati' }
    default: {
      const campi = elencoCampi(principale.campi)
      return { frase: `${autore} ha modificato ${oggetto(principale)}${campi ? `: ${campi}` : ''}${extra}`, categoria: 'dati' }
    }
  }
}

function fraseEvento(r: RigaRegistro): { frase: string; categoria: Gruppo['categoria'] } {
  const autore = chi(r)
  const d = r.dettagli || {}
  switch (r.evento) {
    case 'accesso':
      return { frase: `Accesso al gestionale${/Google/.test(r.descrizione || '') ? ' con Google' : ''}: ${autore}`, categoria: 'accesso' }
    case 'uscita':
      return { frase: `Uscita dal gestionale: ${autore}`, categoria: 'accesso' }
    case 'accesso_negato': {
      const motivo = (r.descrizione || '').replace(/^Accesso con (password|Google): /, '')
      const tentato = (d.email_inserita || d.email_google) as string | undefined
      return { frase: `Accesso negato${r.utente_nome ? ` a ${r.utente_nome}` : tentato ? ` (${tentato})` : ''}: ${motivo}`, categoria: 'sicurezza' }
    }
    case 'cambio_password':
      return { frase: `${autore} ha cambiato la propria password`, categoria: 'sicurezza' }
    case 'reimpostazione_password':
      return { frase: `${autore}: ${(r.descrizione || 'password temporanea generata').replace(/^Password/, 'password')}`, categoria: 'sicurezza' }
    case 'email_inviata':
      return { frase: `${autore} ha inviato l'email ${(r.descrizione || '').replace(/^Email /, '')}${d.a ? ` a ${d.a}` : ''}`, categoria: 'email' }
    case 'esportazione_registro':
      return { frase: `${autore} ha esportato il registro (${(r.descrizione || '').replace(/^Esportazione del registro: /, '')})`, categoria: 'sicurezza' }
    case 'permesso_negato':
      return { frase: `${autore}: operazione non consentita dal ruolo (${(r.descrizione || '').replace(/^Permesso negato: /, '')})`, categoria: 'sicurezza' }
    case 'deroga_approvazione':
      return { frase: `${autore} ha approvato in deroga: ${r.descrizione || ''}`, categoria: 'contratti' }
    case 'segnalazione_odv':
      return { frase: `Segnalazione all'OdV: ${r.descrizione || ''}`, categoria: 'contratti' }
    case 'documenti_spostati_drive':
      return { frase: `${autore}: ${r.descrizione || 'documenti dei clienti spostati su Google Drive'}`, categoria: 'sistema' }
    case 'permessi_modificati':
      return { frase: `${autore} ha modificato i permessi. ${r.descrizione || ''}`, categoria: 'sicurezza' }
    default:
      return { frase: `${autore}: ${r.descrizione || r.evento}`, categoria: 'sistema' }
  }
}

const EVENTI_DATI = ['inserimento', 'modifica', 'eliminazione', 'ripristino']

/** Raggruppa le righe (già in ordine dalla più recente) e produce le frasi. */
export function raggruppa(righe: RigaRegistro[]): Gruppo[] {
  const gruppi: Gruppo[] = []
  const indice = new Map<string, Gruppo>()
  // Transazioni con un'eliminazione o un ripristino: le modifiche fatte insieme
  // (righe staccate o ricollegate) confluiscono nella stessa frase
  const principali = new Map<string, string>()
  for (const r of righe) {
    if ((r.evento === 'eliminazione' || r.evento === 'ripristino') && r.transazione) {
      const t = `t${r.transazione}:${r.utente_id || r.canale}`
      if (!principali.has(t)) principali.set(t, r.evento)
    }
  }
  for (const r of righe) {
    const dati = EVENTI_DATI.includes(r.evento)
    const base = `t${r.transazione}:${r.utente_id || r.canale}`
    const evento = r.evento === 'modifica' && principali.has(base) ? principali.get(base)! : r.evento
    const chiave = dati && r.transazione ? `${base}:${evento === 'modifica' ? r.id : evento}` : `r${r.id}`
    const esistente = indice.get(chiave)
    if (esistente) {
      esistente.righe.push(r)
      continue
    }
    const nuovo: Gruppo = { chiave, quando: r.quando, categoria: 'sistema', frase: '', righe: [r], automatico: !r.utente_id && dati }
    indice.set(chiave, nuovo)
    gruppi.push(nuovo)
  }
  for (const g of gruppi) {
    const primo = g.righe[0]
    const { frase, categoria } = EVENTI_DATI.includes(primo.evento) ? fraseDati(g.righe) : fraseEvento(primo)
    g.frase = frase
    g.categoria = categoria
  }
  return gruppi
}
