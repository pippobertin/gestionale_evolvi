import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'

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

  // Colonne reali di scadenze_bandi_scadenze_contrattuali (prima il codice usava
  // colonne inesistenti, 'tipo' e 'giorni_notifica_prima', e l'inserimento falliva)
  const scadenze: Array<{
    cliente_id: string
    entity_type: string
    entity_id: string
    titolo: string
    descrizione: string
    tipo_scadenza: string
    categoria: string
    data_scadenza: string
    priorita: string
    notifica_giorni_prima: number[]
    tags: string[]
  }> = []

  // Scadenza rendicontazione
  if (piano.data_scadenza_rendicontazione && ['APPROVATO', 'IN_EROGAZIONE', 'CONCLUSO'].includes(piano.stato)) {
    scadenze.push({
      cliente_id: piano.cliente_id,
      entity_type: 'FORMAZIONE',
      entity_id: piano.id,
      titolo: `Rendicontazione piano "${piano.titolo}"`,
      descrizione: `Rendicontazione piano "${piano.titolo}" (${piano.codice_piano || 'senza codice'})`,
      tipo_scadenza: 'AMMINISTRATIVA',
      categoria: 'FORMAZIONE',
      data_scadenza: piano.data_scadenza_rendicontazione,
      priorita: 'ALTA',
      notifica_giorni_prima: [60, 30, 15, 7, 1],
      tags: ['SCADENZA_RENDICONTAZIONE'],
    })
  }

  // Scadenza fine attivita
  if (piano.data_fine_attivita && ['APPROVATO', 'IN_EROGAZIONE'].includes(piano.stato)) {
    scadenze.push({
      cliente_id: piano.cliente_id,
      entity_type: 'FORMAZIONE',
      entity_id: piano.id,
      titolo: `Fine attività piano "${piano.titolo}"`,
      descrizione: `Fine attività piano "${piano.titolo}" (${piano.codice_piano || 'senza codice'})`,
      tipo_scadenza: 'AMMINISTRATIVA',
      categoria: 'FORMAZIONE',
      data_scadenza: piano.data_fine_attivita,
      priorita: 'MEDIA',
      notifica_giorni_prima: [30, 15, 7, 1],
      tags: ['SCADENZA_FINE_ATTIVITA'],
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
        titolo: `Rinnovo ${tipoLabel}${persona}`,
        descrizione: `Rinnovo ${tipoLabel}${persona}`,
        tipo_scadenza: 'CERTIFICAZIONE',
        categoria: 'FORMAZIONE',
        data_scadenza: cert.data_scadenza,
        priorita: 'MEDIA',
        notifica_giorni_prima: [90, 60, 30, 7],
        tags: ['RINNOVO_CERTIFICAZIONE'],
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
