import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { progettoId, templateName, importoConsulenza, customEmailMessage, autoSend = true } = await req.json()

    if (!progettoId) {
      return Response.json({ message: 'ID progetto richiesto' }, { status: 400 })
    }

    // 1. Genera contratto
    console.log('📄 Generazione contratto per progetto:', progettoId)

    const generateResponse = await fetch(`http://localhost:3000/api/contracts/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ progettoId, templateName, importoConsulenza })
    })

    const generateResult = await generateResponse.json()

    if (!generateResult.success) {
      return Response.json({
        success: false,
        message: 'Errore generazione contratto',
        error: generateResult.message
      }, { status: generateResponse.status })
    }

    const contractData = generateResult.data

    // 2. Invia email automaticamente (se richiesto)
    let emailResult = null
    if (autoSend) {
      console.log('📧 Invio automatico email contratto...')

      const emailResponse = await fetch(`http://localhost:3000/api/contracts/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          progettoId,
          contractId: contractData.contractId,
          contractUrl: contractData.contractUrl,
          customMessage: customEmailMessage
        })
      })

      emailResult = await emailResponse.json()

      if (!emailResult.success) {
        console.warn('⚠️ Contratto generato ma errore invio email:', emailResult.message)
        // Non bloccare il processo se l'email fallisce
      } else {
        console.log('✅ Email contratto inviata con successo')
      }
    }

    return Response.json({
      success: true,
      message: autoSend && emailResult?.success
        ? 'Contratto generato e email inviata con successo'
        : 'Contratto generato con successo',
      data: {
        contract: contractData,
        email: emailResult,
        workflow: {
          contractGenerated: true,
          emailSent: autoSend ? emailResult?.success : false
        }
      }
    })

  } catch (error: any) {
    console.error('Errore workflow contratto:', error)
    return Response.json({
      success: false,
      message: 'Errore durante processo contratto',
      error: error.message
    }, { status: 500 })
  }
}