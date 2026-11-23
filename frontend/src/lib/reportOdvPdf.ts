/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
import type { Sezioni } from './reportOdv'

/** PDF del report semestrale all'OdV (modulo M.05), generato con pdfmake. */

function pdfmake(): any {
  const mod = require('pdfmake')
  const p = mod?.default ?? mod
  p.fonts = { Helvetica: { normal: 'Helvetica', bold: 'Helvetica-Bold', italics: 'Helvetica-Oblique', bolditalics: 'Helvetica-BoldOblique' } }
  return p
}

const it = (d?: string | null) => (d ? d.slice(0, 10).split('-').reverse().join('/') : '')

export async function pdfReportOdv(r: {
  anno: number; semestre: number; periodo_dal: string; periodo_al: string; scadenza: string; sezioni: Sezioni
  inviato_il?: string | null; inviatoDa?: string; nomi: Record<string, string>
}): Promise<Buffer> {
  const contenuto: any[] = [
    { text: 'BLMProject S.r.l. · Modello 231 · Modulo M.05', style: 'piccolo' },
    { text: 'Report semestrale all\'Organismo di Vigilanza', style: 'titolo' },
    { text: `Periodo dal ${it(r.periodo_dal)} al ${it(r.periodo_al)} · da inviare entro il ${it(r.scadenza)}`, margin: [0, 0, 0, 4] },
    { text: r.inviato_il ? `Inviato all'OdV il ${it(r.inviato_il)}${r.inviatoDa ? ` da ${r.inviatoDa}` : ''}` : 'BOZZA, non ancora inviata', style: r.inviato_il ? 'piccolo' : 'bozza', margin: [0, 0, 0, 10] }
  ]
  for (const [k, s] of Object.entries(r.sezioni)) {
    contenuto.push({ text: `${k}. ${s.titolo}`, style: 'sezione' })
    contenuto.push({ text: `Compila: ${s.compila}${s.confermata_il ? ` · confermata da ${r.nomi[s.confermata_da || ''] || ''} il ${it(s.confermata_il)}` : ' · non confermata'}`, style: 'piccolo', margin: [0, 0, 0, 4] })
    if (s.nessuna_novita) contenuto.push({ text: 'Nessuna novità nel periodo.', italics: true, margin: [0, 0, 0, 4] })
    contenuto.push({
      table: {
        headerRows: 1, widths: ['32%', 50, '*'],
        body: [
          [{ text: 'Voce', style: 'th' }, { text: 'Numero', style: 'th' }, { text: 'Dettaglio', style: 'th' }],
          ...s.voci.map(v => [
            { text: v.etichetta, fontSize: 8 },
            { text: v.numero || '', fontSize: 8 },
            { text: [v.dettaglio, v.nota].filter(Boolean).join('\n\n') || '', fontSize: 8 }
          ])
        ]
      },
      layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => '#d1d5db', vLineColor: () => '#d1d5db' },
      margin: [0, 0, 0, 6]
    })
    if (s.testo) contenuto.push({ text: s.testo, fontSize: 9, margin: [0, 0, 0, 6] })
  }
  contenuto.push({ text: 'Restano fuori dal report, perché si comunicano subito all\'OdV, i fatti gravi: segnalazioni urgenti, infortuni gravi, violazioni dei sistemi informativi, ispezioni o contestazioni di un ente.', style: 'piccolo', margin: [0, 10, 0, 0] })

  const doc = {
    pageSize: 'A4', pageMargins: [36, 40, 36, 40],
    defaultStyle: { font: 'Helvetica', fontSize: 9 },
    styles: {
      titolo: { fontSize: 15, bold: true, margin: [0, 4, 0, 4] },
      sezione: { fontSize: 11, bold: true, margin: [0, 8, 0, 2] },
      th: { bold: true, fontSize: 8, fillColor: '#f3f4f6' },
      piccolo: { fontSize: 8, color: '#6b7280' },
      bozza: { fontSize: 9, bold: true, color: '#b45309' }
    },
    footer: (pagina: number, totale: number) => ({ text: `Report OdV ${r.semestre}° semestre ${r.anno} · pagina ${pagina} di ${totale}`, alignment: 'center', fontSize: 7, color: '#9ca3af' }),
    content: contenuto
  }
  return pdfmake().createPdf(doc).getBuffer()
}
