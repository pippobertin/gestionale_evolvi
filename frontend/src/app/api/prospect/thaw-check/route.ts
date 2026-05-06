import { supabase } from '@/lib/supabase'

// POST - Auto-thaw: scongela prospect con scongela_il <= oggi
export async function POST() {
  try {
    const today = new Date().toISOString().split('T')[0]

    // Trova prospect congelati con data di scongelo passata
    const { data: frozen, error: fetchError } = await supabase
      .from('scadenze_bandi_prospect')
      .select('id, denominazione, stato_pre_congelamento, responsabile_qualificazione')
      .eq('stato', 'congelato')
      .lte('scongela_il', today)

    if (fetchError) throw fetchError
    if (!frozen || frozen.length === 0) {
      return Response.json({ success: true, thawed: 0 })
    }

    let thawedCount = 0

    for (const prospect of frozen) {
      const statoRipristino = prospect.stato_pre_congelamento || 'bozza'

      // Ripristina stato precedente e pulisci campi freeze
      const { error: updateError } = await supabase
        .from('scadenze_bandi_prospect')
        .update({
          stato: statoRipristino,
          congelato_il: null,
          scongela_il: null,
          stato_pre_congelamento: null,
          motivo_congelamento: null
        })
        .eq('id', prospect.id)

      if (updateError) {
        console.error(`Errore scongelamento prospect ${prospect.id}:`, updateError)
        continue
      }

      // Inserisci history
      await supabase
        .from('scadenze_bandi_prospect_history')
        .insert([{
          prospect_id: prospect.id,
          stato_precedente: 'congelato',
          stato_nuovo: statoRipristino,
          note: 'Scongelamento automatico (data scadenza raggiunta)'
        }])

      // Crea scadenza/reminder per il responsabile
      if (prospect.responsabile_qualificazione) {
        await supabase
          .from('scadenze_bandi_scadenze_contrattuali')
          .insert([{
            entity_type: 'GENERALE',
            entity_id: prospect.id,
            titolo: `Prospect scongelato: ${prospect.denominazione}`,
            descrizione: `Il prospect "${prospect.denominazione}" e stato scongelato automaticamente. Verificare e procedere con la pipeline.`,
            tipo_scadenza: 'AMMINISTRATIVA',
            categoria: 'prospect_scongelato',
            data_scadenza: today,
            priorita: 'ALTA',
            responsabile_email: prospect.responsabile_qualificazione,
            notifiche_attive: true,
            notifica_giorni_prima: [0],
            tags: ['prospect', 'scongelamento'],
            created_by: 'system'
          }])
      }

      thawedCount++
    }

    return Response.json({
      success: true,
      thawed: thawedCount,
      message: thawedCount > 0
        ? `${thawedCount} prospect scongelati automaticamente`
        : 'Nessun prospect da scongelare'
    })

  } catch (error: any) {
    console.error('Errore nel controllo auto-thaw:', error)
    return Response.json({
      success: false,
      error: error.message || 'Errore nel controllo auto-thaw'
    }, { status: 500 })
  }
}
