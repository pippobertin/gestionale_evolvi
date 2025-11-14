import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const structure = {
      timestamp: new Date().toISOString(),
      tables: {},
      errors: []
    }

    // Lista delle tabelle da controllare
    const tableQueries = [
      'scadenze_bandi_bandi',
      'scadenze_bandi_clienti',
      'scadenze_bandi_progetti',
      'scadenze_bandi_scadenze',
      'scadenze_bandi_template_scadenze',
      'scadenze_bandi_documenti_progetto',
      'scadenze_bandi_documenti_progetto_view'
    ]

    for (const tableName of tableQueries) {
      try {
        console.log(`🔍 Analizzando tabella: ${tableName}`)

        // Prova a ottenere la struttura facendo una query vuota
        const { data, error, count } = await supabase
          .from(tableName)
          .select('*', { count: 'exact' })
          .limit(1)

        if (error) {
          structure.errors.push(`❌ ${tableName}: ${error.message}`)
          console.error(`Errore su ${tableName}:`, error)
          continue
        }

        // Analizza la struttura dal primo record (se esiste)
        const columns = {}
        if (data && data.length > 0) {
          const firstRecord = data[0]
          Object.keys(firstRecord).forEach(key => {
            const value = firstRecord[key]
            columns[key] = {
              type: typeof value,
              sample_value: value,
              sql_type: 'unknown' // Non possiamo determinare il tipo SQL esatto
            }
          })
        }

        structure.tables[tableName] = {
          exists: true,
          row_count: count || 0,
          columns: columns,
          sample_data: data ? data.slice(0, 2) : [] // Primi 2 record come esempio
        }

        console.log(`✅ ${tableName}: ${count || 0} records`)

      } catch (tableError) {
        structure.errors.push(`❌ ${tableName}: ${tableError.message}`)
        console.error(`Errore tabella ${tableName}:`, tableError)
      }
    }

    return NextResponse.json(structure)

  } catch (error) {
    console.error('❌ Errore generale:', error)
    return NextResponse.json({
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}