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
      'invalid_text': 0,
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

        // Salta righe che non sembrano aziende valide
        const denominazione = clienteData.denominazione.toLowerCase().trim()

        // Skip se la denominazione è troppo lunga (probabilmente una descrizione)
        if (denominazione.length > 100) {
          skippedReasons.invalid_text++
          console.log(`Riga ${i + 1}: Saltato testo troppo lungo: ${clienteData.denominazione.substring(0, 50)}...`)
          continue
        }

        // Skip se contiene parole che indicano che non è un'azienda
        const skipKeywords = [
          'un grande punto di forza',
          'le informazioni contenute',
          'circa l\'85%',
          'in francia e spagna',
          'giornalista',
          'responsabile',
          'segretaria',
          'consulente',
          'attendiamo copia',
          'come concordato',
          '347.910',
          'bertin@blm',
          '_____'
        ]

        if (skipKeywords.some(keyword => denominazione.includes(keyword))) {
          skippedReasons.invalid_text++
          console.log(`Riga ${i + 1}: Saltato testo non valido: ${clienteData.denominazione}`)
          continue
        }

        // Verifica se il cliente esiste già (SOLO per P.IVA se presente)
        let existingClient = null
        if (clienteData.partita_iva && clienteData.partita_iva.length > 0) {
          const { data: existingByPiva } = await supabase
            .from('scadenze_bandi_clienti')
            .select('id, denominazione')
            .eq('partita_iva', clienteData.partita_iva)
            .single()
          existingClient = existingByPiva
        }

        if (existingClient) {
          skippedReasons.duplicate_piva++
          console.log(`Cliente già esistente (P.IVA: ${clienteData.partita_iva}): ${clienteData.denominazione}`)
          continue
        }

        // Debug logging per aziende specifiche
        if (clienteData.denominazione && clienteData.denominazione.includes('365')) {
          console.log(`DEBUG - Importando 365: P.IVA=${clienteData.partita_iva}, Nome=${clienteData.denominazione}`)
        }

        // Aggiungi metadati
        clienteData.creato_da = 'Importazione CSV'
        clienteData.created_at = new Date().toISOString()

        // ATECO saltato temporaneamente per evitare errori FK

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
        const errorMsg = `Riga ${i + 1} (${row['Nome Azienda'] || 'N/A'}): ${error.message || 'Errore sconosciuto'}`
        console.error(errorMsg, error)
        errors.push(errorMsg)
      }
    }

    const totalSkipped = Object.values(skippedReasons).reduce((a, b) => a + b, 0)

    console.log(`\n=== RISULTATI IMPORTAZIONE ===`)
    console.log(`Totale righe CSV: ${csvData.length}`)
    console.log(`Importati: ${importedClients.length}`)
    console.log(`Saltati: ${totalSkipped}`)
    console.log(`Errori: ${errors.length}`)
    console.log(`Dettaglio saltati:`, skippedReasons)
    console.log(`===============================\n`)

    return Response.json({
      success: true,
      message: `Importazione completata: ${importedClients.length} clienti importati, ${totalSkipped} saltati`,
      data: {
        imported: importedClients.length,
        errors: errors.length,
        skipped: totalSkipped,
        skippedBreakdown: {
          'Righe vuote/senza nome': skippedReasons.empty_denominazione,
          'Testi non validi': skippedReasons.invalid_text,
          'Duplicati P.IVA': skippedReasons.duplicate_piva,
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
    const value = row[csvColumn as string]
    if (!value || String(value).trim() === '') continue

    const cleanValue = String(value).trim()

    // Applica trasformazioni specifiche per tipo di campo
    try {
      switch (String(dbColumn)) {
        // Campi numerici
        case 'numero_dipendenti':
        case 'numero_volontari':
        case 'numero_collaboratori':
        case 'durata_evolvi':
        case 'ula':
          const intValue = parseInt(cleanValue.replace(/[.,]/g, ''))
          if (!isNaN(intValue)) {
            cliente[String(dbColumn)] = intValue
          }
          break

        case 'ultimo_fatturato':
        case 'attivo_bilancio':
          // Remove any non-numeric characters except decimal points
          const numericValue = cleanValue.replace(/[^\d.,]/g, '').replace(',', '.')
          const floatValue = parseFloat(numericValue)
          if (!isNaN(floatValue)) {
            cliente[String(dbColumn)] = floatValue
          }
          break

        // Mapping specifici per coordinate bancarie - estrai anche nome banca
        case 'coordinate_bancarie':
          cliente[String(dbColumn)] = cleanValue

          // Se è un IBAN italiano, estrai il nome della banca dal codice ABI e CAB
          if (cleanValue && cleanValue.startsWith('IT') && cleanValue.length >= 15) {
            const abi = cleanValue.substring(5, 10) // Caratteri 6-10 (ABI)
            const cab = cleanValue.substring(10, 15) // Caratteri 11-15 (CAB)

            const nomeBanca = getBankNameFromABI(abi)
            const nomeFiliale = getLocationFromCAB(cab)

            if (nomeBanca && nomeFiliale) {
              // Formato: "Nome Banca - Filiale di Città"
              cliente.banca_filiale = `${nomeBanca} - Filiale di ${nomeFiliale}`
            } else if (nomeBanca) {
              // Solo banca riconosciuta
              cliente.banca_filiale = `${nomeBanca} - Filiale ${cab}`
            } else {
              // Banca non riconosciuta
              cliente.banca_filiale = `Banca ABI ${abi} - Filiale ${cab}`
            }
          }
          break

        case 'iban':
          cliente[String(dbColumn)] = cleanValue
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
            cliente[String(dbColumn)] = date.toISOString().split('T')[0] // Solo data
          }
          break

        case 'scadenza_evolvi':
        case 'created_at':
          const dateTime = new Date(cleanValue)
          if (!isNaN(dateTime.getTime())) {
            cliente[String(dbColumn)] = dateTime.toISOString() // Data e ora
          }
          break

        // Dimensione (enum)
        case 'dimensione':
          const dimensione = cleanValue.toUpperCase()
          if (['MICRO', 'PICCOLA', 'MEDIA', 'GRANDE'].includes(dimensione)) {
            cliente[String(dbColumn)] = dimensione
          }
          break

        // Categoria Evolvi (mapping speciale)
        case 'categoria_evolvi':
          if (cleanValue.includes('SPOT')) {
            cliente[String(dbColumn)] = 'BASE'
          } else if (cleanValue.includes('PREMIUM')) {
            cliente[String(dbColumn)] = 'PREMIUM'
          } else if (cleanValue.includes('BUSINESS')) {
            cliente[String(dbColumn)] = 'BUSINESS'
          } else if (cleanValue.includes('ENTERPRISE')) {
            cliente[String(dbColumn)] = 'ENTERPRISE'
          } else {
            cliente[String(dbColumn)] = 'BASE'
          }
          break

        // Codice ATECO (split se presente tab) - salta sempre per evitare errori FK
        case 'ateco_2025':
          // Saltiamo completamente il campo ATECO per evitare errori di foreign key
          // I codici verranno aggiunti manualmente in seguito
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
          cliente[String(dbColumn)] = cleanValue
          break

        // Legale rappresentante (combinazione nome+cognome se disponibile) - campo legacy
        case 'legale_rappresentante':
          // Se la colonna è "Cognome", cerca anche "Nome" nello stesso row
          if (csvColumn === 'Cognome' && row['Nome']) {
            const nome = String(row['Nome']).trim()
            if (nome) {
              cliente[String(dbColumn)] = `${cleanValue} ${nome}`
            } else {
              cliente[String(dbColumn)] = cleanValue
            }
          } else if (csvColumn === 'Nome' && row['Cognome']) {
            const cognome = String(row['Cognome']).trim()
            if (cognome) {
              cliente[String(dbColumn)] = `${cognome} ${cleanValue}`
            } else {
              cliente[String(dbColumn)] = cleanValue
            }
          } else {
            cliente[String(dbColumn)] = cleanValue
          }
          break

        // Partita IVA - aggiungi zeri iniziali per arrivare a 11 caratteri
        case 'partita_iva':
          // Rimuovi spazi e caratteri non numerici, poi aggiungi padding
          const pivaClean = cleanValue.replace(/[^0-9]/g, '')
          if (pivaClean && pivaClean.length > 0) {
            // Padding a sinistra con zeri fino a 11 caratteri
            cliente[String(dbColumn)] = pivaClean.padStart(11, '0')
          }
          break

        // Campi testo normali
        default:
          cliente[String(dbColumn)] = cleanValue
          break
      }
    } catch (e) {
      // Se c'è un errore nella trasformazione, salta questo campo
      console.warn(`Errore trasformazione campo ${dbColumn}:`, e)
    }
  }

  return cliente
}

function getBankNameFromABI(abi: string): string | null {
  // Mappa dei codici ABI principali alle banche italiane
  const abiToBankName: { [key: string]: string } = {
    '01005': 'Intesa Sanpaolo',
    '02008': 'UniCredit',
    '03069': 'Intesa Sanpaolo',
    '03002': 'Banca Generali',
    '03479': 'Intesa Sanpaolo Private Banking',
    '05034': 'Banca Popolare di Sondrio',
    '05387': 'BPER Banca',
    '05584': 'Banca Popolare di Bari',
    '05696': 'Banco di Desio e della Brianza',
    '06175': 'Banca Popolare di Vicenza',
    '07601': 'Cariparma',
    '08327': 'Credito Valtellinese',
    '08509': 'Banco di Sardegna',
    '08905': 'Cassa di Risparmio di Bolzano',
    '10542': 'Banca di Cividale',
    '07072': 'Banco BPM',
    '05216': 'Banca Mediolanum',
    '03359': 'Mediobanca',
    '03032': 'BNL Gruppo BNP Paribas',
    '01030': 'Monte dei Paschi di Siena',
    '06230': 'Credito Emiliano',
    '05018': 'Banco di Brescia',
    '05385': 'BPER Banca',
    '03606': 'Banca Nazionale del Lavoro',
    '03058': 'Banco di Napoli',
    '01025': 'Cassa di Risparmio in Bologna',
    '06280': 'Banca Popolare di Puglia e Basilicata'
  }

  return abiToBankName[abi] || null
}

function getLocationFromCAB(cab: string): string | null {
  // Mappa completa dei CAB delle Marche
  const cabToLocation: { [key: string]: string } = {
    // PROVINCIA DI ANCONA
    '01801': 'Ancona',
    '01802': 'Ancona',
    '01803': 'Ancona',
    '01804': 'Ancona',
    '01805': 'Ancona',
    '01900': 'Chiaravalle',
    '02000': 'Falconara Marittima',
    '02100': 'Jesi',
    '02101': 'Jesi',
    '02200': 'Osimo',
    '02300': 'Senigallia',
    '02301': 'Senigallia',
    '02400': 'Fabriano',
    '02401': 'Fabriano',
    '02500': 'Loreto',
    '02600': 'Castelfidardo',
    '02700': 'Filottrano',
    '02800': 'Camerano',
    '02900': 'Agugliano',
    '03000': 'Barbara',
    '03100': 'Belvedere Ostrense',
    '03200': 'Cerreto d\'Esi',
    '03300': 'Corinaldo',
    '03400': 'Cupramontana',
    '03500': 'Genga',
    '03600': 'Maiolati Spontini',
    '03700': 'Monsano',
    '03800': 'Monte Roberto',
    '03900': 'Monte San Vito',
    '04000': 'Montecarotto',
    '04100': 'Montemarciano',
    '04200': 'Morro d\'Alba',
    '04300': 'Numana',
    '04400': 'Ostra',
    '04500': 'Ostra Vetere',
    '04600': 'Poggio San Marcello',
    '04700': 'Polverigi',
    '04800': 'Rosora',
    '04900': 'San Marcello',
    '05000': 'San Paolo di Jesi',
    '05100': 'Santa Maria Nuova',
    '05200': 'Sassoferrato',
    '05300': 'Serra de\' Conti',
    '05400': 'Serra San Quirico',
    '05500': 'Sirolo',
    '05600': 'Staffolo',

    // PROVINCIA DI ASCOLI PICENO
    '26001': 'Ascoli Piceno',
    '26002': 'Ascoli Piceno',
    '26003': 'Ascoli Piceno',
    '26100': 'San Benedetto del Tronto',
    '26101': 'San Benedetto del Tronto',
    '26102': 'San Benedetto del Tronto',
    '26200': 'Grottammare',
    '26300': 'Montegiorgio',
    '26400': 'Sant\'Elpidio a Mare',
    '26500': 'Porto Sant\'Elpidio',
    '26600': 'Fermo',
    '26700': 'Civitanova Marche',
    '26800': 'Macerata',
    '26900': 'Tolentino',

    // PROVINCIA DI FERMO
    '24001': 'Fermo',
    '24002': 'Fermo',
    '24100': 'Porto San Giorgio',
    '24200': 'Sant\'Elpidio a Mare',
    '24300': 'Porto Sant\'Elpidio',
    '24400': 'Montegranaro',
    '24500': 'Monte Urano',
    '24600': 'Servigliano',
    '24700': 'Amandola',
    '24800': 'Montelparo',
    '24900': 'Montefortino',

    // PROVINCIA DI MACERATA
    '18001': 'Macerata',
    '18002': 'Macerata',
    '18003': 'Macerata',
    '18100': 'Civitanova Marche',
    '18101': 'Civitanova Marche',
    '18200': 'Tolentino',
    '18300': 'Recanati',
    '18400': 'Camerino',
    '18500': 'San Severino Marche',
    '18600': 'Matelica',
    '18700': 'Cingoli',
    '18800': 'Treia',
    '18900': 'Pollenza',
    '19000': 'Corridonia',
    '19100': 'Montecosaro',
    '19200': 'Morrovalle',
    '19300': 'Potenza Picena',

    // PROVINCIA DI PESARO E URBINO
    '12001': 'Pesaro',
    '12002': 'Pesaro',
    '12003': 'Pesaro',
    '12004': 'Pesaro',
    '12100': 'Urbino',
    '12200': 'Fano',
    '12201': 'Fano',
    '12202': 'Fano',
    '12300': 'Cattolica',
    '12400': 'Gabicce Mare',
    '12500': 'Mondolfo',
    '12600': 'Pergola',
    '12700': 'Cagli',
    '12800': 'Fossombrone',
    '12900': 'Gradara',
    '13000': 'Marotta',
    '13100': 'Mondavio',
    '13200': 'Sant\'Angelo in Vado',
    '13300': 'Sassocorvaro',
    '13400': 'Tavullia',

    // CAB dai tuoi IBAN specifici (altri)
    '38721': 'Senigallia',
    '21206': 'Modena',
    '09606': 'Milano',
    '37281': 'Roma',
    '21204': 'Roma',
    '21302': 'Roma'
  }

  return cabToLocation[cab] || null
}

async function ensureAtecoExists(codice: string, descrizione?: string) {
  try {
    // Verifica se il codice ATECO esiste
    const { data: existing } = await supabase
      .from('scadenze_bandi_ateco_2025')
      .select('codice')
      .eq('codice', codice)
      .single()

    if (!existing) {
      // Inserisci il nuovo codice ATECO
      console.log(`Aggiungendo codice ATECO: ${codice} - ${descrizione || 'Nessuna descrizione'}`)

      const { error } = await supabase
        .from('scadenze_bandi_ateco_2025')
        .insert({
          codice: codice,
          descrizione: descrizione || 'Importato da CSV',
          attivo: true
        })

      if (error) {
        console.warn(`Errore aggiunta ATECO ${codice}:`, error)
      }
    }
  } catch (e) {
    console.warn(`Errore verifica ATECO ${codice}:`, e)
  }
}