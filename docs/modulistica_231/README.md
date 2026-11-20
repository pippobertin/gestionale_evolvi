# Modulistica 231 di BLMProject

Bozze rev. 0 del 20/11/2026, preparate sulla base delle risposte del consulente (documento «Risposte a Chiara»), da sottoporre alla sua revisione. Ogni modulo sta in una pagina; le versioni Word, da inviare al consulente o da stampare, sono nella cartella `docx`.

| Modulo | Titolo | Chi lo compila | Quando |
|--------|------------------------------|--------------------------------|------------------------------|
| M.01 | Scheda di qualifica della controparte | chi apre il rapporto, con decisione dell'AU sulle anomalie | prima del contratto; ogni 12 mesi per i rapporti continuativi |
| M.02 | DSAN di onorabilità e assenza di conflitti | professionisti, docenti, segnalatori | all'avvio del rapporto e a ogni variazione |
| M.03 | Clausola 231 e clausole collegate | si inserisce nei contratti | in ogni nuovo contratto o incarico |
| M.04 | Dichiarazione degli interessi | ogni Destinatario | all'ingresso, ogni anno entro il 31 gennaio, a ogni variazione |
| M.05 | Report semestrale all'OdV | responsabili di funzione, raccolto dall'AU | entro il 31 luglio e il 31 gennaio |
| M.06 | Checklist di ingresso e di uscita | responsabile della persona | all'ingresso e il giorno dell'uscita |

I testi di M.02 e M.03 sono quelli del consulente, impaginati senza modifiche di sostanza. M.01, M.04, M.05 e M.06 seguono i contenuti minimi che il consulente ha indicato; le scelte aggiunte sono queste e vanno confermate con lui:

- M.01: verifica della partita IVA anche tramite VIES e ricerca di notizie pubbliche con parole chiave indicative;
- M.04: parentela fino al secondo grado, scadenza annuale al 31 gennaio (in linea con il report semestrale), soglia omaggi di 150 euro presa da PR.02 § 4.2;
- M.05: conteggio delle esportazioni mensili del gestionale e voce sui rinnovi delle qualifiche scaduti;
- M.06: data di fine accesso al gestionale per tirocinanti ed esterni.

Ogni modulo indica come diventerà una funzione del gestionale (vedi `docs/MOG231_GESTIONALE.md`).

Per rigenerare le versioni Word dopo una modifica ai testi (serve pandoc):

```bash
cd docs/modulistica_231 && for f in M0*.md; do pandoc "$f" --reference-doc=docx/stile_riferimento.docx -o "docx/${f%.md}.docx"; done
```
