'use client'

import { useState, useEffect } from 'react'

// Detect iOS Safari
function isIosSafari(): boolean {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent
  const isIos = /iphone|ipad|ipod/i.test(ua)
  // standalone mode means already installed
  const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator as any).standalone
  return isIos && !isInStandaloneMode
}

function isAlreadyInstalled(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(display-mode: standalone)').matches
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showAndroidPrompt, setShowAndroidPrompt] = useState(false)
  const [showIosPrompt, setShowIosPrompt] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('SW registration failed:', err)
      })
    }

    // Don't show if already installed
    if (isAlreadyInstalled()) return

    // Check if user already dismissed this session
    const wasDismissed = sessionStorage.getItem('pwa_prompt_dismissed')
    if (wasDismissed) return

    // Android/Desktop Chrome
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowAndroidPrompt(true)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // iOS Safari - show after a short delay
    if (isIosSafari()) {
      const timer = setTimeout(() => setShowIosPrompt(true), 2000)
      return () => {
        window.removeEventListener('beforeinstallprompt', handler)
        clearTimeout(timer)
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const handleDismiss = () => {
    setShowAndroidPrompt(false)
    setShowIosPrompt(false)
    setDismissed(true)
    sessionStorage.setItem('pwa_prompt_dismissed', '1')
  }

  const handleInstallClick = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setShowAndroidPrompt(false)
    }
    setDeferredPrompt(null)
  }

  if (dismissed) return null

  // Android / Desktop Chrome prompt
  if (showAndroidPrompt) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 bg-white border border-emerald-100 p-4 rounded-2xl shadow-xl flex items-center justify-between gap-4 animate-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-xl shadow-sm">🏠</div>
          <div>
            <h4 className="font-bold text-gray-800 text-sm">Install Aplikasi SIM-PHBS</h4>
            <p className="text-xs text-gray-500">Pasang di layar utama agar bisa diakses offline.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleDismiss} className="text-xs font-medium text-gray-400 hover:text-gray-600 px-2 py-2">
            Nanti
          </button>
          <button onClick={handleInstallClick} className="text-xs font-medium bg-emerald-600 text-white px-4 py-2 rounded-xl shadow-sm hover:bg-emerald-700 transition-colors">
            Install
          </button>
        </div>
      </div>
    )
  }

  // iOS Safari - manual instruction
  if (showIosPrompt) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 bg-white border border-emerald-100 p-4 rounded-2xl shadow-xl animate-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-base">🏠</div>
            <h4 className="font-bold text-gray-800 text-sm">Install Aplikasi SIM-PHBS</h4>
          </div>
          <button onClick={handleDismiss} className="text-gray-400 hover:text-gray-600 text-lg font-bold leading-none">×</button>
        </div>
        <p className="text-xs text-gray-600 leading-relaxed">
          Untuk install di iPhone/iPad: tekan tombol{' '}
          <span className="inline-flex items-center gap-1 font-bold text-emerald-700">Share ⎋</span>{' '}
          di bagian bawah Safari, lalu pilih{' '}
          <span className="font-bold text-emerald-700">"Add to Home Screen"</span>.
        </p>
      </div>
    )
  }

  return null
}
