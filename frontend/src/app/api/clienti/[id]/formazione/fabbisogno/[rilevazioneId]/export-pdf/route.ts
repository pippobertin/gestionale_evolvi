/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyJWT } from '@/lib/jwtAuth'
import { buildFabbisognoDocDefinition } from '@/lib/formazione/fabbisognoPdfBuilder'

// pdfmake 0.3.x esporta un'istanza singleton (non piu' una classe PdfPrinter).
// Si configurano i font assegnandoli alla proprieta' .fonts dell'istanza,
// poi createPdf() restituisce un OutputDocument con getBuffer() async.
function getPdfmake(): any {
  const mod = require('pdfmake')
  const pdfmake = mod?.default ?? mod
  pdfmake.fonts = {
    Helvetica: {
      normal: 'Helvetica',
      bold: 'Helvetica-Bold',
      italics: 'Helvetica-Oblique',
      bolditalics: 'Helvetica-BoldOblique',
    },
  }
  return pdfmake
}

/**
 * GET — Genera e restituisce il PDF della rilevazione fabbisogno.
 * Richiede autenticazione consulente. Disponibile solo per rilevazioni COMPLETATE.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; rilevazioneId: string }> }
) {
  try {
    const auth = await verifyJWT(request)
    if (!auth) {
      return Response.json({ success: false, error: 'Non autorizzato' }, { status: 401 })
    }

    const { id: clienteId, rilevazioneId } = await params

    // Recupera rilevazione (verifichiamo l'appartenenza al cliente)
    const { data: rilevazione, error: errRiv } = await supabase
      .from('scadenze_bandi_fabbisogno_rilevazioni')
      .select('*')
      .eq('id', rilevazioneId)
      .eq('cliente_id', clienteId)
      .single()

    if (errRiv || !rilevazione) {
      return Response.json({ success: false, error: 'Rilevazione non trovata' }, { status: 404 })
    }

    // Recupera in parallelo le figlie + il cliente
    const [popRes, insRes, obbRes, clienteRes] = await Promise.all([
      supabase
        .from('scadenze_bandi_fabbisogno_popolazione')
        .select('area, numero_dipendenti, note, ordine')
        .eq('rilevazione_id', rilevazioneId)
        .order('ordine'),
      supabase
        .from('scadenze_bandi_fabbisogno_inserimenti_previsti')
        .select('area, numero_inserimenti, periodo, ordine')
        .eq('rilevazione_id', rilevazioneId)
        .order('ordine'),
      supabase
        .from('scadenze_bandi_fabbisogno_obblighi_dichiarati')
        .select('tipo_obbligo, stato_dichiarato, stato_precompilato')
        .eq('rilevazione_id', rilevazioneId),
      supabase
        .from('scadenze_bandi_clienti')
        .select('denominazione, partita_iva')
        .eq('id', clienteId)
        .maybeSingle(),
    ])

    if (popRes.error) throw popRes.error
    if (insRes.error) throw insRes.error
    if (obbRes.error) throw obbRes.error

    // Costruisce il docDefinition
    const docDefinition = buildFabbisognoDocDefinition({
      rilevazione,
      cliente: clienteRes.data,
      popolazione: popRes.data || [],
      inserimenti_previsti: insRes.data || [],
      obblighi_dichiarati: obbRes.data || [],
    })

    // Genera il PDF e ottieni il Buffer (API pdfmake 0.3.x)
    const pdfmake = getPdfmake()
    const pdfDoc = pdfmake.createPdf(docDefinition)
    const buffer: Buffer = await pdfDoc.getBuffer()

    // Nome file: Rilevazione_Fabbisogno_<Denominazione>_<Anno>.pdf
    const denominazione = (clienteRes.data?.denominazione || 'Cliente')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 60)
    const filename = `Rilevazione_Fabbisogno_${denominazione}_${rilevazione.anno_riferimento || ''}.pdf`

    return new Response(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore generazione PDF'
    console.error('[API fabbisogno export-pdf] Error:', message, error)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
