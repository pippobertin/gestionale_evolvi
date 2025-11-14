const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Leggi credenziali
const secretsPath = path.join(__dirname, 'secrets.md');
const secretsContent = fs.readFileSync(secretsPath, 'utf8');

const projectUrlMatch = secretsContent.match(/\*\*Project URL\*\*:\s*(.+)/);
const anonKeyMatch = secretsContent.match(/\*\*Anon Key\*\*:\s*(.+)/);

const supabaseUrl = projectUrlMatch[1].trim();
const supabaseAnonKey = anonKeyMatch[1].trim();

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testDatabase() {
    console.log('🧪 Test operazioni database...\n');

    try {
        // 1. Test lettura bandi
        console.log('📋 Test lettura bandi...');
        const { data: bandi, error: errorBandi } = await supabase
            .from('scadenze_bandi_bandi')
            .select('*');

        if (errorBandi) {
            console.error('❌ Errore lettura bandi:', errorBandi);
            return;
        }

        console.log(`✅ Trovati ${bandi.length} bandi:`, bandi.map(b => b.nome));

        // 2. Test lettura clienti
        console.log('\n👥 Test lettura clienti...');
        const { data: clienti, error: errorClienti } = await supabase
            .from('scadenze_bandi_clienti')
            .select('*');

        if (errorClienti) {
            console.error('❌ Errore lettura clienti:', errorClienti);
            return;
        }

        console.log(`✅ Trovati ${clienti.length} clienti:`, clienti.map(c => c.nome));

        // 3. Test lettura tipologie scadenze
        console.log('\n📅 Test lettura tipologie scadenze...');
        const { data: tipologie, error: errorTipologie } = await supabase
            .from('scadenze_bandi_tipologie_scadenze')
            .select('*')
            .order('ordine_visualizzazione');

        if (errorTipologie) {
            console.error('❌ Errore lettura tipologie:', errorTipologie);
            return;
        }

        console.log(`✅ Trovate ${tipologie.length} tipologie:`, tipologie.map(t => t.nome));

        // 4. Test creazione progetto
        console.log('\n🚀 Test creazione progetto...');
        const nuovoProgetto = {
            bando_id: bandi[0].id,
            cliente_id: clienti[0].id,
            nome_progetto: `${bandi[0].nome} - ${clienti[0].nome}`,
            data_inizio: new Date().toISOString().split('T')[0],
            note: 'Progetto di test'
        };

        const { data: progetto, error: errorProgetto } = await supabase
            .from('scadenze_bandi_progetti')
            .insert(nuovoProgetto)
            .select()
            .single();

        if (errorProgetto) {
            console.error('❌ Errore creazione progetto:', errorProgetto);
            return;
        }

        console.log(`✅ Progetto creato: ${progetto.nome_progetto}`);

        // 5. Test creazione scadenze per il progetto
        console.log('\n⏰ Test creazione scadenze...');
        const scadenzeDaCreare = tipologie.slice(0, 3).map((tipologia, index) => {
            const dataScadenza = new Date();
            dataScadenza.setDate(dataScadenza.getDate() + (index + 1) * 30);

            return {
                progetto_id: progetto.id,
                tipologia_scadenza_id: tipologia.id,
                data_scadenza: dataScadenza.toISOString(),
                priorita: index === 0 ? 'alta' : 'media',
                responsabile_email: 'test@example.com',
                note: `Scadenza di test per ${tipologia.nome}`
            };
        });

        const { data: scadenze, error: errorScadenze } = await supabase
            .from('scadenze_bandi_scadenze')
            .insert(scadenzeDaCreare)
            .select();

        if (errorScadenze) {
            console.error('❌ Errore creazione scadenze:', errorScadenze);
            return;
        }

        console.log(`✅ Create ${scadenze.length} scadenze`);

        // 6. Test vista dashboard
        console.log('\n📊 Test vista dashboard...');
        const { data: dashboard, error: errorDashboard } = await supabase
            .from('scadenze_bandi_dashboard')
            .select('*')
            .limit(5);

        if (errorDashboard) {
            console.error('❌ Errore vista dashboard:', errorDashboard);
            return;
        }

        console.log(`✅ Dashboard con ${dashboard.length} scadenze:`);
        dashboard.forEach(item => {
            console.log(`   - ${item.tipo_scadenza}: ${item.nome_cliente} (${item.giorni_rimanenti} giorni)`);
        });

        // 7. Test funzione scadenze prossime
        console.log('\n🔔 Test funzione scadenze prossime...');
        const { data: prossime, error: errorProssime } = await supabase
            .rpc('get_scadenze_prossime', { giorni_limite: 90 });

        if (errorProssime) {
            console.error('❌ Errore funzione scadenze prossime:', errorProssime);
            return;
        }

        console.log(`✅ Scadenze prossime (90 giorni): ${prossime.length}`);

        // 8. Test update scadenza
        console.log('\n✏️  Test modifica scadenza...');
        const { data: scadenzaAggiornata, error: errorUpdate } = await supabase
            .from('scadenze_bandi_scadenze')
            .update({
                stato: 'in_corso',
                note: 'Scadenza aggiornata durante il test'
            })
            .eq('id', scadenze[0].id)
            .select()
            .single();

        if (errorUpdate) {
            console.error('❌ Errore update scadenza:', errorUpdate);
            return;
        }

        console.log(`✅ Scadenza aggiornata: ${scadenzaAggiornata.stato}`);

        console.log('\n🎉 Tutti i test completati con successo!');
        console.log('\n📋 Riepilogo dati nel database:');
        console.log(`   - ${bandi.length} bandi`);
        console.log(`   - ${clienti.length} clienti`);
        console.log(`   - ${tipologie.length} tipologie scadenze`);
        console.log(`   - 1 progetto di test`);
        console.log(`   - ${scadenze.length} scadenze di test`);

    } catch (error) {
        console.error('❌ Errore durante i test:', error.message);
    }
}

if (require.main === module) {
    testDatabase();
}