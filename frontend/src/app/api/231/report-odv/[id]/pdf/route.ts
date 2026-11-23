import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { contesto231 } from '@/lib/registri231'
import { pdfReportOdv } from '@/lib/reportOdvPdf'

/** PDF del report: bozza per chi lo prepara, versione inviata anche per l'OdV. */
export const maxDuration = 60

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const sessione = await verifyJWT(request)
  if (!sessione) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const { id } = await params
  const { data: r } = await supabaseAdmin.from('scadenze_bandi_report_odv').select('*').eq('id', id).maybeSingle()
  if (!r || (sessione.livello_permessi === 'odv' && !r.inviato_il)) return NextResponse.json({ error: 'Report non trovato' }, { status: 404 })
  const ctx = await contesto231(sessione.userId, sessione.livello_permessi)
  const buffer = await pdfReportOdv({ ...r, inviatoDa: r.inviato_da ? ctx.nomi[r.inviato_da] : undefined, nomi: ctx.nomi })
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Report_OdV_${r.anno}_semestre_${r.semestre}${r.inviato_il ? '' : '_bozza'}.pdf"`
    }
  })
}
