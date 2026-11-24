'use client'

import { useEffect } from 'react'

/**
 * Chiusura delle finestre con un clic fuori dal riquadro, in tutto il
 * gestionale. Quando il clic cade sullo sfondo scuro di una finestra (un
 * elemento "fixed inset-0"), preme il suo pulsante di chiusura: quello marcato
 * data-chiudi, altrimenti la X in alto, altrimenti "Annulla" o "Chiudi".
 * Il clic deve iniziare e finire sullo sfondo, così selezionare un testo e
 * rilasciare fuori non chiude nulla. Le finestre che già si chiudono da sole
 * con il clic sullo sfondo non vengono toccate; quelle marcate
 * data-senza-clic-fuori si chiudono solo con i loro pulsanti.
 */

const eSfondo = (el: Element) => el.classList.contains('fixed') && el.classList.contains('inset-0')
// Il riquadro della finestra: ha uno sfondo chiaro o un'ombra
const eRiquadro = (el: Element) => /(^|\s)(bg-white|bg-gray-50|bg-slate-50|shadow(-[a-z0-9]+)?)(\s|$)/.test(el.getAttribute('class') || '')
const sfondoDi = (el: Element) => el.closest('.fixed.inset-0')

function pulsanteChiusura(sfondo: Element): HTMLButtonElement | null {
  const miei = (sel: string) => Array.from(sfondo.querySelectorAll<HTMLButtonElement>(sel)).filter(b => sfondoDi(b) === sfondo)
  const marcato = miei('[data-chiudi]')[0]
  if (marcato) return marcato
  const riquadro = Array.from(sfondo.querySelectorAll('*')).find(el => eRiquadro(el) && sfondoDi(el) === sfondo)
  const cima = riquadro ? riquadro.getBoundingClientRect().top : -Infinity
  const x = miei('button').find(b =>
    b.querySelector('svg.lucide-x, svg.lucide-circle-x, svg.lucide-x-circle') &&
    b.getBoundingClientRect().top - cima < 120
  )
  if (x) return x
  return miei('button').find(b => /^(annulla|chiudi)$/i.test((b.textContent || '').trim())) || null
}

/** Attiva la chiusura con il clic fuori sul documento; restituisce la funzione che la toglie. */
export function attivaChiusuraFinestre(doc: Document): () => void {
    let partenza: EventTarget | null = null
    const giu = (e: MouseEvent) => { partenza = e.target }
    const clic = (e: MouseEvent) => {
      const t = e.target
      if (!(t instanceof Element) || e.button !== 0 || e.defaultPrevented) return
      // Se la finestra si è già chiusa da sola, l'elemento non c'è più
      if (!t.isConnected || partenza !== t) return
      let sfondo: Element | null = null
      for (let el: Element | null = t; el; el = el.parentElement) {
        if (eSfondo(el)) { sfondo = el; break }
        if (eRiquadro(el)) return // clic dentro il riquadro
      }
      // Finestre da non chiudere per sbaglio (per esempio la password mostrata una volta sola)
      if (sfondo?.closest('[data-senza-clic-fuori]')) return
      // Dalla finestra più interna verso l'esterno, fino a trovare come chiuderla
      for (let s: Element | null = sfondo; s; s = s.parentElement ? sfondoDi(s.parentElement) : null) {
        const p = pulsanteChiusura(s)
        if (p) { if (!p.disabled) p.click(); return }
      }
    }
    doc.addEventListener('mousedown', giu, true)
    doc.addEventListener('click', clic)
    return () => {
      doc.removeEventListener('mousedown', giu, true)
      doc.removeEventListener('click', clic)
    }
}

export default function ChiusuraFinestre() {
  useEffect(() => attivaChiusuraFinestre(document), [])
  return null
}
