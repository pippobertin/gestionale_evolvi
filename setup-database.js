const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Leggi credenziali dal file secrets.md
const secretsPath = path.join(__dirname, 'secrets.md');
const secretsContent = fs.readFileSync(secretsPath, 'utf8');

const projectUrlMatch = secretsContent.match(/\*\*Project URL\*\*:\s*(.+)/);
const serviceKeyMatch = secretsContent.match(/\*\*Service Role Key\*\*:\s*(.+)/);

if (!projectUrlMatch || !serviceKeyMatch) {
    console.error('❌ Credenziali non trovate in secrets.md');
    process.exit(1);
}

const supabaseUrl = projectUrlMatch[1].trim();
const supabaseServiceKey = serviceKeyMatch[1].trim();

console.log('🔌 Connessione a Supabase:', supabaseUrl);

// Crea client con service role per operazioni admin
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupDatabase() {
    try {
        console.log('📊 Avvio setup database...');

        // Leggi lo script SQL
        const sqlScript = fs.readFileSync(path.join(__dirname, 'database_setup.sql'), 'utf8');

        // Esegui lo script SQL
        console.log('🔧 Esecuzione script SQL...');
        const { data, error } = await supabase.rpc('exec_sql', { sql: sqlScript });

        if (error) {
            console.error('❌ Errore durante esecuzione SQL:', error);

            // Alternativa: esecuzione comando per comando
            console.log('🔄 Tentativo esecuzione alternativa...');

            // Test connessione base
            const { data: testData, error: testError } = await supabase
                .from('information_schema.tables')
                .select('table_name')
                .limit(1);

            if (testError) {
                console.error('❌ Errore connessione:', testError);
                return false;
            }

            console.log('✅ Connessione Supabase OK');
            console.log('⚠️  Devi eseguire manualmente lo script SQL nel dashboard Supabase');
            console.log('📂 Script disponibile in: database_setup.sql');
            return false;
        }

        console.log('✅ Database setup completato!');
        return true;

    } catch (error) {
        console.error('❌ Errore setup database:', error.message);
        return false;
    }
}

// Funzione per inserire dati di esempio
async function insertSampleData() {
    try {
        console.log('📝 Inserimento dati di esempio...');

        // 1. Inserisci tipologie scadenze
        const tipologieScadenze = [
            {
                nome: 'Data Decreto Concessione',
                descrizione: 'Data del decreto di concessione del bando',
                colore_hex: '#10B981',
                ordine_visualizzazione: 1
            },
            {
                nome: 'Scadenza Accettazione',
                descrizione: 'Scadenza per accettazione del bando',
                colore_hex: '#F59E0B',
                ordine_visualizzazione: 2
            },
            {
                nome: 'Data Inizio Progetto',
                descrizione: 'Data di inizio ufficiale del progetto',
                colore_hex: '#3B82F6',
                ordine_visualizzazione: 3
            },
            {
                nome: 'Scadenza Massima Progetto',
                descrizione: 'Data massima per completamento progetto',
                colore_hex: '#EF4444',
                ordine_visualizzazione: 4
            },
            {
                nome: 'Scadenza Richiesta Anticipo',
                descrizione: 'Scadenza per richiedere anticipo fondi',
                colore_hex: '#8B5CF6',
                ordine_visualizzazione: 5
            },
            {
                nome: 'Scadenza Richiesta Proroga',
                descrizione: 'Scadenza per richiedere proroga progetto',
                colore_hex: '#F97316',
                ordine_visualizzazione: 6
            }
        ];

        const { data: tipologie, error: errorTipologie } = await supabase
            .from('scadenze_bandi_tipologie_scadenze')
            .insert(tipologieScadenze)
            .select();

        if (errorTipologie) {
            console.error('❌ Errore inserimento tipologie:', errorTipologie);
            return false;
        }

        // 2. Inserisci bandi di esempio
        const bandi = [
            {
                nome: 'BANDO TURISMO',
                descrizione: 'Bando per incentivi turismo regionale',
                tipo_bando: 'Turismo',
                stato: 'attivo'
            },
            {
                nome: 'IMPRESE CULTURALI',
                descrizione: 'Supporto alle imprese culturali',
                tipo_bando: 'Cultura',
                stato: 'attivo'
            },
            {
                nome: 'INNOVATION MANAGER',
                descrizione: 'Bando innovation manager e digitalizzazione',
                tipo_bando: 'Innovazione',
                stato: 'attivo'
            }
        ];

        const { data: bandiInseriti, error: errorBandi } = await supabase
            .from('scadenze_bandi_bandi')
            .insert(bandi)
            .select();

        if (errorBandi) {
            console.error('❌ Errore inserimento bandi:', errorBandi);
            return false;
        }

        // 3. Inserisci clienti di esempio
        const clienti = [
            {
                nome: 'CASALE THE GELS',
                email: 'info@casalethegels.it',
                settore: 'Turismo'
            },
            {
                nome: 'TOTIP',
                email: 'admin@totip.it',
                settore: 'Cultura'
            },
            {
                nome: 'MANIVER',
                email: 'contatti@maniver.com',
                settore: 'Manifattura'
            }
        ];

        const { data: clientiInseriti, error: errorClienti } = await supabase
            .from('scadenze_bandi_clienti')
            .insert(clienti)
            .select();

        if (errorClienti) {
            console.error('❌ Errore inserimento clienti:', errorClienti);
            return false;
        }

        console.log('✅ Dati di esempio inseriti con successo!');
        console.log(`📊 Inseriti: ${tipologie.length} tipologie, ${bandiInseriti.length} bandi, ${clientiInseriti.length} clienti`);

        return { tipologie, bandi: bandiInseriti, clienti: clientiInseriti };

    } catch (error) {
        console.error('❌ Errore inserimento dati:', error.message);
        return false;
    }
}

// Esecuzione principale
async function main() {
    console.log('🚀 Inizio setup completo database...\n');

    // const dbSetup = await setupDatabase();
    // if (!dbSetup) {
    //     console.log('\n⚠️  Continua con inserimento dati dopo aver eseguito lo script SQL manualmente');
    // }

    // Test connessione e inserimento dati
    const sampleData = await insertSampleData();

    if (sampleData) {
        console.log('\n🎉 Setup completato con successo!');
        console.log('💡 Ora puoi iniziare a sviluppare il frontend');
    }
}

if (require.main === module) {
    main();
}

module.exports = { supabase, insertSampleData };