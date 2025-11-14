import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    let { documentText, companyData } = body

    if (!documentText) {
      return NextResponse.json({ error: 'Document text is required' }, { status: 400 })
    }

    // Pulisci il testo del documento da caratteri di controllo e problematici
    documentText = documentText
      .replace(/[\x00-\x1F\x7F]/g, ' ') // Rimuovi caratteri di controllo
      .replace(/\s+/g, ' ') // Normalizza spazi multipli
      .replace(/[""]/g, '"') // Normalizza virgolette
      .replace(/['']/g, "'") // Normalizza apostrofi
      .trim()

    console.log('Document text cleaned, length:', documentText.length)
    console.log('Company data received:', JSON.stringify(companyData, null, 2))

    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
      return NextResponse.json({
        error: 'OpenAI API key not configured',
        instructions: 'Please set OPENAI_API_KEY in .env.local file'
      }, { status: 500 })
    }

    const prompt = `
COMPITO: Compila completamente questo documento amministrativo italiano sostituendo tutti i campi vuoti con i dati aziendali forniti.

DOCUMENTO ORIGINALE DA COMPILARE:
${documentText}

DATI AZIENDALI DISPONIBILI:
- Ragione Sociale: ${companyData.DENOMINAZIONE_AZIENDA || companyData.denominazione || 'blmproject srl'}
- Partita IVA: ${companyData.PARTITA_IVA || companyData.partita_iva || '02652950425'}
- Legale Rappresentante: ${(companyData.LEGALE_RAPPRESENTANTE_NOME || companyData.legale_rappresentante_nome || 'CHIARA').toUpperCase()} ${(companyData.LEGALE_RAPPRESENTANTE_COGNOME || companyData.legale_rappresentante_cognome || 'CANZI').toUpperCase()}
- Codice Fiscale Legale Rappresentante: ${companyData.LEGALE_RAPPRESENTANTE_CF || companyData.legale_rappresentante_codice_fiscale || 'CNZCHR77C54C523O'}
- Email Aziendale: ${companyData.EMAIL_AZIENDA || companyData.email || 'info@blmproject.com'}
- PEC Aziendale: ${companyData.PEC_AZIENDA || companyData.pec || 'blmproject@pec.it'}
- Telefono: ${companyData.TELEFONO_AZIENDA && companyData.TELEFONO_AZIENDA !== '[TELEFONO_NON_DISPONIBILE]' ? companyData.TELEFONO_AZIENDA : (companyData.legale_rappresentante_telefono || '3479573269')}
- Indirizzo Sede Legale: ${companyData.INDIRIZZO_SEDE_LEGALE || 'via/piazza [DA_COMPILARE] n. [DA_COMPILARE]'}
- Città: ${companyData.CITTA_SEDE_LEGALE || '[DA_COMPILARE]'}
- Provincia: ${companyData.PROVINCIA_SEDE_LEGALE || '[DA_COMPILARE]'}
- CAP: ${companyData.CAP_SEDE_LEGALE || '[DA_COMPILARE]'}
- Sito Web: ${companyData.SITO_WEB || 'www.blmproject.com'}

REGOLE DI COMPILAZIONE:
1. SOSTITUISCI TUTTI I PLACEHOLDER CON I DATI REALI:
   - (Nome e Cognome) → CHIARA CANZI
   - Codice Fiscale + linee → CNZCHR77C54C523O
   - Denominazione + linee → blmproject srl
   - PARTITA IVA + linee → 02652950425
   - Email + linee → info@blmproject.com
   - PEC + linee → blmproject@pec.it
   - Telefono + linee → 3479573269

2. MANTIENI IL FORMATO ORIGINALE:
   - NON eliminare etichette (es. "Codice Fiscale", "PARTITA IVA", "Denominazione")
   - SOSTITUISCI solo le linee tratteggiate (_____) o i placeholder
   - MANTIENI la struttura e formattazione del documento

3. GESTIONE CAMPI MANCANTI:
   - Se un indirizzo non è disponibile, usa: "via/piazza [DA_COMPILARE] n. [DA_COMPILARE]"
   - Se città/provincia/CAP mancano, lascia "[DA_COMPILARE]"
   - NON inventare dati non forniti

4. COMPILAZIONE INTELLIGENTE:
   - "Il/la sottoscritto/a" → "Il/la sottoscritto/a CHIARA CANZI"
   - "in qualità di..." → usa il dato del legale rappresentante
   - Per "Sede interessata dal programma" → usa la sede legale se diversa

IMPORTANTE: Per evitare problemi di parsing JSON, restituisci solo le sostituzioni principali.

Rispondi SOLO con un JSON in questo formato:
{
  "success": true,
  "replacements": [
    {
      "search": "(Nome e Cognome)",
      "replace": "CHIARA CANZI"
    },
    {
      "search": "Codice Fiscale _____________________________________________________________________________________",
      "replace": "Codice Fiscale CNZCHR77C54C523O"
    }
  ],
  "compilation_notes": "Sostituzioni applicate con successo"
}
`

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Sei un esperto nell'analisi di documenti legali e amministrativi italiani. Analizza il documento e suggerisci come compilarlo intelligentemente con i dati aziendali forniti."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 2000
    })

    const aiResponse = completion.choices[0]?.message?.content

    console.log('Raw AI Response:', aiResponse?.substring(0, 500) + '...')

    if (!aiResponse) {
      throw new Error('No response from OpenAI')
    }

    // Parse the JSON response - rimuovi markdown e caratteri problematici
    let cleanedResponse = aiResponse

    // Rimuovi markdown code blocks se presenti
    if (cleanedResponse.includes('```json')) {
      cleanedResponse = cleanedResponse.replace(/```json\s*/, '').replace(/```\s*$/, '')
    } else if (cleanedResponse.includes('```')) {
      cleanedResponse = cleanedResponse.replace(/```\s*/, '').replace(/```\s*$/, '')
    }

    // Pulisci caratteri di controllo e problematici dal JSON
    cleanedResponse = cleanedResponse
      .replace(/[\x00-\x1F\x7F]/g, ' ') // Rimuovi caratteri di controllo
      .trim()

    console.log('AI Response cleaned first 1000 chars:', cleanedResponse.substring(0, 1000))

    // NUOVO: Fix specifico per contenuto del documento che può avere newline
    try {
      // Prima prova a fare il parse direttamente
      const analysisResult = JSON.parse(cleanedResponse)
      console.log('✅ JSON parsato con successo')

      return NextResponse.json({
        success: true,
        analysis: analysisResult
      })
    } catch (parseError) {
      console.error('JSON Parse Error:', parseError)
      console.error('Errore alla posizione:', parseError.message)
      console.error('Contenuto intorno alla posizione di errore:',
        cleanedResponse.substring(Math.max(0, 7100), 7200))

      // Prova a fixare il JSON manualmente
      let fixedResponse = cleanedResponse

      // Fix comuni per JSON malformato
      fixedResponse = fixedResponse
        .replace(/([^\\])\\n/g, '$1\\\\n')  // Doppio escape per newlines
        .replace(/([^\\])\\r/g, '$1\\\\r')  // Doppio escape per carriage returns
        .replace(/([^\\])\\t/g, '$1\\\\t')  // Doppio escape per tabs
        .replace(/([^\\])"/g, '$1\\"')      // Escape quote non escapate (tranne quelle già escapate)
        .replace(/,(\s*[}\]])/g, '$1')      // Rimuovi virgole trailing

      console.log('Tentativo di fix JSON:', fixedResponse.substring(0, 500))

      try {
        const analysisResult = JSON.parse(fixedResponse)
        console.log('✅ JSON fixato e parsato con successo')

        return NextResponse.json({
          success: true,
          analysis: analysisResult
        })
      } catch (secondError) {
        console.error('Secondo tentativo fallito:', secondError)
        throw new Error(`Failed to parse AI response as JSON: ${parseError.message}`)
      }
    }

  } catch (error: any) {
    console.error('Error in document analysis:', error)

    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to analyze document',
      details: error.toString()
    }, { status: 500 })
  }
}