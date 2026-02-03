-- Soluzione temporanea: disabilita RLS per la tabella documenti clienti
-- Questo permetterà l'upload immediato

-- Prima rimuovi tutte le policy esistenti
DROP POLICY IF EXISTS "Users can view client documents" ON scadenze_bandi_clienti_documenti;
DROP POLICY IF EXISTS "Users can insert client documents" ON scadenze_bandi_clienti_documenti;
DROP POLICY IF EXISTS "Users can update client documents" ON scadenze_bandi_clienti_documenti;
DROP POLICY IF EXISTS "Users can delete client documents" ON scadenze_bandi_clienti_documenti;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON scadenze_bandi_clienti_documenti;

-- Disabilita temporaneamente RLS
ALTER TABLE scadenze_bandi_clienti_documenti DISABLE ROW LEVEL SECURITY;

-- Verifica che RLS sia disabilitato
SELECT schemaname, tablename, rowsecurity, forcerowsecurity
FROM pg_tables
WHERE tablename = 'scadenze_bandi_clienti_documenti';