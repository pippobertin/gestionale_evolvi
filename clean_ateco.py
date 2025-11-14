#!/usr/bin/env python3
import re

# Leggi il file CSV senza numeri di pagina
with open('Struttura-ATECO-2025-clean-no-pages.csv', 'r', encoding='utf-8') as f:
    content = f.read()

# Rimuovi le virgolette e caratteri di controllo
lines = [line.strip().strip('"').strip('\f') for line in content.split('\n')]

# Filtro per creare un CSV pulito
cleaned_lines = []
current_section = ""

for line_num, line in enumerate(lines, 1):
    if not line or line in ['13/03/2025', 'Struttura (codici e titoli) della classificazione delle attività economiche', 'ATECO 2025']:
        continue


    # Sezioni (A, B, C, etc.)
    section_match = re.match(r'^([A-Z])\s+(.+)$', line)
    if section_match:
        section_code, section_desc = section_match.groups()
        current_section = section_code
        cleaned_lines.append(f"SECTION,{section_code},{section_desc.upper()}")
        continue

    # Divisioni (codici a 2 cifre con descrizione valida, gestisce spazi multipli)
    division_match = re.match(r'^(\d{2})\s+(.+)$', line)
    if division_match:
        division_code, division_desc = division_match.groups()
        # Solo se ha una descrizione valida (non solo numeri)
        if division_desc and len(division_desc.strip()) > 3 and not re.match(r'^\d+$', division_desc.strip()):
            cleaned_lines.append(f"DIVISION,{division_code},{division_desc.strip()},{current_section}")
            continue

    # Ignora righe che contengono solo numeri senza descrizione
    if re.match(r'^\d{1,2}$', line):
        continue

    # Altri codici ATECO
    code_match = re.match(r'^(\d+(?:\.\d+)*)\s+(.+)$', line)
    if code_match:
        code, desc = code_match.groups()
        if desc and desc.strip():
            # Determina il livello basato sui punti nel codice
            level = len(code.split('.'))
            if level == 1:  # Divisioni già gestite sopra
                continue
            elif level == 2:  # Gruppi (es. 01.1)
                cleaned_lines.append(f"GROUP,{code},{desc.strip()},{current_section}")
            elif level == 3:  # Classi (es. 01.11)
                cleaned_lines.append(f"CLASS,{code},{desc.strip()},{current_section}")
            elif level == 4:  # Categorie (es. 01.11.0)
                cleaned_lines.append(f"CATEGORY,{code},{desc.strip()},{current_section}")
            elif level == 5:  # Sottocategorie (es. 01.11.00)
                cleaned_lines.append(f"SUBCATEGORY,{code},{desc.strip()},{current_section}")

# Scrivi il file pulito usando pipe separator per evitare problemi con virgole nelle descrizioni
with open('frontend/public/data/ATECO-2025-clean.csv', 'w', encoding='utf-8') as f:
    f.write("type|code|description|section\n")  # Header
    for line in cleaned_lines:
        # Sostituisci le virgole con pipe
        line_with_pipes = line.replace(',', '|')
        f.write(line_with_pipes + "\n")

print(f"CSV pulito creato con {len(cleaned_lines)} righe")

# Stampa statistiche
sections = [l for l in cleaned_lines if l.startswith('SECTION')]
divisions = [l for l in cleaned_lines if l.startswith('DIVISION')]
groups = [l for l in cleaned_lines if l.startswith('GROUP')]
classes = [l for l in cleaned_lines if l.startswith('CLASS')]

print(f"Sezioni: {len(sections)}")
print(f"Divisioni: {len(divisions)}")
print(f"Gruppi: {len(groups)}")
print(f"Classi: {len(classes)}")

