import { NextRequest, NextResponse } from 'next/server'
import PizZip from 'pizzip'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { templateData, clientData, projettoData } = body

    console.log('🚀 Inizio compilazione template con placeholder')
    console.log('📄 Template HTML presente:', !!templateData?.template_html)
    console.log('👤 Dati cliente:', Object.keys(clientData || {}))
    console.log('📋 Dati progetto:', Object.keys(projettoData || {}))

    if (!templateData?.template_html) {
      return NextResponse.json({
        success: false,
        error: 'Template HTML non trovato'
      }, { status: 400 })
    }

    // Unisci tutti i dati disponibili
    const allData = {
      // Dati sistema
      DATA_ODIERNA: new Date().toLocaleDateString('it-IT'),
      DATA_COMPILAZIONE: new Date().toLocaleString('it-IT'),

      // Dati cliente (normalizzati in maiuscolo)
      DENOMINAZIONE: clientData?.denominazione || clientData?.DENOMINAZIONE_AZIENDA || '',
      PARTITA_IVA: clientData?.partita_iva || clientData?.PARTITA_IVA || '',
      CODICE_FISCALE: clientData?.codice_fiscale || clientData?.CODICE_FISCALE || '',
      EMAIL: clientData?.email || clientData?.EMAIL_AZIENDA || '',
      PEC: clientData?.pec || clientData?.PEC_AZIENDA || '',
      TELEFONO: clientData?.telefono || clientData?.TELEFONO_AZIENDA || '',
      SITO_WEB: clientData?.sito_web || clientData?.SITO_WEB || 'www.blmproject.com',

      // Legale rappresentante
      LEGALE_RAPPRESENTANTE_NOME: clientData?.legale_rappresentante_nome || clientData?.LEGALE_RAPPRESENTANTE_NOME || '',
      LEGALE_RAPPRESENTANTE_COGNOME: clientData?.legale_rappresentante_cognome || clientData?.LEGALE_RAPPRESENTANTE_COGNOME || '',
      LEGALE_RAPPRESENTANTE_CF: clientData?.legale_rappresentante_codice_fiscale || clientData?.LEGALE_RAPPRESENTANTE_CF || '',
      LEGALE_RAPPRESENTANTE_TELEFONO: clientData?.legale_rappresentante_telefono || clientData?.LEGALE_RAPPRESENTANTE_TELEFONO || '',

      // Indirizzi
      INDIRIZZO_SEDE_LEGALE: clientData?.indirizzo_sede_legale || clientData?.INDIRIZZO_SEDE_LEGALE || '[DA_COMPILARE]',
      CITTA_SEDE_LEGALE: clientData?.citta_sede_legale || clientData?.CITTA_SEDE_LEGALE || '[DA_COMPILARE]',
      PROVINCIA_SEDE_LEGALE: clientData?.provincia_sede_legale || clientData?.PROVINCIA_SEDE_LEGALE || '[DA_COMPILARE]',
      CAP_SEDE_LEGALE: clientData?.cap_sede_legale || clientData?.CAP_SEDE_LEGALE || '[DA_COMPILARE]',

      // Dati aziendali aggiuntivi
      DIMENSIONE: clientData?.dimensione || '',
      NUMERO_DIPENDENTI: clientData?.numero_dipendenti || '',
      ULTIMO_FATTURATO: clientData?.ultimo_fatturato || '',
      SETTORE_ATECO: clientData?.settore_ateco || '',

      // Dati progetto se disponibili
      TITOLO_PROGETTO: projettoData?.titolo_progetto || '',
      CODICE_PROGETTO: projettoData?.codice_progetto || '',
      CONTRIBUTO_AMMESSO: projettoData?.contributo_ammesso || '',
      IMPORTO_TOTALE_PROGETTO: projettoData?.importo_totale_progetto || '',
      PERCENTUALE_CONTRIBUTO: projettoData?.percentuale_contributo || '',

      ...clientData, // Include tutti i dati originali
      ...projettoData // Include tutti i dati progetto
    }

    console.log('📊 Dati combinati per sostituzione:', Object.keys(allData))

    // Applica sostituzioni al template HTML
    let compiledHtml = templateData.template_html

    // Sostituisci tutti i placeholder nel formato {CHIAVE}
    for (const [key, value] of Object.entries(allData)) {
      if (value !== null && value !== undefined) {
        const placeholder = `{${key.toUpperCase()}}`
        const stringValue = String(value)

        // Sostituisci tutte le occorrenze del placeholder
        const regex = new RegExp(`\\${placeholder}`, 'g')
        const beforeCount = (compiledHtml.match(regex) || []).length
        compiledHtml = compiledHtml.replace(regex, stringValue)
        const afterCount = (compiledHtml.match(regex) || []).length

        if (beforeCount > 0) {
          console.log(`✅ Sostituito ${beforeCount} occorrenze di ${placeholder} con "${stringValue}"`)
        }
      }
    }

    // Gestioni speciali per placeholder combinati o formattati
    const specialReplacements = [
      {
        pattern: /\{LEGALE_RAPPRESENTANTE_NOME_COGNOME\}/g,
        value: `${allData.LEGALE_RAPPRESENTANTE_NOME} ${allData.LEGALE_RAPPRESENTANTE_COGNOME}`.trim()
      },
      {
        pattern: /\{INDIRIZZO_COMPLETO\}/g,
        value: `${allData.INDIRIZZO_SEDE_LEGALE}, ${allData.CITTA_SEDE_LEGALE} (${allData.PROVINCIA_SEDE_LEGALE}) ${allData.CAP_SEDE_LEGALE}`
      }
    ]

    specialReplacements.forEach(({ pattern, value }) => {
      if (pattern.test(compiledHtml)) {
        compiledHtml = compiledHtml.replace(pattern, value)
        console.log(`✅ Sostituito placeholder speciale con "${value}"`)
      }
    })

    // Verifica placeholder rimanenti
    const remainingPlaceholders = compiledHtml.match(/\{[A-Z_]+\}/g) || []
    if (remainingPlaceholders.length > 0) {
      console.log('⚠️ Placeholder non sostituiti:', [...new Set(remainingPlaceholders)])
    }

    console.log('✅ Compilazione template completata')

    return NextResponse.json({
      success: true,
      compiled_html: compiledHtml,
      replacements_made: Object.keys(allData).length,
      remaining_placeholders: [...new Set(remainingPlaceholders)]
    })

  } catch (error: any) {
    console.error('Errore compilazione template:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Errore nella compilazione del template'
    }, { status: 500 })
  }
}