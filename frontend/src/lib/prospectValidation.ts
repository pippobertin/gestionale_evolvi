import { Prospect } from '@/types/prospect'

export function isGruppo2Complete(p: Partial<Prospect> | Record<string, any>): boolean {
  return !!(
    p.tipologia_soggetto &&
    p.area_interesse &&
    (typeof p.area_interesse === 'string' ? p.area_interesse.length > 0 : Array.isArray(p.area_interesse) && p.area_interesse.length > 0) &&
    p.natura_interesse &&
    (typeof p.bisogno_dichiarato === 'string' ? p.bisogno_dichiarato.trim() : false) &&
    (typeof p.bisogno_interpretato === 'string' ? p.bisogno_interpretato.trim() : false)
  )
}

export function isGruppo3Complete(p: Partial<Prospect> | Record<string, any>): boolean {
  return !!(
    p.affidabilita_percepita &&
    p.potenziale_economico &&
    p.tempi_decisione
  )
}

export function isGruppo4Complete(p: Partial<Prospect> | Record<string, any>): boolean {
  return !!(
    p.raccomandazione &&
    p.responsabile_qualificazione
  )
}
