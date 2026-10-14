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

    // Larghezze colonne PDF: lo spazio utile della pagina viene distribuito in
    // proporzione a larghezza_excel, così la tabella non esce mai dal foglio
    const LARGHEZZA_UTILE = 842 - 25 - 25          // A4 orizzontale meno margini
    const PADDING_X = 3                             // padding sinistro e destro di ogni cella
    const LINEA = 0.5
    const colonne = ambito.colonne_risultati
    const n = colonne.length
    const disponibile = LARGHEZZA_UTILE - n * PADDING_X * 2 - (n + 1) * LINEA
    const pesi = colonne.map(c => c.larghezza_excel || 18)
    const sommaPesi = pesi.reduce((a, b) => a + b, 0)
    const widths = pesi.map(p => Math.floor((p / sommaPesi) * disponibile))

    const molteColonne = n > 10
    const fontHeader = molteColonne ? 7.5 : 8.5
    const fontBody = molteColonne ? 6.5 : 7.5
    const allineamento = (c: DefinizioneColonna) =>
      c.formato === 'numero' || c.formato === 'valuta' ? 'right' : 'left'

    const headerRow = colonne.map(c => ({
      text: c.label,
      bold: true,
      color: 'white',
      fillColor: '#0d9488',
      fontSize: fontHeader,
      alignment: allineamento(c),
      margin: [0, 4, 0, 4],
    }))

    const bodyRows = righe.map(r =>
      colonne.map(c => ({
        text: formattaPerPdf(leggiCampo(r, c.campo), c),
        fontSize: fontBody,
        alignment: allineamento(c),
        margin: [0, 3, 0, 3],
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
            hLineWidth: () => LINEA,
            vLineWidth: () => LINEA,
            paddingLeft: () => PADDING_X,
            paddingRight: () => PADDING_X,
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
    case 'numero': {
      // NUMERIC può arrivare come stringa da PostgREST
      const n = typeof valore === 'number' ? valore : Number(valore)
      if (!Number.isFinite(n)) return String(valore)
      return n.toLocaleString('it-IT')
    }
    case 'valuta': {
      const n = typeof valore === 'number' ? valore : Number(valore)
      if (!Number.isFinite(n)) return String(valore)
      return new Intl.NumberFormat('it-IT', {
        style: 'currency', currency: 'EUR',
        minimumFractionDigits: 0, maximumFractionDigits: 2,
        useGrouping: 'always' as any,   // forza il punto anche su 4 cifre (8.000 €)
      }).format(n)
    }
    default:
      return String(valore)
  }
}
