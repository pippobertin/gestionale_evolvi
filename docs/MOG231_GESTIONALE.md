# Modello 231 e Gestionale Evolvi: che cosa deve fare il gestionale

Analisi del 20/11/2026 sui documenti del consulente (Avv. Antonio Carano): Piano di adeguamento rev. 0 e Parte Speciale rev. 1 del 10/11/2026, Analisi di rischio e Gap Analysis rev. 03 del 3/11/2026, bozza del Codice etico, catalogo dei reati presupposto.

## Il punto di partenza

La Parte Speciale descrive i presidi come regole già vigenti e il Piano di adeguamento avverte che, finché un gap non è chiuso, il relativo presidio non conta ai fini dell'idoneità del Modello. Molti presidi passano dal gestionale, che il Modello rende **strumento obbligatorio**: "schede cliente, scadenze, assegnazione RP/REV e stato delle pratiche sono registrati nel gestionale aziendale; memoria personale e agende individuali non sono strumenti ammessi" (Parte Speciale, principi generali). I gap ad alta priorità vanno chiusi prima dell'adozione, con termine proposto al **31 gennaio 2027**.

Tempi di conservazione indicati dal Modello: almeno **dieci anni** in formato digitale non modificabile (o il maggior termine del bando o della legge); segnalazioni whistleblowing non oltre **cinque anni** dall'esito.

## Che cosa il Modello chiede al gestionale

Legenda stato: **C'è** = già presente; **Parziale** = esiste qualcosa da adattare; **Manca** = da costruire.

### Pratiche di finanza agevolata (PR.01, procedure P01 e P03; gap G05, G06, G10)

| Presidio | Riferimento | Stato |
|---|---|---|
| Scheda primo contatto (cliente, bando, requisiti soggettivi verificati, fonti) | PR.01 §4.1; G05 | Parziale (prospect e prequalifica) |
| Checklist requisiti del bando approvata da RAP (profit) o AU (terzo settore) prima della progettazione | PR.01 §4.1 | Manca |
| Blocco dell'avvio senza incarico firmato; ordine di lavoro per i clienti con accordo quadro | PR.01 §4.1; G05, G10 | Parziale (da oggi si registra il contratto firmato, ma non blocca nulla) |
| Rendicontazione inclusa o esclusa e success fee indicate nel contratto; deroghe approvate per iscritto dall'AU e registrate | PR.01 §4.1; PR.02 §4.3; G10 | Manca |
| Responsabile di pratica (RP) e Revisore (REV) assegnati per ogni pratica, REV diverso da RP | PR.01 §4.1 | Manca |
| Checklist pre-invio compilata e firmata dal REV, archiviata nel fascicolo | PR.01 §4.2 | Manca |
| Conferma scritta del cliente sulla versione finale prima dell'invio | PR.01 §4.2 | Manca |
| Invio solo con delega del cliente registrata nel gestionale; ricevuta archiviata | PR.01 §4.2; PR.03 §4.2; G07 | Manca |
| Richieste di integrazione dell'ente registrate con scadenza e controllo a quattro occhi | PR.01 §4.2 | Parziale (scadenze) |
| Domande di BLM in proprio: RP e REV diversi dall'AU, comunicazione all'OdV prima dell'invio | PR.01 §4.2 | Manca |
| Rendicontazione: dichiarazione del cliente sugli altri contributi (cumulo), checklist firmata da RP e REV | PR.01 §4.3; G06 | Manca |
| Scadenze di rendicontazione inserite alla concessione con **avvisi a 30 e 10 giorni**; mancato rispetto segnalato ad AU e OdV | PR.01 §4.3; G06 | Parziale (scadenze sì, avvisi automatici no: richiedono un'attività pianificata, quindi Vercel Pro) |
| Errori dopo l'invio: rettifica formale, informativa ad AU e OdV | PR.01 §4.3 | Manca (registro) |

### Rapporti con la PA, conflitti e intermediari (PR.02, procedure P02 e P13; gap G21, G25, G26, G12)

| Presidio | Riferimento | Stato |
|---|---|---|
| Contatti informali rilevanti con gli enti annotati nel gestionale (data, interlocutore, contenuto) | PR.02 §4.1; Codice etico; G21 | Parziale (note collegate a clienti, bandi, progetti) |
| Resoconti di incontri, ispezioni e audit, inviati all'AU | PR.02 §4.1 | Manca |
| Elenco dei soggetti autorizzati a interloquire con ciascun ente | PR.02 §4.1 | Manca |
| **Avviso automatico di pratiche aperte sullo stesso bando** e campo nella scheda primo contatto | PR.02 §4.5; G25 punto 1 | Manca |
| RP e REV distinti tra clienti concorrenti sullo stesso bando, eccezioni motivate | PR.02 §4.5; G25 punto 5 | Manca |
| **Permessi distinti per cliente** nel gestionale e su Drive | PR.02 §4.5; G25 punto 6 | Manca (oggi tutti gli utenti vedono tutto) |
| Dichiarazione degli interessi (ingresso e annuale) e Registro dei conflitti | PR.02 §4.4; G25 | Manca |
| Accordi con i segnalatori, attestazione della prestazione prima del pagamento, compensi pagati | PR.02 §4.3; G12 | Parziale (consulenti e segnalazioni) |
| Elenco omaggi, sponsorizzazioni e iniziative | PR.02 §4.2; G26 | Manca |

### Sicurezza informatica e credenziali dei clienti (PR.03, procedura P09; gap G07, G16, G02)

| Presidio | Riferimento | Stato |
|---|---|---|
| **Autenticazione a più fattori sul gestionale** | PR.03 §4.1; G16 | Manca |
| Matrice degli accessi e revoca entro il giorno di cessazione | PR.03 §4.1 | Parziale (disattivazione utente e revoca delle sessioni dal 20/11/2026) |
| Registro delle credenziali e deleghe dei clienti (senza password), riesame semestrale | PR.03 §4.2; G07 | Manca |
| Annotazione di ogni invio sui portali con data, autore e ricevuta | PR.03 §4.2; G07 punto 6 | Manca |
| **Backup giornaliero del gestionale su un sistema indipendente**, 30 giorni, test di ripristino semestrale | PR.03 §4.3; G16 | Manca |
| Registro incidenti | PR.03 §4.3 | Manca |
| Versioni inviate in PDF non modificabile; modifiche successive tracciate e motivate | PR.03 §4.4; G02 | Parziale (PDF su Drive; tracciatura delle modifiche solo sui dati dimensionali) |

### Altri protocolli

| Presidio | Riferimento | Stato |
|---|---|---|
| Qualifica di clienti, partner e segnalatori (titolare effettivo, CreditSafe, liste UE), decisione dell'AU sui casi anomali | PR.06 §4.1; G11 | Manca |
| Benestare alla fattura passiva, anche nel gestionale | PR.07 §4.1; G12 | Manca |
| Fatture attive emesse alle scadenze contrattuali registrate nel gestionale | PR.07 §4.2; G22 | Parziale (scadenze contrattuali; la fatturazione resta nel gestionale collegato allo SDI) |
| Scadenze della formazione obbligatoria sulla sicurezza | PR.05 §4.4 | C'è (certificazioni obbligatorie, corrette il 20/11/2026) |
| Registro delle applicazioni sviluppate; scheda di rischio, **test da un secondo soggetto e approvazione dell'AU prima del rilascio** | PR.09 §4.3; G20 | Manca (riguarda anche il gestionale stesso) |
| Checklist di ingresso e uscita del personale con gestione degli accessi | PR.10 §4.2 | Parziale |
| Flussi periodici verso l'OdV (elenco domande e rendiconti con RP, REV ed esito; deroghe; conflitti; segnalatori; deleghe attive; incidenti) | tutti i protocolli | Manca |

### Da tenere fuori dal gestionale

- **Segnalazioni whistleblowing (PR.12).** Devono arrivare solo all'OdV, con riservatezza garantita. Il gestionale è amministrato da Filippo Bertin, che è anche gestore del canale SGPG: ospitarle lì creerebbe proprio il conflitto che il PR.12 vuole evitare. Serve uno strumento dedicato.
- **Password delle credenziali dei clienti.** Vanno nel password manager con MFA (PR.03 §4.2); nel gestionale solo il registro senza password.
- **Contabilità, fatturazione, home banking, DVR:** restano nei sistemi attuali.

## Questioni da porre al consulente

1. **Il gestionale stesso.** Il Modello lo cita come "gestionale interno sviluppato dal RAP": rientra nel PR.09 §4.3 e nel gap G20 (sviluppo, test e rilascio da parte di una sola persona). Oggi il gestionale è sviluppato con Claude e provato da Filippo prima di ogni pubblicazione: va definito chi è il secondo soggetto che prova e come l'AU approva i rilasci.
2. **Uso di Claude sui dati del gestionale.** Durante lo sviluppo Claude legge dati dei clienti (denominazioni, email, documenti) dal database e da Drive. Il gap G15 rileva l'uso di Claude fuori dall'elenco degli strumenti autorizzati: va inserito nell'allegato del Regolamento IA con l'indicazione dei dati ammessi e degli accordi sul trattamento.
3. **Infrastruttura.** Il database è nel progetto Supabase chiamato "TEST", condiviso con altre otto applicazioni. Per un sistema che conserva le evidenze del Modello per dieci anni conviene un progetto dedicato, con backup indipendente; il piano Hobby di Vercel conserva i log un'ora sola.
4. **Valore delle registrazioni nel gestionale.** Il Modello parla di checklist "firmate, anche digitalmente". Va chiarito se una conferma registrata nel gestionale (utente autenticato, data, ora, registro non modificabile) vale come firma ai fini del Modello, o se serve un PDF firmato digitalmente.
5. **Permessi per cliente.** Il G25 chiede permessi distinti per cliente: va chiarito se basta per i clienti concorrenti sullo stesso bando o se si estende a tutti.

## Collegamento con il lavoro di Stefano

Le procedure P01-P17 sono, di fatto, il disegno dei processi che il documento di Stefano poneva come primo passo: una pratica di finanza agevolata con le sue fasi, i documenti richiesti in ciascuna fase (il "controlla" di Stefano coincide con le checklist del Modello), le deroghe e gli accordi telefonici registrati come documenti tracciati, i dati esposti al cervello aziendale. Conviene trattare i due lavori come uno solo.
