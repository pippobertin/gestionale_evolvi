import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

// POST - Completa una scadenza contrattuale
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    // Recupera la scadenza corrente
    const { data: scadenza, error: fetchError } = await supabase
      .from('scadenze_bandi_scadenze_contrattuali')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return Response.json({
          success: false,
          error: 'Scadenza non trovata'
        }, { status: 404 })
      }
      throw fetchError
    }

    if (scadenza.stato === 'COMPLETATA') {
      return Response.json({
        success: false,
        error: 'La scadenza è già stata completata'
      }, { status: 400 })
    }

    if (scadenza.stato === 'ANNULLATA') {
      return Response.json({
        success: false,
        error: 'Non è possibile completare una scadenza annullata'
      }, { status: 400 })
    }

    const now = new Date().toISOString()

    // Aggiorna la scadenza come completata
    const { data: updated, error: updateError } = await supabase
      .from('scadenze_bandi_scadenze_contrattuali')
      .update({
        stato: 'COMPLETATA',
        data_completamento: now,
        completato_da: body.completato_da || 'system',
        note_completamento: body.note_completamento || null
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) throw updateError

    // Inserisci log di completamento
    await supabase
      .from('scadenze_bandi_scadenze_contrattuali_log')
      .insert([{
        scadenza_id: id,
        azione: 'completamento',
        descrizione: body.note_completamento
          ? `Scadenza completata. Note: ${body.note_completamento}`
          : 'Scadenza completata',
        eseguito_da: body.completato_da || 'system'
      }])

    let nuovaScadenza = null

    // Se è ricorrente, genera la prossima occorrenza
    if (scadenza.is_recurring && scadenza.recurrence_pattern) {
      const nextDate = calculateNextDate(
        scadenza.data_scadenza,
        scadenza.recurrence_pattern,
        scadenza.recurrence_interval || 1
      )

      // Verifica che la prossima data non superi la data di fine ricorrenza
      const shouldCreate = !scadenza.recurrence_end_date ||
        new Date(nextDate) <= new Date(scadenza.recurrence_end_date)

      if (shouldCreate) {
        const nuovaScadenzaData = {
          entity_type: scadenza.entity_type,
          entity_id: scadenza.entity_id,
          titolo: scadenza.titolo,
          descrizione: scadenza.descrizione,
          tipo_scadenza: scadenza.tipo_scadenza,
          categoria: scadenza.categoria,
          data_scadenza: nextDate,
          data_promemoria: scadenza.data_promemoria
            ? calculateNextDate(scadenza.data_promemoria, scadenza.recurrence_pattern, scadenza.recurrence_interval || 1)
            : null,
          is_recurring: true,
          recurrence_pattern: scadenza.recurrence_pattern,
          recurrence_interval: scadenza.recurrence_interval,
          recurrence_end_date: scadenza.recurrence_end_date,
          stato: 'APERTA',
          priorita: scadenza.priorita,
          responsabile_email: scadenza.responsabile_email,
          notifiche_attive: scadenza.notifiche_attive,
          notifica_giorni_prima: scadenza.notifica_giorni_prima,
          tags: scadenza.tags,
          created_by: 'system'
        }

        const { data: nuova, error: insertError } = await supabase
          .from('scadenze_bandi_scadenze_contrattuali')
          .insert([nuovaScadenzaData])
          .select()
          .single()

        if (insertError) {
          console.error('Errore nella generazione ricorrenza:', insertError)
        } else {
          nuovaScadenza = nuova

          // Log per la nuova scadenza generata
          await supabase
            .from('scadenze_bandi_scadenze_contrattuali_log')
            .insert([{
              scadenza_id: nuova.id,
              azione: 'ricorrenza_generata',
              descrizione: `Scadenza generata automaticamente dalla ricorrenza della scadenza ${id}. Prossima data: ${nextDate}`,
              eseguito_da: 'system'
            }])
        }
      }
    }

    return Response.json({
      success: true,
      data: updated,
      nuova_scadenza: nuovaScadenza,
      message: nuovaScadenza
        ? 'Scadenza completata e nuova occorrenza generata'
        : 'Scadenza completata con successo'
    })

  } catch (error: any) {
    console.error('Errore nel completamento scadenza contrattuale:', error)
    return Response.json({
      success: false,
      error: error.message || 'Errore nel completamento della scadenza contrattuale'
    }, { status: 500 })
  }
}

// Calcola la prossima data in base al pattern di ricorrenza
function calculateNextDate(
  currentDate: string,
  pattern: string,
  interval: number
): string {
  const date = new Date(currentDate)

  switch (pattern) {
    case 'MONTHLY':
      date.setMonth(date.getMonth() + interval)
      break
    case 'QUARTERLY':
      date.setMonth(date.getMonth() + (3 * interval))
      break
    case 'YEARLY':
      date.setFullYear(date.getFullYear() + interval)
      break
    default:
      date.setMonth(date.getMonth() + interval)
  }

  return date.toISOString().split('T')[0]
}
