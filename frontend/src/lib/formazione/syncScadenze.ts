import { supabase } from '@/lib/supabase'

/**
 * Sync scadenze for a Piano Formativo.
 * Creates/updates rows in scadenze_bandi_scadenze_contrattuali
 * with entity_type = 'FORMAZIONE'.
 */
export async function syncPianoScadenze(pianoId: string): Promise<void> {
  const { data: piano, error } = await supabase
    .from('scadenze_bandi_piani_formativi')
    .select('id, cliente_id, titolo, codice_piano, data_scadenza_rendicontazione, data_fine_attivita, data_presentazione, stato')
    .eq('id', pianoId)
    .single()

  if (error || !piano) {
    console.error('[syncPianoScadenze] Piano not found:', pianoId, error)
    return
  }

  // Remove existing scadenze for this piano
  await supabase
    .from('scadenze_bandi_scadenze_contrattuali')
    .delete()
    .eq('entity_type', 'FORMAZIONE')
    .eq('entity_id', pianoId)

  // Terminal states: no new deadlines
  if (['SALDATO', 'RESPINTO', 'ANNULLATO'].includes(piano.stato)) {
    return
  }

  const scadenze: Array<{
    cliente_id: string
    entity_type: string
    entity_id: string
    tipo: string
    descrizione: string
    data_scadenza: string
    giorni_notifica_prima: number[]
  }> = []

  // Scadenza rendicontazione
  if (piano.data_scadenza_rendicontazione && ['APPROVATO', 'IN_EROGAZIONE', 'CONCLUSO'].includes(piano.stato)) {
    scadenze.push({
      cliente_id: piano.cliente_id,
      entity_type: 'FORMAZIONE',
      entity_id: piano.id,
      tipo: 'SCADENZA_RENDICONTAZIONE',
      descrizione: `Rendicontazione piano "${piano.titolo}" (${piano.codice_piano || 'senza codice'})`,
      data_scadenza: piano.data_scadenza_rendicontazione,
      giorni_notifica_prima: [60, 30, 15, 7, 1],
    })
  }

  // Scadenza fine attivita
  if (piano.data_fine_attivita && ['APPROVATO', 'IN_EROGAZIONE'].includes(piano.stato)) {
    scadenze.push({
      cliente_id: piano.cliente_id,
      entity_type: 'FORMAZIONE',
      entity_id: piano.id,
      tipo: 'SCADENZA_FINE_ATTIVITA',
      descrizione: `Fine attività piano "${piano.titolo}" (${piano.codice_piano || 'senza codice'})`,
      data_scadenza: piano.data_fine_attivita,
      giorni_notifica_prima: [30, 15, 7, 1],
    })
  }

  if (scadenze.length > 0) {
    const { error: insertError } = await supabase
      .from('scadenze_bandi_scadenze_contrattuali')
      .insert(scadenze)

    if (insertError) {
      console.error('[syncPianoScadenze] Error inserting scadenze:', insertError)
    }
  }
}

/**
 * Sync scadenze for a Certificazione Obbligatoria.
 * Creates a deadline row for the renewal date.
 */
export async function syncCertificazioneScadenza(certId: string): Promise<void> {
  const { data: cert, error } = await supabase
    .from('scadenze_bandi_certificazioni_obbligatorie')
    .select('id, cliente_id, tipo_obbligo, persona_nome, data_scadenza, stato')
    .eq('id', certId)
    .single()

  if (error || !cert) {
    console.error('[syncCertificazioneScadenza] Cert not found:', certId, error)
    return
  }

  // Remove existing scadenze for this cert
  await supabase
    .from('scadenze_bandi_scadenze_contrattuali')
    .delete()
    .eq('entity_type', 'FORMAZIONE')
    .eq('entity_id', certId)

  // Only create scadenza if there's a valid future date and cert is active
  if (cert.data_scadenza && ['VALIDA', 'IN_SCADENZA'].includes(cert.stato)) {
    const tipoLabel = TIPO_OBBLIGO_LABELS[cert.tipo_obbligo] || cert.tipo_obbligo
    const persona = cert.persona_nome ? ` - ${cert.persona_nome}` : ''

    const { error: insertError } = await supabase
      .from('scadenze_bandi_scadenze_contrattuali')
      .insert({
        cliente_id: cert.cliente_id,
        entity_type: 'FORMAZIONE',
        entity_id: cert.id,
        tipo: 'RINNOVO_CERTIFICAZIONE',
        descrizione: `Rinnovo ${tipoLabel}${persona}`,
        data_scadenza: cert.data_scadenza,
        giorni_notifica_prima: [90, 60, 30, 7],
      })

    if (insertError) {
      console.error('[syncCertificazioneScadenza] Error inserting scadenza:', insertError)
    }
  }
}

const TIPO_OBBLIGO_LABELS: Record<string, string> = {
  FORMAZIONE_LAVORATORI_RISCHIO_BASSO: 'Form. lavoratori rischio basso',
  FORMAZIONE_LAVORATORI_RISCHIO_MEDIO: 'Form. lavoratori rischio medio',
  FORMAZIONE_LAVORATORI_RISCHIO_ALTO: 'Form. lavoratori rischio alto',
  RSPP: 'RSPP',
  DIRIGENTI_SSL: 'Dirigenti SSL',
  PREPOSTI: 'Preposti',
  RLS: 'RLS',
  ANTINCENDIO_BASSO: 'Antincendio rischio basso',
  ANTINCENDIO_MEDIO: 'Antincendio rischio medio',
  ANTINCENDIO_ALTO: 'Antincendio rischio alto',
  PRIMO_SOCCORSO: 'Primo soccorso',
  HACCP: 'HACCP',
  PRIVACY_GDPR: 'Privacy/GDPR',
  ANTIRICICLAGGIO: 'Antiriciclaggio',
  ALTRO: 'Altro',
}

/**
 * Compute the certification state based on expiration date.
 */
export function computeCertificazioneStato(dataScadenza: string | null): string {
  if (!dataScadenza) return 'VALIDA'
  const now = new Date()
  const scadenza = new Date(dataScadenza)
  const diffDays = Math.ceil((scadenza.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return 'SCADUTA'
  if (diffDays <= 90) return 'IN_SCADENZA'
  return 'VALIDA'
}
