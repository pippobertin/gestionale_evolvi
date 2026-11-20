"""Genera MODELLO ORDINE DI LAVORO.docx (segnaposto [[...]] come i contratti del gestionale).
Ogni segnaposto sta in un unico run, come richiede docxtemplater."""
import sys
from docx import Document
from docx.shared import Pt, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH

d = Document()
for s in d.sections:
    s.top_margin = s.bottom_margin = Cm(2)
    s.left_margin = s.right_margin = Cm(2.2)
st = d.styles['Normal']; st.font.name = 'Calibri'; st.font.size = Pt(10.5)

def p(testo='', grassetto=False, centro=False, spazio=4, dim=None):
    par = d.add_paragraph()
    if centro: par.alignment = WD_ALIGN_PARAGRAPH.CENTER
    par.paragraph_format.space_after = Pt(spazio)
    # testo con segnaposto: ogni [[...]] in un run separato
    import re
    for pezzo in re.split(r'(\[\[[A-Za-z]+\]\])', testo):
        if not pezzo: continue
        r = par.add_run(pezzo); r.bold = grassetto
        if dim: r.font.size = Pt(dim)
    return par

def titolo(t):
    p(t, grassetto=True, spazio=2)

p('BLMProject S.r.l.', grassetto=True, dim=13)
p('Via Marina, 1/g, 60018 Montemarciano (AN) · P.IVA 02652950425 · info@blmproject.com · blmproject@pec.it', dim=9, spazio=14)
p('ORDINE DI LAVORO n. [[NumeroOrdine]]', grassetto=True, centro=True, dim=13, spazio=2)
p('in esecuzione dell\'Accordo Quadro n. [[NumeroAccordo]] del [[DataAccordo]]', centro=True, spazio=14)

p('Tra la [[Denominazione]], codice fiscale e partita IVA [[PartitaIVA]], con sede in [[Citta]] ([[Provincia]]), [[Indirizzo]], nella persona del legale rappresentante pro tempore (di seguito Mandante), e BLMProject S.r.l. (di seguito Mandataria), ai sensi dell\'art. 3.1 dell\'Accordo Quadro, si conviene quanto segue.', spazio=10)

titolo('1. Bando e progetto')
p('Bando o misura: [[NomeBando]] ([[EnteErogatore]]).')
p('Progetto: [[TitoloProgetto]], codice [[CodiceProgetto]].', spazio=8)

titolo('2. Attività affidate')
p('La Mandante affida alla Mandataria la progettazione e la predisposizione della domanda di cui all\'art. 1.1 lett. g) dell\'Accordo Quadro. Attività ulteriori: [[Attivita]].', spazio=8)

titolo('3. Rendicontazione')
p('[[Rendicontazione]]', spazio=8)

titolo('4. Premio di successo')
p('Il premio di successo è dovuto secondo l\'art. 7.2 dell\'Accordo Quadro. Condizioni specifiche per questo ordine: [[SuccessFee]]. Eventuali deroghe ai tempi di pagamento sono valide solo se approvate per iscritto dall\'Amministratrice Unica della Mandataria.', spazio=8)

titolo('5. Versione finale e invio della domanda')
p('La domanda è trasmessa solo dopo che la Mandante ha confermato per iscritto (e-mail o PEC) di aver letto e approvato la versione finale; la sola firma degli allegati non è sufficiente. Se la trasmissione è effettuata dalla Mandataria, avviene sulla base di delega o procura scritta della Mandante; nessuno utilizza credenziali, SPID o codici OTP intestati ad altri.', spazio=8)

titolo('6. Trasparenza')
p('La Mandante prende atto che la Mandataria presta la propria attività anche a favore di altri soggetti interessati al medesimo bando o avviso, e vi acconsente; l\'identità di tali soggetti non è comunicata. La Mandataria garantisce: (a) la riservatezza reciproca delle informazioni, dei dati e dei documenti di ciascun cliente, che non sono comunicati né utilizzati a favore di altri; (b) la gestione separata della documentazione di ciascuna pratica; (c) il divieto di riutilizzare testi, dati e contenuti elaborati per la Mandante in favore di altri clienti; (d) parità di trattamento e uguale impegno professionale per tutti i clienti; (e) la revisione di ciascuna pratica da parte di un soggetto non coinvolto nelle altre pratiche sul medesimo bando, quando le dimensioni della struttura lo consentono. La Mandataria non assume obblighi di esclusiva.', spazio=8)

titolo('7. Modello 231')
p('La Mandante dichiara di aver preso visione del Codice etico e della parte rilevante del Modello di organizzazione, gestione e controllo ex D.Lgs. 231/2001 di BLMProject S.r.l., messi a sua disposizione su richiesta, e si impegna a rispettarli nell\'esecuzione del presente ordine e a fornire documentazione veritiera e completa, nonché a non porre in essere condotte che possano integrare reati presupposto. In caso di violazione di tali obblighi, la Mandataria può risolvere il presente ordine con comunicazione scritta ai sensi dell\'art. 1456 c.c., salvo il risarcimento del danno.', spazio=8)

titolo('8. Rinvio')
p('Per quanto non previsto valgono le condizioni dell\'Accordo Quadro. L\'ordine si intende accettato anche con conferma della Mandante via e-mail o PEC.', spazio=14)

p('[[Citta]], lì [[DataOrdine]]', spazio=18)
t = d.add_table(rows=2, cols=2)
t.cell(0,0).text = 'la Mandante'; t.cell(0,1).text = 'la Mandataria (BLMProject S.r.l.)'
t.cell(1,0).text = '\n\n______________________'; t.cell(1,1).text = '\n\n______________________'
d.save(sys.argv[1])
