'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { offlineDB } from '@/lib/db/offline'

interface Survey {
  id: string
  skor: number
  created_at: string
  sync_status?: string
}

export default function SurveyHistoryList({ surveys: initialSurveys, basePath }: { surveys: Survey[], basePath: string }) {
  const [surveys, setSurveys] = useState(initialSurveys)
  const supabase = createClient()
  const router = useRouter()

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus survei ini? Data tidak dapat dikembalikan.')) return;
    
    // Optimistic delete
    setSurveys(prev => prev.filter(s => s.id !== id))
    
    if (navigator.onLine) {
      const { error } = await supabase.from('surveys').delete().eq('id', id);
      if (error) {
        alert('Gagal menghapus survei di server: ' + error.message)
        // Revert UI? For simplicity, we just reload or let user refresh
        router.refresh()
      } else {
        // Hapus juga di lokal jika ada
        try { await offlineDB.surveys.delete(id) } catch (e) {}
      }
    } else {
      // Offline delete: Just delete from local if it's pending. If it was already synced, we can't reliably delete it offline without queuing a delete action. For now, offline delete deletes local.
      try { await offlineDB.surveys.delete(id) } catch (e) {}
      alert('Anda sedang offline. Survei dihapus secara lokal. Jika survei sudah tersinkron sebelumnya, akan tetap ada di server sampai dihapus saat online.')
    }
  }

  if (!surveys || surveys.length === 0) {
    return <p className="text-sm text-gray-500">Belum ada data survei.</p>
  }

  return (
    <div className="space-y-3">
      {surveys.map(s => (
        <div key={s.id} className="p-4 border border-gray-100 rounded-xl bg-blue-50/50 hover:shadow-sm transition-all flex justify-between items-center">
          <div>
            <p className="font-semibold text-sm text-gray-800">Skor PHBS: <span className="text-blue-700">{s.skor ?? '-'}</span></p>
            <p className="text-xs text-gray-500 mt-1">{new Date(s.created_at).toLocaleDateString('id-ID', { dateStyle: 'medium' })}</p>
            {s.sync_status === 'pending' && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded mt-1 inline-block">Pending Sync</span>}
          </div>
          <div className="flex gap-2">
            <Link href={`${basePath}/survey/${s.id}/edit`}
              className="text-xs bg-amber-100 text-amber-700 hover:bg-amber-200 px-3 py-1.5 rounded-lg font-medium transition-colors">
              Edit
            </Link>
            <button onClick={() => handleDelete(s.id)}
              className="text-xs bg-red-100 text-red-700 hover:bg-red-200 px-3 py-1.5 rounded-lg font-medium transition-colors">
              Hapus
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
