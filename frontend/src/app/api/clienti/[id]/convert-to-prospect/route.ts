import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET: verifica dipendenze e determina scenario (A o B)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clienteId } = await params

    // 1. Verifica che il cliente esista
    const { data: cliente, error: clienteError } = await supabase
      .from('scadenze_bandi_clienti')
      .select('id, denominazione')
      .eq('id', clienteId)
      .single()

    if (clienteError || !cliente) {
      return Response.json({
        success: false,
        error: 'Cliente non trovato'
      }, { status: 404 })
    }

    // 2. Cerca prospect di origine
    const { data: prospect } = await supabase
      .from('scadenze_bandi_prospect')
      .select('id, denominazione, numero_prospect, stato')
      .eq('cliente_id', clienteId)
      .eq('stato', 'convertito')
      .maybeSingle()

    // 3. Conta dipendenze in parallelo
    const [
      contratti,
      fatture,
      documenti,
      referenti,
      pianiFormativi,
      corsi,
      adesioniFpi,
      collegamenti,
      contractTracking,
      scadenzeContrattuali,
      progetti,
    ] = await Promise.all([
      supabase.from('scadenze_bandi_contratti_evolvi').select('id', { count: 'exact', head: true }).eq('cliente_id', clienteId),
      supabase.from('scadenze_bandi_evolvi_fatture').select('id', { count: 'exact', head: true }).eq('cliente_id', clienteId),
      supabase.from('scadenze_bandi_documenti_amministrativi').select('id', { count: 'exact', head: true }).eq('cliente_id', clienteId),
      supabase.from('scadenze_bandi_clienti_referenti').select('id', { count: 'exact', head: true }).eq('cliente_id', clienteId),
      supabase.from('scadenze_bandi_piani_formativi').select('id', { count: 'exact', head: true }).eq('cliente_id', clienteId),
      supabase.from('scadenze_bandi_corsi_formativi').select('id', { count: 'exact', head: true }).eq('cliente_id', clienteId),
      supabase.from('scadenze_bandi_clienti_adesioni_fpi').select('id', { count: 'exact', head: true }).eq('cliente_id', clienteId),
      supabase.from('scadenze_bandi_collegamenti_aziendali').select('id', { count: 'exact', head: true }).eq('azienda_madre_id', clienteId),
      supabase.from('scadenze_bandi_contract_tracking').select('id', { count: 'exact', head: true }).eq('cliente_id', clienteId),
      supabase.from('scadenze_bandi_scadenze_contrattuali').select('id', { count: 'exact', head: true }).eq('cliente_id', clienteId),
      supabase.from('scadenze_bandi_progetti').select('id', { count: 'exact', head: true }).eq('cliente_id', clienteId),
    ])

    const dependencies = {
      contratti: contratti.count || 0,
      fatture: fatture.count || 0,
      documenti: documenti.count || 0,
      referenti: referenti.count || 0,
      piani_formativi: pianiFormativi.count || 0,
      corsi: corsi.count || 0,
      adesioni_fpi: adesioniFpi.count || 0,
      collegamenti: collegamenti.count || 0,
      contract_tracking: contractTracking.count || 0,
      scadenze_contrattuali: scadenzeContrattuali.count || 0,
      progetti: progetti.count || 0,
    }

    const totalDependencies = Object.values(dependencies).reduce((sum, n) => sum + n, 0)

    return Response.json({
      success: true,
      data: {
        scenario: prospect ? 'A' : 'B',
        prospectId: prospect?.id || null,
        prospectNumero: prospect?.numero_prospect || null,
        prospectDenominazione: prospect?.denominazione || null,
        dependencies,
        hasDependencies: totalDependencies > 0,
        totalDependencies,
      }
    })

  } catch (error: any) {
    console.error('Errore verifica dipendenze cliente:', error)
    return Response.json({
      success: false,
      error: error.message || 'Errore interno'
    }, { status: 500 })
  }
}

// POST: esegue la conversione cliente → prospect
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clienteId } = await params
    const body = await req.json()
    const { force = false, utente = 'system' } = body

    // 1. Recupera il cliente
    const { data: cliente, error: clienteError } = await supabase
      .from('scadenze_bandi_clienti')
      .select('*')
      .eq('id', clienteId)
      .single()

    if (clienteError || !cliente) {
      return Response.json({
        success: false,
        error: 'Cliente non trovato'
      }, { status: 404 })
    }

    // 2. Cerca prospect di origine
    const { data: prospect } = await supabase
      .from('scadenze_bandi_prospect')
      .select('id, stato')
      .eq('cliente_id', clienteId)
      .eq('stato', 'convertito')
      .maybeSingle()

    const scenario = prospect ? 'A' : 'B'

    // 3. Verifica dipendenze se non forzato
    if (!force) {
      const { data: checkData } = await supabase
        .from('scadenze_bandi_contratti_evolvi')
        .select('id', { count: 'exact', head: true })
        .eq('cliente_id', clienteId)

      // Basta controllare se ci sono dati qualsiasi - il frontend avrà già fatto il check completo
      return Response.json({
        success: false,
        error: 'Usa force=true per confermare la conversione',
        requiresForce: true
      }, { status: 400 })
    }

    // 4. Elimina dati dipendenti in ordine FK-safe
    console.log(`Riconversione cliente ${clienteId} (${cliente.denominazione}) - Scenario ${scenario}`)

    // 4a. Formazione: prima i partecipanti, poi corsi, certificazioni, piani
    const { data: corsiIds } = await supabase
      .from('scadenze_bandi_corsi_formativi')
      .select('id')
      .eq('cliente_id', clienteId)

    if (corsiIds && corsiIds.length > 0) {
      const ids = corsiIds.map((c: any) => c.id)
      await supabase.from('scadenze_bandi_partecipanti_formazione').delete().in('corso_id', ids)
    }
    await supabase.from('scadenze_bandi_corsi_formativi').delete().eq('cliente_id', clienteId)
    await supabase.from('scadenze_bandi_certificazioni_obbligatorie').delete().eq('cliente_id', clienteId)
    await supabase.from('scadenze_bandi_piani_formativi').delete().eq('cliente_id', clienteId)
    await supabase.from('scadenze_bandi_clienti_adesioni_fpi').delete().eq('cliente_id', clienteId)

    // 4b. Scadenze e tracking
    await supabase.from('scadenze_bandi_scadenze_contrattuali').delete().eq('cliente_id', clienteId)
    await supabase.from('scadenze_bandi_contract_tracking').delete().eq('cliente_id', clienteId)

    // 4c. Fatture e contratti
    await supabase.from('scadenze_bandi_evolvi_fatture').delete().eq('cliente_id', clienteId)
    await supabase.from('scadenze_bandi_contratti_evolvi').delete().eq('cliente_id', clienteId)

    // 4d. Documenti amministrativi + cleanup Storage
    const { data: documenti } = await supabase
      .from('scadenze_bandi_documenti_amministrativi')
      .select('storage_path')
      .eq('cliente_id', clienteId)

    if (documenti && documenti.length > 0) {
      const paths = documenti.map((d: any) => d.storage_path).filter(Boolean)
      if (paths.length > 0) {
        try {
          await supabase.storage.from('clienti-amministrativi').remove(paths)
        } catch (storageErr) {
          console.warn('Errore cleanup Storage (non bloccante):', storageErr)
        }
      }
    }
    await supabase.from('scadenze_bandi_documenti_amministrativi').delete().eq('cliente_id', clienteId)

    // 4e. Referenti e collegamenti
    await supabase.from('scadenze_bandi_clienti_referenti').delete().eq('cliente_id', clienteId)
    await supabase.from('scadenze_bandi_collegamenti_aziendali').delete().eq('azienda_madre_id', clienteId)

    // 4f. Progetti e scadenze bandi
    const { data: progettiIds } = await supabase
      .from('scadenze_bandi_progetti')
      .select('id')
      .eq('cliente_id', clienteId)

    if (progettiIds && progettiIds.length > 0) {
      const ids = progettiIds.map((p: any) => p.id)
      await supabase.from('scadenze_bandi_scadenze').delete().in('progetto_id', ids)
    }
    await supabase.from('scadenze_bandi_progetti').delete().eq('cliente_id', clienteId)

    let prospectId: string

    if (scenario === 'A' && prospect) {
      // 5A. Ripristina prospect esistente
      const { error: updateError } = await supabase
        .from('scadenze_bandi_prospect')
        .update({
          stato: 'preso_in_carico',
          decisione: null,
          cliente_id: null,
          data_conversione: null,
          convertito_da: null,
        })
        .eq('id', prospect.id)

      if (updateError) throw updateError

      // History
      await supabase.from('scadenze_bandi_prospect_history').insert([{
        prospect_id: prospect.id,
        stato_precedente: 'convertito',
        stato_nuovo: 'preso_in_carico',
        note: `Riconvertito da cliente a prospect. Cliente "${cliente.denominazione}" (ID: ${clienteId}) eliminato.`,
        utente,
      }])

      prospectId = prospect.id
      console.log(`Prospect ${prospect.id} ripristinato a preso_in_carico`)

    } else {
      // 5B. Crea nuovo prospect
      const prospectData = {
        denominazione: cliente.denominazione,
        partita_iva: cliente.partita_iva || null,
        codice_fiscale: cliente.codice_fiscale || null,
        email: cliente.email || null,
        pec: cliente.pec || null,
        telefono: cliente.telefono || null,
        sito_web: cliente.sito_web || null,
        indirizzo: cliente.indirizzo_fatturazione || null,
        cap: cliente.cap_fatturazione || null,
        citta: cliente.citta_fatturazione || null,
        provincia: cliente.provincia_fatturazione || null,
        ateco_2025: cliente.ateco_2025 || null,
        dimensione: cliente.dimensione || null,
        numero_dipendenti: cliente.numero_dipendenti || null,
        ultimo_fatturato: cliente.ultimo_fatturato || null,
        legale_rappresentante_nome: cliente.legale_rappresentante_nome || null,
        legale_rappresentante_cognome: cliente.legale_rappresentante_cognome || null,
        legale_rappresentante_email: cliente.legale_rappresentante_email || null,
        legale_rappresentante_telefono: cliente.legale_rappresentante_telefono || null,
        stato: 'bozza',
        note: cliente.note || null,
        fonte_acquisizione: 'altro',
        fonte_dettaglio: `Riconvertito da cliente (ID: ${clienteId})`,
        profiling_data: {},
        profiling_score: 0,
      }

      const { data: newProspect, error: insertError } = await supabase
        .from('scadenze_bandi_prospect')
        .insert([prospectData])
        .select('id, numero_prospect')
        .single()

      if (insertError) throw insertError

      // History
      await supabase.from('scadenze_bandi_prospect_history').insert([{
        prospect_id: newProspect.id,
        stato_precedente: null,
        stato_nuovo: 'bozza',
        note: `Prospect creato da riconversione cliente. Ex-cliente "${cliente.denominazione}" (ID: ${clienteId}).`,
        utente,
      }])

      prospectId = newProspect.id
      console.log(`Nuovo prospect ${newProspect.id} (${newProspect.numero_prospect}) creato`)
    }

    // 6. Elimina il record cliente
    const { error: deleteError } = await supabase
      .from('scadenze_bandi_clienti')
      .delete()
      .eq('id', clienteId)

    if (deleteError) throw deleteError

    console.log(`Cliente ${clienteId} eliminato. Riconversione completata.`)

    return Response.json({
      success: true,
      data: {
        scenario,
        prospectId,
        message: scenario === 'A'
          ? 'Prospect ripristinato allo stato "Preso in carico"'
          : 'Nuovo prospect creato con stato "Bozza"'
      }
    })

  } catch (error: any) {
    console.error('Errore riconversione cliente a prospect:', error)
    return Response.json({
      success: false,
      error: error.message || 'Errore durante la riconversione'
    }, { status: 500 })
  }
}
