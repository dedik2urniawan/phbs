'use client'

import { useState, useEffect } from 'react'

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('SW registration failed:', err)
      })
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowPrompt(true)
    }

    window.addEventListener('beforeinstallprompt', handler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShowPrompt(false)
    }
    setDeferredPrompt(null)
  }

  if (!showPrompt) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 bg-white border border-emerald-100 p-4 rounded-2xl shadow-xl flex items-center justify-between gap-4">
      <div>
        <h4 className="font-bold text-gray-800 text-sm">Install Aplikasi PHBS</h4>
        <p className="text-xs text-gray-500">Pasang di layar utama agar bisa diakses offline.</p>
      </div>
      <div className="flex gap-2">
        <button onClick={() => setShowPrompt(false)} className="text-xs font-medium text-gray-400 hover:text-gray-600 px-2 py-2">
          Nanti
        </button>
        <button onClick={handleInstallClick} className="text-xs font-medium bg-emerald-600 text-white px-4 py-2 rounded-xl shadow-sm">
          Install
        </button>
      </div>
    </div>
  )
}
