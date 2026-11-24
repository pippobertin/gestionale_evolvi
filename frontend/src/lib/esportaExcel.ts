/**
 * Esportazione in Excel (.xlsx) dal browser, uguale in tutto il gestionale:
 * prima riga in grassetto, colonne larghe quanto serve.
 */
export async function esportaExcel(intestazioni: string[], righe: unknown[][], nomeFile: string, foglio = 'Dati') {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(foglio.slice(0, 31))
  ws.addRow(intestazioni)
  ws.getRow(1).font = { bold: true }
  for (const r of righe) ws.addRow(r.map(v => (v === null || v === undefined ? '' : v)))
  ws.columns.forEach((col, i) => {
    const lunghezze = [intestazioni[i] || '', ...righe.map(r => String(r[i] ?? ''))].map(x => x.length)
    col.width = Math.min(60, Math.max(10, ...lunghezze) + 2)
  })
  const buffer = await wb.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${nomeFile}.xlsx`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Da un elenco di oggetti: le chiavi del primo diventano le intestazioni. */
export async function esportaExcelOggetti(dati: Record<string, unknown>[], nomeFile: string) {
  if (!dati.length) return
  const chiavi = Object.keys(dati[0])
  await esportaExcel(chiavi, dati.map(d => chiavi.map(k => {
    const v = d[k]
    return v && typeof v === 'object' ? JSON.stringify(v) : v
  })), nomeFile)
}
