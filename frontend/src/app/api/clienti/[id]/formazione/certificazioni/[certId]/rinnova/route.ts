import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyJWT } from '@/lib/jwtAuth'
import { syncCertificazioneScadenza } from '@/lib/formazione/syncScadenze'

// POST - Rinnova certificazione (shortcut)
// Crea nuova certificazione con date ricalcolate, chiude la vecchia
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; certId: string }> }
) {
  try {
    await verifyJWT(request)
    const { id: clienteId, certId } = await params

    // Get current cert
    const { data: oldCert, error: fetchError } = await supabase
      .from('scadenze_bandi_certificazioni_obbligatorie')
      .select('*')
      .eq('id', certId)
      .single()

    if (fetchError || !oldCert) {
      return Response.json({ success: false, error: 'Certificazione non trovata' }, { status: 404 })
    }

    const oggi = new Date().toISOString().split('T')[0]
    let nuovaScadenza: string | null = null

    if (oldCert.validita_mesi) {
      const d = new Date()
      d.setMonth(d.getMonth() + oldCert.validita_mesi)
      nuovaScadenza = d.toISOString().split('T')[0]
    }

    // Create new cert
    const { data: newCert, error: insertError } = await supabase
      .from('scadenze_bandi_certificazioni_obbligatorie')
      .insert({
        cliente_id: clienteId,
        tipo_obbligo: oldCert.tipo_obbligo,
        normativa_riferimento: oldCert.normativa_riferimento,
        persona_nome: oldCert.persona_nome,
        persona_codice_fiscale: oldCert.persona_codice_fiscale,
        data_conseguimento: oggi,
        data_scadenza: nuovaScadenza,
        validita_mesi: oldCert.validita_mesi,
        stato: 'VALIDA',
        note: `Rinnovo di certificazione del ${oldCert.data_conseguimento || 'N/A'}`,
      })
      .select()
      .single()

    if (insertError) throw insertError

    // Mark old cert as renewed
    await supabase
      .from('scadenze_bandi_certificazioni_obbligatorie')
      .update({ stato: 'DA_RINNOVARE', updated_at: new Date().toISOString() })
      .eq('id', certId)

    // Sync scadenze for both
    await syncCertificazioneScadenza(certId)
    if (newCert) {
      await syncCertificazioneScadenza(newCert.id)
    }

    return Response.json({ success: true, data: newCert })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore rinnovo certificazione'
    console.error('[API certificazioni/rinnova] POST Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
