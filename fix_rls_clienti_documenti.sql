-- Fix RLS policies per la tabella scadenze_bandi_clienti_documenti

-- Prima abilita RLS se non è già abilitato
ALTER TABLE scadenze_bandi_clienti_documenti ENABLE ROW LEVEL SECURITY;

-- Aggiungi policy per SELECT (lettura)
CREATE POLICY "Users can view client documents"
ON scadenze_bandi_clienti_documenti
FOR SELECT
USING (auth.role() = 'authenticated');

-- Aggiungi policy per INSERT (inserimento)
CREATE POLICY "Users can insert client documents"
ON scadenze_bandi_clienti_documenti
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Aggiungi policy per UPDATE (aggiornamento)
CREATE POLICY "Users can update client documents"
ON scadenze_bandi_clienti_documenti
FOR UPDATE
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Aggiungi policy per DELETE (eliminazione)
CREATE POLICY "Users can delete client documents"
ON scadenze_bandi_clienti_documenti
FOR DELETE
USING (auth.role() = 'authenticated');

-- Verifica che le policy siano state create
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'scadenze_bandi_clienti_documenti';