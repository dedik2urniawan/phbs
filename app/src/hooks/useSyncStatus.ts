'use client'

import { useEffect, useState } from 'react'
import { syncToServer, getPendingSyncCount, syncReferenceData, getDeadLetterCount, retryDeadLetterQueue } from '@/lib/db/sync'

interface SyncStatus {
  isOnline: boolean
  pendingCount: number
  deadLetterCount: number
  lastSync: Date | null
  isSyncing: boolean
}

export function useSyncStatus(): SyncStatus & { triggerSync: () => void; retryDLQ: () => void } {
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: true,
    pendingCount: 0,
    deadLetterCount: 0,
    lastSync: null,
    isSyncing: false,
  })

  const refreshPending = async () => {
    const [count, dlqCount] = await Promise.all([
      getPendingSyncCount(),
      getDeadLetterCount(),
    ])
    setStatus(prev => ({ ...prev, pendingCount: count, deadLetterCount: dlqCount }))
  }

  const triggerSync = async () => {
    if (!navigator.onLine || status.isSyncing) return
    setStatus(prev => ({ ...prev, isSyncing: true }))
    await syncToServer()
    await syncReferenceData()
    await refreshPending()
    setStatus(prev => ({ ...prev, isSyncing: false, lastSync: new Date() }))
  }

  useEffect(() => {
    // Initial status
    setStatus(prev => ({ ...prev, isOnline: navigator.onLine }))
    refreshPending()

    // Network listeners
    const handleOnline = async () => {
      setStatus(prev => ({ ...prev, isOnline: true }))
      // Auto-sync saat kembali online
      await triggerSync()
    }
    const handleOffline = () => {
      setStatus(prev => ({ ...prev, isOnline: false }))
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Poll pending count setiap 30 detik
    const interval = setInterval(refreshPending, 30000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const retryDLQ = async () => {
    if (!navigator.onLine || status.isSyncing) return
    await retryDeadLetterQueue()
    await triggerSync()
  }

  return { ...status, triggerSync, retryDLQ }
}
