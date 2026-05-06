'use client'

import { useEffect } from 'react'

/**
 * Component to disable mouse wheel scroll on number inputs globally
 * Prevents accidental value changes when scrolling over numeric fields
 */
export default function DisableNumberInputScroll() {
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement

      // Check if the target is a number input
      if (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'number') {
        // Blur the input to prevent value change
        (target as HTMLInputElement).blur()
        // Optionally prevent the default scroll behavior
        e.preventDefault()
      }
    }

    // Add event listener to document
    document.addEventListener('wheel', handleWheel, { passive: false })

    // Cleanup on unmount
    return () => {
      document.removeEventListener('wheel', handleWheel)
    }
  }, [])

  // This component doesn't render anything
  return null
}
