/**
 * Stima della capienza de minimis a partire dagli aiuti RNA.
 *
 * Regola applicata (Reg. UE 2023/2831, de minimis generale): la somma degli
 * aiuti de minimis (ESL) concessi all'impresa unica nei tre anni precedenti
 * non può superare 300.000 €. Il periodo è mobile: si contano gli aiuti con
 * data di concessione successiva a oggi meno tre anni.
 *
 * Si contano tutti gli aiuti RNA del cliente (nostri e altrui) e, se presenti
 * nel gestionale, quelli delle aziende collegate (impresa unica).
 * I regimi de minimis settoriali (agricoltura, pesca, SIEG) hanno massimali
 * diversi: vengono riportati a parte, senza calcolo della capienza.
 *
 * È una stima: per la verifica formale fa fede la visura RNA.
 */

import { REGOLAMENTI_DE_MINIMIS_GENERALI } from './importer'

export const MASSIMALE_DE_MINIMIS_GENERALE = 300000

export interface AiutoPerDeMinimis {
  cliente_id: string | null
  data_concessione: string | null
  elemento_aiuto: number | string | null
  de_minimis: boolean
  cod_regolamenti: string[] | null
  regolamenti: string[] | null
}

export interface RiepilogoDeMinimis {
  massimale: number
  finestra_da: string            // 'AAAA-MM-GG' esclusa
  usato: number
  disponibile: number
  n_aiuti: number
  n_aiuti_collegate: number
  usato_collegate: number
  altri_regimi: Array<{ regolamento: string; totale: number; n: number }>
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function calcolaDeMinimis(
  aiuti: AiutoPerDeMinimis[],
  clienteId: string,
  oggi: Date = new Date()
): RiepilogoDeMinimis {
  const da = new Date(Date.UTC(oggi.getUTCFullYear() - 3, oggi.getUTCMonth(), oggi.getUTCDate()))
  const finestraDa = da.toISOString().slice(0, 10)

  let usato = 0, usatoCollegate = 0, n = 0, nCollegate = 0
  const altri = new Map<string, { regolamento: string; totale: number; n: number }>()

  aiuti.forEach(a => {
    if (!a.de_minimis || !a.data_concessione || a.data_concessione <= finestraDa) return
    const esl = Number(a.elemento_aiuto) || 0
    const codici = a.cod_regolamenti || []
    const generale = codici.length === 0 || codici.some(c => REGOLAMENTI_DE_MINIMIS_GENERALI.indexOf(c) >= 0)
    if (generale) {
      usato += esl
      n++
      if (a.cliente_id !== clienteId) { usatoCollegate += esl; nCollegate++ }
    } else {
      const nome = (a.regolamenti && a.regolamenti[0]) || codici[0] || 'Altro regime de minimis'
      const r = altri.get(nome) || { regolamento: nome, totale: 0, n: 0 }
      r.totale += esl
      r.n++
      altri.set(nome, r)
    }
  })

  return {
    massimale: MASSIMALE_DE_MINIMIS_GENERALE,
    finestra_da: finestraDa,
    usato: round2(usato),
    disponibile: round2(Math.max(0, MASSIMALE_DE_MINIMIS_GENERALE - usato)),
    n_aiuti: n,
    n_aiuti_collegate: nCollegate,
    usato_collegate: round2(usatoCollegate),
    altri_regimi: Array.from(altri.values()).map(r => ({ ...r, totale: round2(r.totale) })),
  }
}
