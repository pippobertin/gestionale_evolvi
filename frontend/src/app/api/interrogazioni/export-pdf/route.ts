/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
import { NextRequest } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import { getAmbito } from '@/lib/interrogazioni/registry'
import { eseguiInterrogazione, leggiCampo } from '@/lib/interrogazioni/queryBuilder'
import type { DefinizioneColonna } from '@/lib/interrogazioni/registry'

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
 * POST /api/interrogazioni/export-pdf
 *
 * Riceve lo stesso body di /search ma genera un PDF orizzontale con la
 * tabella dei risultati, intestazione teal, e footer con paginazione.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyJWT(request)
    if (!auth) {
      return Response.json({ success: false, error: 'Non autorizzato' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const ambito = getAmbito(body.ambito as string)
    if (!ambito) {
      return Response.json({ success: false, error: 'Ambito sconosciuto' }, { status: 400 })
    }

    const { righe, totale } = await eseguiInterrogazione({
      ambito,
      filtri: body.filtri || {},
      senza_paginazione: true,
    })

    // Larghezze colonne PDF (proporzionali alle larghezze excel ma scalate)
    const widths = ambito.colonne_risultati.map(c => {
      const w = c.larghezza_excel || 18
      return Math.max(40, w * 4)  // px
    })

    const headerRow = ambito.colonne_risultati.map(c => ({
      text: c.label,
      bold: true,
      color: 'white',
      fillColor: '#0d9488',
      fontSize: 8.5,
      margin: [3, 4, 3, 4],
    }))

    const bodyRows = righe.map(r =>
      ambito.colonne_risultati.map(c => ({
        text: formattaPerPdf(leggiCampo(r, c.campo), c),
        fontSize: 7.5,
        margin: [3, 3, 3, 3],
      }))
    )

    const docDefinition = {
      pageSize: 'A4',
      pageOrientation: 'landscape',
      pageMargins: [25, 60, 25, 45],
      defaultStyle: { font: 'Helvetica' },
      header: () => ({
        columns: [
          { text: `Interrogazione: ${ambito.label}`, bold: true, fontSize: 11, color: '#0f766e', margin: [25, 18, 0, 0] },
          {
            text: `${totale} risultati · ${new Date().toLocaleDateString('it-IT')}`,
            fontSize: 9, color: '#6b7280', alignment: 'right', margin: [0, 20, 25, 0],
          },
        ],
      }),
      content: [
        {
          table: {
            headerRows: 1,
            widths,
            body: [headerRow, ...bodyRows],
            dontBreakRows: true,
          },
          layout: {
            hLineColor: () => '#e5e7eb',
            vLineColor: () => '#e5e7eb',
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
          },
        },
      ],
      footer: (currentPage: number, pageCount: number) => ({
        columns: [
          { text: 'Gestionale Evolvi · BLM Project', fontSize: 7.5, color: '#9ca3af', margin: [25, 16, 0, 0] },
          { text: `Pagina ${currentPage} di ${pageCount}`, fontSize: 7.5, color: '#9ca3af', alignment: 'right', margin: [0, 16, 25, 0] },
        ],
      }),
    }

    const pdfmake = getPdfmake()
    const pdfDoc = pdfmake.createPdf(docDefinition)
    const buffer: Buffer = await pdfDoc.getBuffer()

    const oggi = new Date().toISOString().slice(0, 10)
    const filename = `Interrogazione_${ambito.id}_${oggi}.pdf`

    return new Response(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore export PDF'
    console.error('[API interrogazioni/export-pdf] Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}

function formattaPerPdf(valore: unknown, col: DefinizioneColonna): string {
  if (valore === null || valore === undefined || valore === '') return ''

  switch (col.formato) {
    case 'data':
      try {
        return new Date(valore as string).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
      } catch {
        return String(valore)
      }
    case 'data_ora':
      try {
        return new Date(valore as string).toLocaleString('it-IT')
      } catch {
        return String(valore)
      }
    case 'enum':
      return col.enum_labels?.[valore as string] || String(valore)
    case 'array':
      if (!Array.isArray(valore)) return ''
      return (valore as string[]).map(v => col.enum_labels?.[v] || v).join(', ')
    case 'numero':
      if (typeof valore === 'number') return valore.toLocaleString('it-IT')
      return String(valore)
    default:
      return String(valore)
  }
}
