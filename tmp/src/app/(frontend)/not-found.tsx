'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NotFound() {
  const router = useRouter()
  const [canGoBack, setCanGoBack] = useState(false)

  useEffect(() => {
    // Check if there's a history to go back to
    // window.history.length > 2 because:
    // - length 1 = only current page (no history)
    // - length 2+ = has previous pages to go back to
    const hasHistory = window.history.length > 2
    
    // Also check if referrer is from same origin
    const referrer = document.referrer
    const isSameOrigin = referrer ? new URL(referrer).origin === window.location.origin : false

    setCanGoBack(hasHistory || isSameOrigin)
  }, [])

  const handleNavigation = () => {
    if (canGoBack) {
      router.back()
    } else {
      router.push('/')
    }
  }

  return (
    <div className="page-wrapper">
      <header>
        <h1>404</h1>
        <h2 className="subheading">Page not found</h2>
      </header>

      <main>
        <section>
          <p style={{ marginBottom: '1.5rem' }}>
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
          <button
            onClick={handleNavigation}
            className="inline-flex items-center justify-center whitespace-nowrap rounded text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 w-fit"
          >
            {canGoBack ? '← Go back' : '→ Go home'}
          </button>
        </section>
      </main>
    </div>
  )
}
