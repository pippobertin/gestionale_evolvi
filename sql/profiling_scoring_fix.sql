-- =============================================================================
-- Fix scoring profilazione: punteggi espliciti per opzione + rimozione campi informativi
-- =============================================================================

-- 1. Aggiungere colonna punteggi (array parallelo a opzioni, valori 0-1)
ALTER TABLE scadenze_bandi_profiling_template
ADD COLUMN IF NOT EXISTS punteggi JSONB DEFAULT '[]';

-- 2. Rimuovere dallo scoring i campi puramente informativi (peso = 0)
UPDATE scadenze_bandi_profiling_template SET peso = 0
WHERE domanda = 'Settore di attività principale';

UPDATE scadenze_bandi_profiling_template SET peso = 0
WHERE domanda = 'Canale di acquisizione';

UPDATE scadenze_bandi_profiling_template SET peso = 0
WHERE domanda = 'Note aggiuntive sulla valutazione';

-- 3. Numero dipendenti: curva a campana, picco su 16-50
--    1-5=0.2  6-15=0.7  16-50=1.0  51-250=0.7  >250=0.2
UPDATE scadenze_bandi_profiling_template
SET punteggi = '[0.2, 0.7, 1.0, 0.7, 0.2]'
WHERE domanda = 'Numero dipendenti';

-- 4. Esperienza bandi: sweet spot su 1-2, poi Nessuna, poi decrescente
--    Nessuna=0.6  1-2 bandi=1.0  3-5 bandi=0.3  >5 bandi=0.1
UPDATE scadenze_bandi_profiling_template
SET punteggi = '[0.6, 1.0, 0.3, 0.1]'
WHERE domanda = 'Esperienza con bandi/finanziamenti';
