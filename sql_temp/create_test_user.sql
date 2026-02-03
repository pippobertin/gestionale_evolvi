-- Delete existing test user if exists
DELETE FROM scadenze_bandi_utenti WHERE email = 'test@example.com';

-- Create test user with temporary password 'user!'
INSERT INTO scadenze_bandi_utenti (
    email,
    nome,
    cognome,
    password_hash,
    livello_permessi,
    first_login_password_change,
    attivo,
    created_at,
    updated_at
) VALUES (
    'test@example.com',
    'Test',
    'User',
    '$2b$10$h3zohMXfYDshvrV5yjqxVemRBQ3Lb/uimU9q.CPrjmdG0k/z73qsq',
    'collaboratore',
    true,
    true,
    NOW(),
    NOW()
);

-- Verify the user was created
SELECT id, email, nome, cognome, first_login_password_change, created_at
FROM scadenze_bandi_utenti
WHERE email = 'test@example.com';