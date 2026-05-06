import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getValidGoogleToken } from '@/lib/googleAuth'
import { google } from 'googleapis'

// POST - Batch check delivery status per contratti inviati
export async function POST(request: NextRequest) {
  try {
    // Recupera tutti i tracking con email inviata ma ancora in stato SENT
    const { data: pendingTracking, error: fetchError } = await supabase
      .from('scadenze_bandi_contract_tracking')
      .select('id, email_message_id, email_delivery_status')
      .eq('email_sent', true)
      .eq('email_delivery_status', 'SENT')

    if (fetchError) throw fetchError

    if (!pendingTracking || pendingTracking.length === 0) {
      return Response.json({
        success: true,
        data: { checked: 0, updated: 0 },
        message: 'Nessun contratto da verificare'
      })
    }

    // Ottieni token Gmail
    const googleAccessToken = await getValidGoogleToken()
    if (!googleAccessToken) {
      return Response.json({
        success: false,
        error: 'Gmail non configurato - impossibile verificare consegne'
      }, { status: 401 })
    }

    // Crea client Gmail
    const auth = new google.auth.OAuth2()
    auth.setCredentials({ access_token: googleAccessToken })
    const gmail = google.gmail({ version: 'v1', auth })

    let checked = 0
    let updated = 0
    const results: any[] = []

    for (const record of pendingTracking) {
      checked++

      if (!record.email_message_id) {
        results.push({
          id: record.id,
          status: 'SKIPPED',
          reason: 'Nessun message_id disponibile'
        })
        continue
      }

      try {
        // Check message status in Gmail
        const message = await gmail.users.messages.get({
          userId: 'me',
          id: record.email_message_id,
          format: 'metadata',
          metadataHeaders: ['X-Failed-Recipients']
        })

        let newStatus = 'DELIVERED'
        let deliveryError: string | null = null

        // Check for bounce/failure indicators
        const headers = message.data.payload?.headers || []
        const failedRecipients = headers.find(h => h.name === 'X-Failed-Recipients')

        if (failedRecipients) {
          newStatus = 'BOUNCED'
          deliveryError = `Bounce: ${failedRecipients.value}`
        } else if (message.data.labelIds?.includes('SENT')) {
          newStatus = 'DELIVERED'
        }

        // Update tracking record
        const updateData: any = {
          email_delivery_status: newStatus
        }

        if (deliveryError) {
          updateData.email_delivery_error = deliveryError
        }

        // If delivered, update overall status too
        if (newStatus === 'DELIVERED') {
          updateData.overall_status = 'DELIVERED'
        } else if (newStatus === 'BOUNCED' || newStatus === 'FAILED') {
          updateData.overall_status = 'FAILED'
        }

        const { error: updateError } = await supabase
          .from('scadenze_bandi_contract_tracking')
          .update(updateData)
          .eq('id', record.id)

        if (!updateError) {
          updated++
        }

        results.push({
          id: record.id,
          status: newStatus,
          error: deliveryError
        })

      } catch (gmailError: any) {
        console.error(`Errore verifica messaggio ${record.email_message_id}:`, gmailError)
        results.push({
          id: record.id,
          status: 'ERROR',
          reason: gmailError.message
        })
      }
    }

    return Response.json({
      success: true,
      data: {
        checked,
        updated,
        results
      },
      message: `Verificati ${checked} contratti, aggiornati ${updated}`
    })

  } catch (error: any) {
    console.error('Errore nel check consegne contratti:', error)
    return Response.json({
      success: false,
      error: error.message || 'Errore nella verifica delle consegne'
    }, { status: 500 })
  }
}
