# Struttura Collegamenti Database - Sistema Scadenze

## 🔗 Schema Relazioni Attuali

### Percorso principale: SCADENZE → PROGETTI → CLIENTI + BANDI

```
┌─────────────────────┐
│    SCADENZE         │
│ scadenze_bandi_     │
│ scadenze            │
└─────┬───────────────┘
      │ progetto_id (FK)
      │ tipologia_scadenza_id (FK)
      │ cliente_id (FK diretto - NUOVO)
      │
      ▼
┌─────────────────────┐
│    PROGETTI         │
│ scadenze_bandi_     │
│ progetti            │
└─────┬───────┬───────┘
      │       │
      │       └─────────────────────┐
      │ cliente_id (FK)             │ bando_id (FK)
      │                             │
      ▼                             ▼
┌─────────────────────┐      ┌─────────────────────┐
│    CLIENTI          │      │    BANDI            │
│ scadenze_bandi_     │      │ scadenze_bandi_     │
│ clienti             │      │ bandi               │
└─────────────────────┘      └─────────────────────┘
```

## 📊 Collegamento Doppio per i Clienti

### 1. **Collegamento Tradizionale** (via progetti)
```sql
SCADENZE → progetto_id → PROGETTI → cliente_id → CLIENTI
```

### 2. **Collegamento Diretto** (nuovo)
```sql
SCADENZE → cliente_id → CLIENTI
```

## 🎯 Come Funziona nella Vista

Nella vista `scadenze_enhanced_simple`:
```sql
SELECT
    s.*,
    -- Cliente collegato (diretto o tramite progetto)
    c.denominazione as cliente_nome,
    c.email as cliente_email,
    -- Info progetto e bando
    p.id as progetto_collegato_id,
    b.nome as bando_collegato_nome,
    ts.nome as tipo_scadenza_nome
FROM scadenze_bandi_scadenze s
LEFT JOIN scadenze_bandi_progetti p ON s.progetto_id = p.id
LEFT JOIN scadenze_bandi_clienti c ON COALESCE(s.cliente_id, p.cliente_id) = c.id
LEFT JOIN scadenze_bandi_bandi b ON p.bando_id = b.id
LEFT JOIN scadenze_bandi_tipologie_scadenze ts ON s.tipologia_scadenza_id = ts.id;
```

**`COALESCE(s.cliente_id, p.cliente_id)`** = prende prima il cliente diretto, se manca prende quello del progetto.

## 📝 Tipi di Scadenze

Le scadenze hanno anche:
- **tipologia_scadenza_id** → collega a `scadenze_bandi_tipologie_scadenze`
- Tipologie come: "Accettazione", "Rendicontazione", "Inizio Progetto", etc.

## 🔄 Workflow Tipico

1. **Creazione Bando** → `scadenze_bandi_bandi`
2. **Associazione Cliente al Bando** → `scadenze_bandi_progetti` (bando + cliente)
3. **Creazione Scadenze** → `scadenze_bandi_scadenze` (collegate al progetto)
4. **Vista Unificata** → tutte le informazioni insieme

## 💡 Vantaggi del Sistema

- **Flessibilità**: Scadenze possono essere collegate direttamente ai clienti O via progetti
- **Completezza**: Un progetto collega bando+cliente e può avere multiple scadenze
- **Tracciabilità**: Ogni scadenza sa a quale cliente, bando e progetto appartiene
- **Performance**: La vista pre-calcola tutti i join necessari