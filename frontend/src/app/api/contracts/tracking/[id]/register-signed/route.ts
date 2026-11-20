import { NextRequest } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin'
import { verifyJWT } from '@/lib/jwtAuth'
import { getValidGoogleToken } from '@/lib/googleAuth'
import { createDriveClient, uploadFileToFolder } from '@/lib/googleDrive'

/**
 * POST /api/contracts/tracking/[id]/register-signed
 *
 * Registra il contratto firmato restituito dal cliente (contratti di progetto
 * e contratti Evolvi). Il file viene salvato su Google Drive nella stessa
 * cartella del contratto approvato, con nome "..._FIRMATO_ricevuto_<data>".
 * Il tracking passa a "Firmato" (i solleciti si fermano); per i contratti
 * Evolvi anche il contratto passa a "firmato".
 *
 * Corpo multipart: file, data_ricezione (AAAA-MM-GG), canale, note (facoltativo).
 */

const CANALI = ['email', 'pec', 'a_mano', 'piattaforma_firma', 'altro']
const ESTENSIONI: Record<string, string> = {
  pdf: 'application/pdf',
  p7m: 'application/pkcs7-mime',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png'
}
const DIMENSIONE_MASSIMA = 25 * 1024 * 1024

function idDaUrlDrive(url: string | null | undefined): string | null {
  if (!url) return null
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  return m ? m[1] : null
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const utente = await verifyJWT(request)
    if (!utente) {
      return Response.json({ success: false, error: 'Non autenticato' }, { status: 401 })
    }
    const { id } = await params

    const form = await request.formData()
    const file = form.get('file') as File | null
    const dataRicezione = String(form.get('data_ricezione') || '')
    const canale = String(form.get('canale') || '')
    const note = String(form.get('note') || '').trim() || null

    if (!file || file.size === 0) {
      return Response.json({ success: false, error: 'Seleziona il file del contratto firmato' }, { status: 400 })
    }
    if (file.size > DIMENSIONE_MASSIMA) {
      return Response.json({ success: false, error: 'Il file supera i 25 MB' }, { status: 400 })
    }
    const nomeOriginale = file.name || 'contratto'
    const estensione = (nomeOriginale.split('.').pop() || '').toLowerCase()
    if (!ESTENSIONI[estensione]) {
      return Response.json({ success: false, error: 'Formati ammessi: PDF, P7M (firma digitale), JPG, PNG' }, { status: 400 })
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dataRicezione)) {
      return Response.json({ success: false, error: 'Indica la data di ricezione' }, { status: 400 })
    }
    const oggi = new Date().toISOString().slice(0, 10)
    if (dataRicezione > oggi) {
      return Response.json({ success: false, error: 'La data di ricezione non può essere futura' }, { status: 400 })
    }
    if (!CANALI.includes(canale)) {
      return Response.json({ success: false, error: 'Indica come è arrivato il contratto' }, { status: 400 })
    }

    const { data: tracking, error: trackingError } = await supabase
      .from('scadenze_bandi_contract_tracking')
      .select('id, entity_type, entity_id, cliente_id, contract_document_url, signed_contract_received, signed_contract_drive_url, signed_contract_notes')
      .eq('id', id)
      .single()
    if (trackingError || !tracking) {
      return Response.json({ success: false, error: 'Contratto non trovato' }, { status: 404 })
    }
    if (tracking.signed_contract_received) {
      return Response.json({ success: false, error: 'Il contratto firmato risulta già registrato' }, { status: 409 })
    }

    // Cartella del contratto approvato su Drive
    const idApprovato = idDaUrlDrive(tracking.contract_document_url)
    if (!idApprovato) {
      return Response.json({ success: false, error: 'Contratto approvato non trovato su Drive: impossibile individuare la cartella' }, { status: 422 })
    }
    const token = await getValidGoogleToken()
    if (!token) {
      return Response.json({ success: false, error: 'Accesso a Google Drive non disponibile' }, { status: 503 })
    }
    const drive = await createDriveClient(token)
    const { data: approvato } = await drive.files.get({
      fileId: idApprovato,
      fields: 'name,parents',
      supportsAllDrives: true
    })
    const cartella = approvato.parents?.[0]
    if (!cartella) {
      return Response.json({ success: false, error: 'Cartella del contratto approvato non trovata su Drive' }, { status: 422 })
    }

    // Nome: dal contratto approvato, con FIRMATO al posto di APPROVATO e la data di ricezione
    const base = (approvato.name || 'Contratto')
      .replace(/\.[^.]+$/, '')
      .replace(/_\d{4}-\d{2}-\d{2}$/, '')
    const nomeBase = /APPROVATO/.test(base) ? base.replace('APPROVATO', 'FIRMATO') : `FIRMATO_${base}`
    const nomeFile = `${nomeBase}_ricevuto_${dataRicezione}.${estensione}`

    const caricato = await uploadFileToFolder(
      token,
      cartella,
      nomeFile,
      Buffer.from(await file.arrayBuffer()),
      file.type || ESTENSIONI[estensione]
    )

    const adesso = new Date().toISOString()
    const { data: aggiornato, error: updateError } = await supabase
      .from('scadenze_bandi_contract_tracking')
      .update({
        signed_contract_received: true,
        signed_contract_received_at: `${dataRicezione}T12:00:00Z`,
        signed_contract_drive_id: caricato.id,
        signed_contract_drive_url: caricato.webViewLink,
        signed_contract_file_name: nomeFile,
        signed_contract_canale: canale,
        // Le note esistenti (per esempio quella della ricostruzione da Drive) si conservano
        signed_contract_notes: [tracking.signed_contract_notes, note].filter(Boolean).join('\n') || null,
        signed_contract_registrato_da: utente.userId,
        signed_contract_registrato_at: adesso,
        overall_status: 'SIGNED_RECEIVED',
        updated_at: adesso
      })
      .eq('id', id)
      .select('*')
      .single()
    if (updateError) throw updateError

    if (tracking.entity_type === 'CONTRATTO_EVOLVI') {
      await supabase
        .from('scadenze_bandi_contratti_evolvi')
        .update({ stato: 'firmato', firmato_il: `${dataRicezione}T12:00:00Z`, updated_at: adesso })
        .eq('id', tracking.entity_id)
        .in('stato', ['approvato', 'inviato'])
    }

    return Response.json({ success: true, data: aggiornato })
  } catch (error: any) {
    console.error('Errore registrazione contratto firmato:', error)
    return Response.json({ success: false, error: 'Errore nella registrazione del contratto firmato' }, { status: 500 })
  }
}
