'use client'

import { useSyncStatus } from '@/hooks/useSyncStatus'

export default function SyncStatusBar() {
  const { isOnline, pendingCount, deadLetterCount, isSyncing, lastSync, triggerSync, retryDLQ } = useSyncStatus()

  // Jika ada dead letter, tampilkan peringatan khusus (prioritas tertinggi)
  if (deadLetterCount > 0 && isOnline && !isSyncing) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span>{deadLetterCount} data gagal sync</span>
        <button
          onClick={retryDLQ}
          className="underline hover:no-underline ml-1 font-semibold"
        >
          Coba Ulang
        </button>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
      isOnline 
        ? pendingCount > 0 
          ? 'bg-amber-100 text-amber-700 border border-amber-200' 
          : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
        : 'bg-red-100 text-red-700 border border-red-200'
    }`}>
      {/* Status indicator dot */}
      <span className={`w-2 h-2 rounded-full ${
        isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
      }`} />

      {isSyncing ? (
        <>
          <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          Menyinkronkan...
        </>
      ) : isOnline ? (
        <>
          {pendingCount > 0 ? (
            <>
              <span>{pendingCount} belum tersinkron</span>
              <button 
                onClick={triggerSync}
                className="underline hover:no-underline ml-1"
              >
                Sync sekarang
              </button>
            </>
          ) : (
            <span>
              {lastSync 
                ? `Tersinkron ${lastSync.toLocaleTimeString('id')}` 
                : 'Online'}
            </span>
          )}
        </>
      ) : (
        <span>Offline — data tersimpan lokal</span>
      )}
    </div>
  )
}
