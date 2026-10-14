import {
  FORME_CONTRIBUTO,
  STATI_CONTRIBUTO,
  STATI_ESCLUSI_DAI_TOTALI,
  type ContributoForma,
  type ContributoStato,
} from './types'

export type RigaRiepilogo = {
  anno_competenza: number
  forma_contributo: ContributoForma
  stato: ContributoStato
  importo_contributo: number | string | null
  esl: number | string | null
}

export interface RiepilogoContributi {
  totale_contributi: number
  totale_esl: number
  numero_righe: number
  per_anno: Array<{ anno: number; importo: number; esl: number; count: number }>
  per_forma: Record<ContributoForma, { importo: number; esl: number; count: number }>
  per_stato: Record<ContributoStato, { importo: number; count: number }>
  anno_primo_contributo: number | null
  anno_ultimo_contributo: number | null
  esclusi_dai_totali: number   // righe REVOCATO/RINUNCIATO, contate solo in per_stato
}

/** true se la riga resta nello storico ma non entra nei totali */
export const escludiDaiTotali = (stato: ContributoStato) => STATI_ESCLUSI_DAI_TOTALI.includes(stato)

/** null -> 0; NUMERIC può arrivare come stringa da PostgREST */
const num = (v: number | string | null) => (v == null ? 0 : Number(v) || 0)
/** Evita residui floating point (es. 0.30000000000000004) */
const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Aggrega i contributi di un cliente (usato dall'API riepilogo e dall'export PDF).
 * importo_contributo/esl null contano come 0 nelle somme; count conta sempre la riga.
 * Le righe in STATI_ESCLUSI_DAI_TOTALI contano solo in per_stato (quadro completo)
 * e in esclusi_dai_totali; restano fuori da totali, per_anno, per_forma e periodo.
 */
export function calcolaRiepilogo(righe: RigaRiepilogo[]): RiepilogoContributi {
  const perAnno = new Map<number, { anno: number; importo: number; esl: number; count: number }>()
  const perForma = Object.fromEntries(
    FORME_CONTRIBUTO.map(f => [f, { importo: 0, esl: 0, count: 0 }])
  ) as Record<ContributoForma, { importo: number; esl: number; count: number }>
  const perStato = Object.fromEntries(
    STATI_CONTRIBUTO.map(s => [s, { importo: 0, count: 0 }])
  ) as Record<ContributoStato, { importo: number; count: number }>

  let totaleContributi = 0
  let totaleEsl = 0
  let numeroRighe = 0
  let esclusi = 0

  for (const r of righe) {
    const importo = num(r.importo_contributo)
    const esl = num(r.esl)

    const stato = perStato[r.stato]
    if (stato) {
      stato.importo += importo
      stato.count += 1
    }

    if (escludiDaiTotali(r.stato)) {
      esclusi += 1
      continue
    }

    numeroRighe += 1
    totaleContributi += importo
    totaleEsl += esl

    const anno = perAnno.get(r.anno_competenza) ?? { anno: r.anno_competenza, importo: 0, esl: 0, count: 0 }
    anno.importo += importo
    anno.esl += esl
    anno.count += 1
    perAnno.set(r.anno_competenza, anno)

    const forma = perForma[r.forma_contributo]
    if (forma) {
      forma.importo += importo
      forma.esl += esl
      forma.count += 1
    }
  }

  const anni = Array.from(perAnno.keys())

  return {
    totale_contributi: round2(totaleContributi),
    totale_esl: round2(totaleEsl),
    numero_righe: numeroRighe,
    per_anno: Array.from(perAnno.values())
      .sort((a, b) => b.anno - a.anno)
      .map(a => ({ ...a, importo: round2(a.importo), esl: round2(a.esl) })),
    per_forma: Object.fromEntries(
      Object.entries(perForma).map(([k, v]) => [k, { ...v, importo: round2(v.importo), esl: round2(v.esl) }])
    ) as RiepilogoContributi['per_forma'],
    per_stato: Object.fromEntries(
      Object.entries(perStato).map(([k, v]) => [k, { ...v, importo: round2(v.importo) }])
    ) as RiepilogoContributi['per_stato'],
    anno_primo_contributo: anni.length ? Math.min(...anni) : null,
    anno_ultimo_contributo: anni.length ? Math.max(...anni) : null,
    esclusi_dai_totali: esclusi,
  }
}
