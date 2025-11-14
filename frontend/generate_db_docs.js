/**
 * Script per generare la documentazione completa del database
 * Esegue tutte le query di struttura e salva i risultati in un file markdown
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configura Supabase (usa le stesse credenziali del progetto)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Errore: Variabili ambiente Supabase non trovate');
    console.log('Assicurati di avere NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nel file .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function generateDatabaseDocs() {
    console.log('🔍 Generando documentazione database...');

    let markdown = `# Database Structure Documentation
*Generato automaticamente il ${new Date().toLocaleString('it-IT')}*

## Panoramica
Questa documentazione contiene la struttura completa delle tabelle con prefisso \`scadenze_bandi_\`.

---

`;

    try {
        // 1. Lista tabelle
        console.log('📋 Caricando lista tabelle...');
        const { data: tables, error: tablesError } = await supabase
            .from('information_schema.tables')
            .select('table_name')
            .like('table_name', 'scadenze_bandi_%')
            .order('table_name');

        if (tablesError) {
            console.log('⚠️  Usando query diretta per le tabelle...');
            const { data: tablesRaw } = await supabase.rpc('exec_sql', {
                query: `
                    SELECT tablename as table_name
                    FROM pg_tables
                    WHERE tablename LIKE 'scadenze_bandi_%'
                    ORDER BY tablename
                `
            });
            tables = tablesRaw || [];
        }

        if (tables && tables.length > 0) {
            markdown += `## 📋 Tabelle del Sistema (${tables.length})\n\n`;
            tables.forEach(table => {
                markdown += `- \`${table.table_name}\`\n`;
            });
            markdown += '\n---\n\n';
        }

        // 2. Struttura dettagliata per ogni tabella
        console.log('🔧 Caricando struttura dettagliata...');

        for (const table of tables || []) {
            markdown += `## 🗂️ Tabella: \`${table.table_name}\`\n\n`;

            try {
                // Query per la struttura della tabella
                const { data: columns, error: columnsError } = await supabase.rpc('exec_sql', {
                    query: `
                        SELECT
                            column_name,
                            data_type,
                            is_nullable,
                            column_default,
                            character_maximum_length,
                            numeric_precision
                        FROM information_schema.columns
                        WHERE table_name = '${table.table_name}'
                        ORDER BY ordinal_position
                    `
                });

                if (columns && columns.length > 0) {
                    markdown += `### Struttura Colonne\n\n`;
                    markdown += `| Nome Colonna | Tipo | Nullable | Default | Lunghezza |\n`;
                    markdown += `|--------------|------|----------|---------|----------|\n`;

                    columns.forEach(col => {
                        const type = col.character_maximum_length ?
                            `${col.data_type}(${col.character_maximum_length})` :
                            col.data_type;
                        const nullable = col.is_nullable === 'YES' ? '✅' : '❌';
                        const defaultVal = col.column_default || '-';
                        const maxLength = col.character_maximum_length || '-';

                        markdown += `| \`${col.column_name}\` | ${type} | ${nullable} | ${defaultVal} | ${maxLength} |\n`;
                    });
                    markdown += '\n';
                }

                // Query esempio di dati (primi 3 record)
                const { data: sampleData, error: sampleError } = await supabase
                    .from(table.table_name)
                    .select('*')
                    .limit(3);

                if (sampleData && sampleData.length > 0) {
                    markdown += `### Esempio Dati (primi ${sampleData.length} record)\n\n`;
                    markdown += '```json\n';
                    markdown += JSON.stringify(sampleData, null, 2);
                    markdown += '\n```\n\n';
                }

            } catch (tableError) {
                markdown += `❌ Errore nel caricamento della struttura: ${tableError.message}\n\n`;
            }

            markdown += '---\n\n';
        }

        // 3. Views
        console.log('👁️  Caricando views...');
        try {
            const { data: views } = await supabase.rpc('exec_sql', {
                query: `
                    SELECT viewname, definition
                    FROM pg_views
                    WHERE viewname LIKE 'scadenze_bandi_%'
                    ORDER BY viewname
                `
            });

            if (views && views.length > 0) {
                markdown += `## 👁️ Views del Sistema (${views.length})\n\n`;
                views.forEach(view => {
                    markdown += `### \`${view.viewname}\`\n\n`;
                    markdown += '```sql\n';
                    markdown += view.definition;
                    markdown += '\n```\n\n';
                });
                markdown += '---\n\n';
            }
        } catch (viewError) {
            markdown += `❌ Errore nel caricamento views: ${viewError.message}\n\n`;
        }

        // Salva il file
        const outputPath = path.join(__dirname, 'DATABASE_STRUCTURE.md');
        fs.writeFileSync(outputPath, markdown, 'utf8');

        console.log(`✅ Documentazione generata con successo!`);
        console.log(`📄 File salvato: ${outputPath}`);
        console.log(`📊 Tabelle documentate: ${tables?.length || 0}`);

    } catch (error) {
        console.error('❌ Errore nella generazione:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Esegui solo se chiamato direttamente
if (require.main === module) {
    generateDatabaseDocs().catch(console.error);
}

module.exports = { generateDatabaseDocs };