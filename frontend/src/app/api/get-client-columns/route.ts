import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    // Ottieni la struttura della tabella clienti direttamente da Supabase
    const { data, error } = await supabase
      .from('scadenze_bandi_clienti')
      .select('*')
      .limit(1)
      .single()

    if (error) {
      // Se non ci sono dati, ottieni almeno la struttura con una query vuota
      const { data: emptyData, error: emptyError } = await supabase
        .from('scadenze_bandi_clienti')
        .select('*')
        .limit(0)

      if (emptyError) throw emptyError
    }

    // Definisco i placeholder predefiniti con etichette user-friendly
    const standardPlaceholders = [
      {
        key: 'DATA_ODIERNA',
        label: 'Data odierna',
        category: 'Sistema',
        description: 'La data di oggi (generata automaticamente)'
      },
      {
        key: 'DATA_COMPILAZIONE',
        label: 'Data e ora compilazione',
        category: 'Sistema',
        description: 'Timestamp di quando è stato compilato il documento'
      }
    ]

    // Mappa dei campi clienti con etichette user-friendly
    const clientFieldsMap = {
      id: { label: 'ID Cliente', category: 'Identificativi', description: 'Identificativo univoco del cliente' },
      denominazione: { label: 'Denominazione/Ragione Sociale', category: 'Dati Aziendali', description: 'Nome della società o denominazione sociale' },
      partita_iva: { label: 'Partita IVA', category: 'Dati Fiscali', description: 'Partita IVA dell\'azienda' },
      codice_fiscale: { label: 'Codice Fiscale', category: 'Dati Fiscali', description: 'Codice fiscale dell\'azienda o rappresentante legale' },
      email: { label: 'Email', category: 'Contatti', description: 'Indirizzo email principale' },
      pec: { label: 'PEC', category: 'Contatti', description: 'Posta Elettronica Certificata' },
      telefono: { label: 'Telefono', category: 'Contatti', description: 'Numero di telefono principale' },
      legale_rappresentante_nome: { label: 'Nome Legale Rappresentante', category: 'Legale Rappresentante', description: 'Nome del legale rappresentante' },
      legale_rappresentante_cognome: { label: 'Cognome Legale Rappresentante', category: 'Legale Rappresentante', description: 'Cognome del legale rappresentante' },
      legale_rappresentante_codice_fiscale: { label: 'CF Legale Rappresentante', category: 'Legale Rappresentante', description: 'Codice fiscale del legale rappresentante' },
      legale_rappresentante_telefono: { label: 'Telefono Legale Rappresentante', category: 'Legale Rappresentante', description: 'Telefono del legale rappresentante' },
      indirizzo_sede_legale: { label: 'Indirizzo Sede Legale', category: 'Indirizzi', description: 'Indirizzo completo della sede legale' },
      citta_sede_legale: { label: 'Città Sede Legale', category: 'Indirizzi', description: 'Città della sede legale' },
      provincia_sede_legale: { label: 'Provincia Sede Legale', category: 'Indirizzi', description: 'Provincia della sede legale' },
      cap_sede_legale: { label: 'CAP Sede Legale', category: 'Indirizzi', description: 'Codice avviamento postale della sede legale' },
      citta_fatturazione: { label: 'Città Fatturazione', category: 'Indirizzi', description: 'Città per la fatturazione' },
      sito_web: { label: 'Sito Web', category: 'Contatti', description: 'Sito web aziendale' },
      dimensione: { label: 'Dimensione Aziendale', category: 'Dati Aziendali', description: 'Dimensione dell\'azienda (MICRO, PICCOLA, MEDIA, GRANDE)' },
      numero_dipendenti: { label: 'Numero Dipendenti', category: 'Dati Aziendali', description: 'Numero di dipendenti' },
      ultimo_fatturato: { label: 'Ultimo Fatturato', category: 'Dati Aziendali', description: 'Ultimo fatturato registrato' },
      settore_ateco: { label: 'Settore ATECO', category: 'Dati Aziendali', description: 'Codice settore ATECO' },
      categoria_evolvi: { label: 'Categoria Evolvi', category: 'Servizi', description: 'Categoria di servizio Evolvi' },
      scadenza_evolvi: { label: 'Scadenza Evolvi', category: 'Servizi', description: 'Data scadenza servizio Evolvi' },
      note: { label: 'Note', category: 'Altri', description: 'Note aggiuntive sul cliente' },
      created_at: { label: 'Data Creazione', category: 'Sistema', description: 'Data di inserimento nel sistema' }
    }

    // Ottieni le colonne effettive dalla query (può essere estesa dinamicamente)
    // Per ora uso le colonne standard che conosco, ma il sistema è estendibile
    const clientPlaceholders = Object.entries(clientFieldsMap).map(([key, config]) => ({
      key: key.toUpperCase(),
      label: config.label,
      category: config.category,
      description: config.description
    }))

    // Combina placeholder standard e clienti
    const allPlaceholders = [
      ...standardPlaceholders,
      ...clientPlaceholders
    ]

    // Raggruppa per categoria
    const placeholdersByCategory = allPlaceholders.reduce((acc, placeholder) => {
      const category = placeholder.category
      if (!acc[category]) {
        acc[category] = []
      }
      acc[category].push(placeholder)
      return acc
    }, {} as Record<string, typeof allPlaceholders>)

    return NextResponse.json({
      success: true,
      placeholders: allPlaceholders,
      placeholdersByCategory: placeholdersByCategory,
      totalPlaceholders: allPlaceholders.length
    })

  } catch (error: any) {
    console.error('Error fetching client columns:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to fetch client columns'
    }, { status: 500 })
  }
}