import { useEffect } from 'react'

/**
 * Hook per bloccare/sbloccare lo scroll del body quando un modal è aperto
 *
 * @param isLocked - true per bloccare lo scroll, false per sbloccarlo
 *
 * Usage:
 * const MyModal = ({ isOpen, onClose }) => {
 *   useScrollLock(isOpen)
 *   // resto del component...
 * }
 */
export function useScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (isLocked) {
      // Salva lo stato originale
      const originalStyle = window.getComputedStyle(document.body).overflow
      const originalPaddingRight = window.getComputedStyle(document.body).paddingRight

      // Controlla se c'è una scrollbar verticale
      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth

      // Blocca scroll e compensa la scrollbar per evitare layout shift
      document.body.style.overflow = 'hidden'
      if (scrollBarWidth > 0) {
        document.body.style.paddingRight = `${parseInt(originalPaddingRight) + scrollBarWidth}px`
      }

      // Cleanup function per ripristinare lo stato originale
      return () => {
        document.body.style.overflow = originalStyle
        document.body.style.paddingRight = originalPaddingRight
      }
    }
  }, [isLocked])
}