/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */
import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { verifyJWT } from '@/lib/jwtAuth'
import {
  FORMA_LABEL,
  STATO_LABEL,
  isContributoForma,
  isContributoStato,
  type ContributoWithJoins,
} from '@/lib/contributi/types'
import { CONTRIBUTO_SELECT } from '@/lib/contributi/validation'
import { calcolaRiepilogo } from '@/lib/contributi/riepilogo'
import { buildContributiDocDefinition } from '@/lib/contributi/contributiPdfBuilder'

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

const ORIGINE_LABEL: Record<string, string> = { DA_PROGETTO: 'Da progetto', MANUALE: 'Manuale' }

/** Lettere, numeri e trattini; niente accenti, spazi o punti; max 40 caratteri */
function nomeFileSicuro(s: string): string {
  const pulito = s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '')
  return pulito || 'Cliente'
}

/**
 * GET — PDF "Riepilogo contributi ottenuti" del cliente.
 * Query string opzionali (gli stessi filtri del tab): anno, forma, stato, origine.
 * Il riepilogo è calcolato sulle righe filtrate, così i totali corrispondono alla tabella.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyJWT(request)
    if (!auth) {
      return Response.json({ success: false, error: 'Non autorizzato' }, { status: 401 })
    }

    const { id: clienteId } = await params
    const { searchParams } = new URL(request.url)
    const anno = searchParams.get('anno')
    const forma = searchParams.get('forma')
    const stato = searchParams.get('stato')
    const origine = searchParams.get('origine')

    // Validazione filtri
    const annoNum = anno ? Number(anno) : null
    if (anno && !Number.isInteger(annoNum)) {
      return Response.json({ success: false, error: 'Parametro anno non valido' }, { status: 400 })
    }
    if (forma && !isContributoForma(forma)) {
      return Response.json({ success: false, error: 'Parametro forma non valido' }, { status: 400 })
    }
    if (stato && !isContributoStato(stato)) {
      return Response.json({ success: false, error: 'Parametro stato non valido' }, { status: 400 })
    }
    if (origine && origine !== 'DA_PROGETTO' && origine !== 'MANUALE') {
      return Response.json({ success: false, error: 'Parametro origine non valido' }, { status: 400 })
    }

    // Cliente
    const { data: cliente, error: errC } = await supabase
      .from('scadenze_bandi_clienti')
      .select('denominazione, partita_iva, codice_fiscale, citta_fatturazione, provincia_fatturazione')
      .eq('id', clienteId)
      .maybeSingle()

    if (errC) throw errC
    if (!cliente) {
      return Response.json({ success: false, error: 'Cliente non trovato' }, { status: 404 })
    }

    // Contributi (stesso ordinamento della lista)
    let query = supabase
      .from('scadenze_bandi_contributi_ottenuti')
      .select(CONTRIBUTO_SELECT)
      .eq('cliente_id', clienteId)
      .order('anno_competenza', { ascending: false })
      .order('data_concessione', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (annoNum !== null) query = query.eq('anno_competenza', annoNum)
    if (forma) query = query.eq('forma_contributo', forma)
    if (stato) query = query.eq('stato', stato)
    if (origine) query = query.eq('origine', origine)

    const { data, error } = await query
    if (error) throw error
    const contributi = (data || []) as unknown as ContributoWithJoins[]

    const riepilogo = calcolaRiepilogo(contributi)

    const descrizioni = [
      annoNum !== null ? `Anno ${annoNum}` : null,
      forma && isContributoForma(forma) ? `Forma: ${FORMA_LABEL[forma]}` : null,
      stato && isContributoStato(stato) ? `Stato: ${STATO_LABEL[stato]}` : null,
      origine ? `Origine: ${ORIGINE_LABEL[origine]}` : null,
    ].filter(Boolean)
    const filtriDescrizione = descrizioni.length > 0 ? descrizioni.join(' · ') : null

    const docDefinition = buildContributiDocDefinition({
      cliente: {
        denominazione: cliente.denominazione || 'Cliente',
        partita_iva: cliente.partita_iva ?? null,
        codice_fiscale: cliente.codice_fiscale ?? null,
        citta_fatturazione: cliente.citta_fatturazione ?? null,
        provincia_fatturazione: cliente.provincia_fatturazione ?? null,
      },
      contributi,
      riepilogo,
      filtriDescrizione,
    })

    const pdfmake = getPdfmake()
    const pdfDoc = pdfmake.createPdf(docDefinition)
    const buffer: Buffer = await pdfDoc.getBuffer()

    // Data nel fuso italiano (il server gira in UTC)
    const oggi = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' })   // aaaa-mm-gg
    const filename = `Contributi_${nomeFileSicuro(cliente.denominazione || '')}_${oggi}.pdf`

    return new Response(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore generazione PDF contributi'
    console.error('[API contributi export-pdf] Error:', message, error)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
