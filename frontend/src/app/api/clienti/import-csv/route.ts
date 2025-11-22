import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { csvData, mapping } = await req.json()

    if (!csvData || !Array.isArray(csvData)) {
      return Response.json({
        success: false,
        message: 'Dati CSV non validi'
      }, { status: 400 })
    }

    const importedClients: any[] = []
    const errors: string[] = []
    const skippedReasons: { [key: string]: number } = {
      'empty_denominazione': 0,
      'duplicate_piva': 0,
      'duplicate_name': 0,
      'insert_error': 0
    }

    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i]

      try {
        // Mappa i dati dal CSV alla struttura cliente
        const clienteData = mapCsvToCliente(row, mapping)

        // Salta righe vuote o senza denominazione
        if (!clienteData.denominazione) {
          skippedReasons.empty_denominazione++
          continue
        }

        // Verifica se il cliente esiste già (per P.IVA o denominazione)
        let existingClient = null
        if (clienteData.partita_iva) {
          const { data: existingByPiva } = await supabase
            .from('scadenze_bandi_clienti')
            .select('id, denominazione')
            .eq('partita_iva', clienteData.partita_iva)
            .single()
          existingClient = existingByPiva
        }

        if (!existingClient) {
          const { data: existingByName } = await supabase
            .from('scadenze_bandi_clienti')
            .select('id, denominazione')
            .eq('denominazione', clienteData.denominazione)
            .single()
          existingClient = existingByName
        }

        if (existingClient) {
          if (clienteData.partita_iva) {
            skippedReasons.duplicate_piva++
          } else {
            skippedReasons.duplicate_name++
          }
          console.log(`Cliente già esistente: ${clienteData.denominazione}`)
          continue
        }

        // Aggiungi metadati
        clienteData.creato_da = 'Importazione CSV'
        clienteData.created_at = new Date().toISOString()

        // Inserisci nel database
        const { data: insertedClient, error: insertError } = await supabase
          .from('scadenze_bandi_clienti')
          .insert(clienteData)
          .select()
          .single()

        if (insertError) {
          throw insertError
        }

        importedClients.push({
          ...insertedClient,
          originalRow: i + 1
        })

      } catch (error: any) {
        skippedReasons.insert_error++
        const errorMsg = `Riga ${i + 1}: ${error.message || 'Errore sconosciuto'}`
        console.error(errorMsg, error)
        errors.push(errorMsg)
      }
    }

    const totalSkipped = Object.values(skippedReasons).reduce((a, b) => a + b, 0)

    return Response.json({
      success: true,
      message: `Importazione completata: ${importedClients.length} clienti importati, ${totalSkipped} saltati`,
      data: {
        imported: importedClients.length,
        errors: errors.length,
        skipped: totalSkipped,
        skippedBreakdown: {
          'Righe vuote': skippedReasons.empty_denominazione,
          'Duplicati P.IVA': skippedReasons.duplicate_piva,
          'Duplicati nome': skippedReasons.duplicate_name,
          'Errori inserimento': skippedReasons.insert_error
        },
        errorDetails: errors,
        importedClients: importedClients
      }
    })

  } catch (error: any) {
    console.error('Errore importazione CSV:', error)
    return Response.json({
      success: false,
      message: 'Errore durante l\'importazione CSV',
      error: error.message
    }, { status: 500 })
  }
}

function mapCsvToCliente(row: any, mapping: any): any {
  const cliente: any = {}

  // Usa il mapping personalizzato fornito dal frontend
  for (const [csvColumn, dbColumn] of Object.entries(mapping)) {
    const value = row[csvColumn]
    if (!value || value.trim() === '') continue

    const cleanValue = String(value).trim()

    // Applica trasformazioni specifiche per tipo di campo
    try {
      switch (dbColumn) {
        // Campi numerici
        case 'numero_dipendenti':
        case 'numero_volontari':
        case 'numero_collaboratori':
        case 'durata_evolvi':
        case 'ula':
          const intValue = parseInt(cleanValue.replace(/[.,]/g, ''))
          if (!isNaN(intValue)) {
            cliente[dbColumn] = intValue
          }
          break

        case 'ultimo_fatturato':
        case 'attivo_bilancio':
          // Remove any non-numeric characters except decimal points
          const numericValue = cleanValue.replace(/[^\d.,]/g, '').replace(',', '.')
          const floatValue = parseFloat(numericValue)
          if (!isNaN(floatValue)) {
            cliente[dbColumn] = floatValue
          }
          break

        // Mapping specifici per coordinate bancarie
        case 'coordinate_bancarie':
        case 'iban':
          cliente[dbColumn] = cleanValue
          break

        // Date
        case 'data_costituzione':
        case 'legale_rappresentante_data_nascita':
          // Handle different date formats (dd/mm/yy, dd/mm/yyyy)
          let date: Date | null = null
          if (cleanValue.includes('/')) {
            const parts = cleanValue.split('/')
            if (parts.length === 3) {
              let day = parseInt(parts[0])
              let month = parseInt(parts[1])
              let year = parseInt(parts[2])

              // Convert 2-digit year to 4-digit
              if (year < 100) {
                year += year < 50 ? 2000 : 1900
              }

              date = new Date(year, month - 1, day)
            }
          } else {
            date = new Date(cleanValue)
          }

          if (date && !isNaN(date.getTime())) {
            cliente[dbColumn] = date.toISOString().split('T')[0] // Solo data
          }
          break

        case 'scadenza_evolvi':
        case 'created_at':
          const dateTime = new Date(cleanValue)
          if (!isNaN(dateTime.getTime())) {
            cliente[dbColumn] = dateTime.toISOString() // Data e ora
          }
          break

        // Dimensione (enum)
        case 'dimensione':
          const dimensione = cleanValue.toUpperCase()
          if (['MICRO', 'PICCOLA', 'MEDIA', 'GRANDE'].includes(dimensione)) {
            cliente[dbColumn] = dimensione
          }
          break

        // Categoria Evolvi (mapping speciale)
        case 'categoria_evolvi':
          if (cleanValue.includes('SPOT')) {
            cliente[dbColumn] = 'BASE'
          } else if (cleanValue.includes('PREMIUM')) {
            cliente[dbColumn] = 'PREMIUM'
          } else if (cleanValue.includes('BUSINESS')) {
            cliente[dbColumn] = 'BUSINESS'
          } else if (cleanValue.includes('ENTERPRISE')) {
            cliente[dbColumn] = 'ENTERPRISE'
          } else {
            cliente[dbColumn] = 'BASE'
          }
          break

        // Codice ATECO (split se presente tab)
        case 'ateco_2025':
          const atecoParts = cleanValue.split('\t')
          cliente[dbColumn] = atecoParts[0].trim()
          if (atecoParts.length > 1 && atecoParts[1]) {
            cliente.ateco_descrizione = atecoParts[1].trim()
          }
          break

        // Campi legale rappresentante
        case 'legale_rappresentante_cognome':
        case 'legale_rappresentante_nome':
        case 'legale_rappresentante_codice_fiscale':
        case 'legale_rappresentante_luogo_nascita':
        case 'legale_rappresentante_email':
        case 'legale_rappresentante_telefono':
        case 'legale_rappresentante_indirizzo':
        case 'legale_rappresentante_citta':
        case 'legale_rappresentante_cap':
          cliente[dbColumn] = cleanValue
          break

        // Legale rappresentante (combinazione nome+cognome se disponibile) - campo legacy
        case 'legale_rappresentante':
          // Se la colonna è "Cognome", cerca anche "Nome" nello stesso row
          if (csvColumn === 'Cognome' && row['Nome']) {
            const nome = String(row['Nome']).trim()
            if (nome) {
              cliente[dbColumn] = `${cleanValue} ${nome}`
            } else {
              cliente[dbColumn] = cleanValue
            }
          } else if (csvColumn === 'Nome' && row['Cognome']) {
            const cognome = String(row['Cognome']).trim()
            if (cognome) {
              cliente[dbColumn] = `${cognome} ${cleanValue}`
            } else {
              cliente[dbColumn] = cleanValue
            }
          } else {
            cliente[dbColumn] = cleanValue
          }
          break

        // Campi testo normali
        default:
          cliente[dbColumn] = cleanValue
          break
      }
    } catch (e) {
      // Se c'è un errore nella trasformazione, salta questo campo
      console.warn(`Errore trasformazione campo ${dbColumn}:`, e)
    }
  }

  return cliente
}