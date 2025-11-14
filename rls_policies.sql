-- Row Level Security Policies per Gestione Scadenze Bandi
-- Da eseguire nel SQL Editor di Supabase

-- Abilitare RLS su tutte le tabelle
ALTER TABLE scadenze_bandi_bandi ENABLE ROW LEVEL SECURITY;
ALTER TABLE scadenze_bandi_clienti ENABLE ROW LEVEL SECURITY;
ALTER TABLE scadenze_bandi_tipologie_scadenze ENABLE ROW LEVEL SECURITY;
ALTER TABLE scadenze_bandi_progetti ENABLE ROW LEVEL SECURITY;
ALTER TABLE scadenze_bandi_scadenze ENABLE ROW LEVEL SECURITY;

-- Policies per la tabella bandi
-- Gli utenti autenticati possono vedere e modificare tutti i bandi
CREATE POLICY "Utenti autenticati possono vedere tutti i bandi"
ON scadenze_bandi_bandi FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Utenti autenticati possono inserire bandi"
ON scadenze_bandi_bandi FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Utenti autenticati possono aggiornare bandi"
ON scadenze_bandi_bandi FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Utenti autenticati possono eliminare bandi"
ON scadenze_bandi_bandi FOR DELETE
TO authenticated
USING (true);

-- Policies per la tabella clienti
CREATE POLICY "Utenti autenticati possono vedere tutti i clienti"
ON scadenze_bandi_clienti FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Utenti autenticati possono inserire clienti"
ON scadenze_bandi_clienti FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Utenti autenticati possono aggiornare clienti"
ON scadenze_bandi_clienti FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Utenti autenticati possono eliminare clienti"
ON scadenze_bandi_clienti FOR DELETE
TO authenticated
USING (true);

-- Policies per tipologie scadenze (template condivisi)
CREATE POLICY "Utenti autenticati possono vedere tipologie scadenze"
ON scadenze_bandi_tipologie_scadenze FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Utenti autenticati possono inserire tipologie scadenze"
ON scadenze_bandi_tipologie_scadenze FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Utenti autenticati possono aggiornare tipologie scadenze"
ON scadenze_bandi_tipologie_scadenze FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Utenti autenticati possono eliminare tipologie scadenze"
ON scadenze_bandi_tipologie_scadenze FOR DELETE
TO authenticated
USING (true);

-- Policies per progetti
CREATE POLICY "Utenti autenticati possono vedere tutti i progetti"
ON scadenze_bandi_progetti FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Utenti autenticati possono inserire progetti"
ON scadenze_bandi_progetti FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Utenti autenticati possono aggiornare progetti"
ON scadenze_bandi_progetti FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Utenti autenticati possono eliminare progetti"
ON scadenze_bandi_progetti FOR DELETE
TO authenticated
USING (true);

-- Policies per scadenze
CREATE POLICY "Utenti autenticati possono vedere tutte le scadenze"
ON scadenze_bandi_scadenze FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Utenti autenticati possono inserire scadenze"
ON scadenze_bandi_scadenze FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Utenti autenticati possono aggiornare scadenze"
ON scadenze_bandi_scadenze FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Utenti autenticati possono eliminare scadenze"
ON scadenze_bandi_scadenze FOR DELETE
TO authenticated
USING (true);

-- Policy per la vista dashboard (lettura)
-- Nota: Le viste ereditano automaticamente le policies delle tabelle sottostanti

-- Funzioni helper per controllo permessi (per future estensioni)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Per ora tutti gli utenti autenticati sono considerati admin
  -- In futuro si può implementare un sistema di ruoli più granulare
  RETURN auth.role() = 'authenticated';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policy per accesso anonimo (solo lettura tipologie scadenze)
-- Utile per form pubblici o preview
CREATE POLICY "Accesso anonimo lettura tipologie"
ON scadenze_bandi_tipologie_scadenze FOR SELECT
TO anon
USING (true);

-- Commenti per documentazione
COMMENT ON POLICY "Utenti autenticati possono vedere tutti i bandi" ON scadenze_bandi_bandi IS
'Permette a tutti gli utenti autenticati di visualizzare i bandi. In futuro si può restringere per organizzazione.';

COMMENT ON POLICY "Accesso anonimo lettura tipologie" ON scadenze_bandi_tipologie_scadenze IS
'Permette accesso pubblico in sola lettura alle tipologie di scadenze per form pubblici.';

-- Trigger per audit trail (opzionale per il futuro)
-- Per tracciare chi ha modificato cosa e quando

-- Grant permissions per funzioni
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION get_scadenze_prossime(INTEGER) TO authenticated;