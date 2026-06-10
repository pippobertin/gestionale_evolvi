/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest } from 'next/server'
import { verifyJWT } from '@/lib/jwtAuth'
import { getAmbito } from '@/lib/interrogazioni/registry'
import { eseguiInterrogazione, leggiCampo } from '@/lib/interrogazioni/queryBuilder'
import type { DefinizioneColonna } from '@/lib/interrogazioni/registry'
import ExcelJS from 'exceljs'

/**
 * POST /api/interrogazioni/export-excel
 *
 * Stesso body di /search, ma genera e restituisce un file Excel
 * con tutti i risultati (senza paginazione).
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

    const { righe } = await eseguiInterrogazione({
      ambito,
      filtri: body.filtri || {},
      senza_paginazione: true,
    })

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Gestionale Evolvi'
    workbook.created = new Date()

    const sheet = workbook.addWorksheet(ambito.label.slice(0, 31))

    // Header
    sheet.columns = ambito.colonne_risultati.map(c => ({
      header: c.label,
      key: c.campo,
      width: c.larghezza_excel ?? 18,
    }))

    // Stile riga intestazione
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0D9488' },  // teal-600
    }
    sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'left' }
    sheet.getRow(1).height = 22

    // Righe dati
    for (const riga of righe) {
      const rigaExcel: Record<string, any> = {}
      for (const col of ambito.colonne_risultati) {
        rigaExcel[col.campo] = formattaPerExcel(leggiCampo(riga, col.campo), col)
      }
      sheet.addRow(rigaExcel)
    }

    // Freeze pane su prima riga
    sheet.views = [{ state: 'frozen', ySplit: 1 }]

    // Auto-filter su tutte le colonne
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: ambito.colonne_risultati.length },
    }

    // Genera buffer
    const arrayBuffer = await workbook.xlsx.writeBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const oggi = new Date().toISOString().slice(0, 10)
    const filename = `Interrogazione_${ambito.id}_${oggi}.xlsx`

    return new Response(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Errore export'
    console.error('[API interrogazioni/export-excel] Error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}

/**
 * Trasforma un valore in qualcosa di adatto a Excel in base al formato dichiarato.
 */
function formattaPerExcel(valore: unknown, col: DefinizioneColonna): any {
  if (valore === null || valore === undefined) return ''

  switch (col.formato) {
    case 'data':
      try {
        return new Date(valore as string)
      } catch {
        return valore
      }
    case 'data_ora':
      try {
        return new Date(valore as string)
      } catch {
        return valore
      }
    case 'enum':
      return col.enum_labels?.[valore as string] || valore
    case 'array': {
      if (!Array.isArray(valore)) return ''
      return (valore as string[])
        .map(v => col.enum_labels?.[v] || v)
        .join(', ')
    }
    case 'numero':
      return typeof valore === 'number' ? valore : Number(valore)
    case 'testo':
    default:
      return String(valore)
  }
}
