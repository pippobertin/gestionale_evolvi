#!/usr/bin/env python3
import csv
import re

def escape_sql_string(text):
    """Escape string for SQL, handling all problematic characters"""
    if not text:
        return ''

    # Replace single quotes with double single quotes for SQL
    text = text.replace("'", "''")

    # Remove any control characters that might cause issues
    text = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', text)

    # Trim whitespace
    text = text.strip()

    return text

# Legge il CSV pulito e genera gli INSERT SQL
with open('frontend/public/data/ATECO-2025-clean.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f, delimiter='|')

    # Prima raccoglie tutti i record in liste separate per livello
    records_by_level = {1: [], 2: [], 3: [], 4: [], 5: [], 6: []}

    for row in reader:
        tipo = row['type'].strip()
        codice = escape_sql_string(row['code'])
        descrizione = escape_sql_string(row['description'])
        sezione = escape_sql_string(row['section'])

        # Salta righe con dati mancanti
        if not codice or not descrizione or not tipo:
            continue

        # Determina il livello basato sul tipo
        livello_map = {
            'SECTION': 1,      # A, B, C, ecc.
            'DIVISION': 2,     # 01, 02, ecc.
            'GROUP': 3,        # 01.1, 01.2, ecc.
            'CLASS': 4,        # 01.11, 01.12, ecc.
            'CATEGORY': 5,     # 01.11.0, ecc.
            'SUBCATEGORY': 6   # 01.11.00, ecc.
        }

        livello = livello_map.get(tipo, 1)

        # Determina il codice padre in base alla gerarchia
        codice_padre = None
        if livello > 1:
            # Per le divisioni (01, 02, etc), il padre è la sezione (A, B, C)
            if livello == 2:
                codice_padre = sezione if sezione and len(sezione.strip()) == 1 else None
            # Per gli altri livelli, trova il padre rimuovendo l'ultima parte
            elif '.' in codice:
                parti = codice.split('.')
                if len(parti) > 1:
                    codice_padre = '.'.join(parti[:-1])
            else:
                # Gruppi senza punto (rari)
                codice_padre = codice[:2] if len(codice) > 2 else None

        # Note con il tipo originale per riferimento
        note = f"Tipo: {tipo}"
        if sezione and sezione.strip():
            note += f", Sezione: {sezione}"

        # Aggiungi il record alla lista del livello appropriato
        records_by_level[livello].append({
            'codice': codice,
            'descrizione': descrizione,
            'livello': livello,
            'codice_padre': codice_padre,
            'note': note
        })

    # Ora genera gli INSERT in ordine di livello (1 -> 6)
    inserts = []
    inserts.append("-- Popola la tabella scadenze_bandi_ateco_2025 con i dati ATECO 2025 puliti")
    inserts.append("DELETE FROM scadenze_bandi_ateco_2025;")
    inserts.append("")

    for livello in [1, 2, 3, 4, 5, 6]:
        if records_by_level[livello]:
            inserts.append(f"-- Livello {livello}")
            for record in records_by_level[livello]:
                codice_padre_val = f"'{record['codice_padre']}'" if record['codice_padre'] else 'NULL'
                insert = f"INSERT INTO scadenze_bandi_ateco_2025 (codice, descrizione, livello, codice_padre, note) VALUES ('{record['codice']}', '{record['descrizione']}', {record['livello']}, {codice_padre_val}, '{record['note']}');"
                inserts.append(insert)
            inserts.append("")

# Scrivi il file SQL
with open('populate_ateco_2025_complete.sql', 'w', encoding='utf-8') as f:
    f.write('\n'.join(inserts))

print(f"Generati {len(inserts)-4} INSERT SQL in populate_ateco_2025_complete.sql")