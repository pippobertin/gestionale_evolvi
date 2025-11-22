import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    // Query per ottenere la struttura della tabella scadenze_bandi_clienti
    const { data, error } = await supabase
      .rpc('get_table_columns', {
        table_name_param: 'scadenze_bandi_clienti'
      })

    if (error) {
      // Fallback: prova con una query diretta se la funzione non esiste
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable, column_default')
        .eq('table_name', 'scadenze_bandi_clienti')
        .order('ordinal_position')

      if (fallbackError) {
        // Ultimo fallback: descrivi la struttura in base al TypeScript interface
        return Response.json({
          success: true,
          data: [
            { column_name: 'id', data_type: 'uuid', is_nullable: 'NO' },
            { column_name: 'denominazione', data_type: 'character varying', is_nullable: 'NO' },
            { column_name: 'partita_iva', data_type: 'character varying', is_nullable: 'YES' },
            { column_name: 'codice_fiscale', data_type: 'character varying', is_nullable: 'YES' },
            { column_name: 'email', data_type: 'character varying', is_nullable: 'YES' },
            { column_name: 'pec', data_type: 'character varying', is_nullable: 'YES' },
            { column_name: 'telefono', data_type: 'character varying', is_nullable: 'YES' },
            { column_name: 'dimensione', data_type: 'character varying', is_nullable: 'YES' },
            { column_name: 'ultimo_fatturato', data_type: 'numeric', is_nullable: 'YES' },
            { column_name: 'numero_dipendenti', data_type: 'integer', is_nullable: 'YES' },
            { column_name: 'categoria_evolvi', data_type: 'character varying', is_nullable: 'YES' },
            { column_name: 'scadenza_evolvi', data_type: 'timestamp with time zone', is_nullable: 'YES' },
            { column_name: 'citta_fatturazione', data_type: 'character varying', is_nullable: 'YES' },
            { column_name: 'legale_rappresentante', data_type: 'character varying', is_nullable: 'YES' },
            { column_name: 'created_at', data_type: 'timestamp with time zone', is_nullable: 'NO' },
            { column_name: 'creato_da', data_type: 'character varying', is_nullable: 'YES' },
            // Campi aggiuntivi
            { column_name: 'indirizzo', data_type: 'text', is_nullable: 'YES' },
            { column_name: 'citta', data_type: 'character varying', is_nullable: 'YES' },
            { column_name: 'cap_fatturazione', data_type: 'character varying', is_nullable: 'YES' },
            { column_name: 'provincia', data_type: 'character varying', is_nullable: 'YES' },
            { column_name: 'sito_web', data_type: 'character varying', is_nullable: 'YES' },
            { column_name: 'rea', data_type: 'character varying', is_nullable: 'YES' },
            { column_name: 'ateco_2025', data_type: 'character varying', is_nullable: 'YES' },
            { column_name: 'ateco_descrizione', data_type: 'text', is_nullable: 'YES' },
            { column_name: 'data_costituzione', data_type: 'date', is_nullable: 'YES' },
            { column_name: 'matricola_inps', data_type: 'character varying', is_nullable: 'YES' },
            { column_name: 'pat_inail', data_type: 'character varying', is_nullable: 'YES' },
            { column_name: 'codice_sdi', data_type: 'character varying', is_nullable: 'YES' },
            { column_name: 'iban', data_type: 'character varying', is_nullable: 'YES' },
            { column_name: 'note_cliente', data_type: 'text', is_nullable: 'YES' },
            // Campi mancanti aggiunti
            { column_name: 'estremi_iscrizione_runts', data_type: 'character varying', is_nullable: 'YES' },
            { column_name: 'descrizione', data_type: 'text', is_nullable: 'YES' },
            { column_name: 'ula', data_type: 'integer', is_nullable: 'YES' },
            { column_name: 'attivo_bilancio', data_type: 'numeric', is_nullable: 'YES' },
            { column_name: 'numero_collaboratori', data_type: 'integer', is_nullable: 'YES' },
            // Campi legale rappresentante
            { column_name: 'legale_rappresentante_cognome', data_type: 'character varying', is_nullable: 'YES' },
            { column_name: 'legale_rappresentante_nome', data_type: 'character varying', is_nullable: 'YES' },
            { column_name: 'legale_rappresentante_codice_fiscale', data_type: 'character varying', is_nullable: 'YES' },
            { column_name: 'legale_rappresentante_luogo_nascita', data_type: 'character varying', is_nullable: 'YES' },
            { column_name: 'legale_rappresentante_data_nascita', data_type: 'date', is_nullable: 'YES' },
            { column_name: 'legale_rappresentante_email', data_type: 'character varying', is_nullable: 'YES' },
            { column_name: 'legale_rappresentante_telefono', data_type: 'character varying', is_nullable: 'YES' },
            { column_name: 'legale_rappresentante_indirizzo', data_type: 'character varying', is_nullable: 'YES' },
            { column_name: 'legale_rappresentante_citta', data_type: 'character varying', is_nullable: 'YES' },
            { column_name: 'legale_rappresentante_cap', data_type: 'character varying', is_nullable: 'YES' },
          ]
        })
      }

      return Response.json({
        success: true,
        data: fallbackData
      })
    }

    return Response.json({
      success: true,
      data: data
    })

  } catch (error: any) {
    console.error('Errore lettura struttura tabella:', error)
    return Response.json({
      success: false,
      message: 'Errore nella lettura della struttura della tabella',
      error: error.message
    }, { status: 500 })
  }
}