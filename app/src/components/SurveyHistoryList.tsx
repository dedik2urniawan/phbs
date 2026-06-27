'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { offlineDB } from '@/lib/db/offline'

interface Survey {
  id: string
  created_at: string
  sync_status?: string
  [key: string]: any
}

function calculateSkor(s: Survey) {
  if (s.skor_phbs !== undefined && s.skor_phbs !== null && s.denominator_phbs) {
    return Math.round((s.skor_phbs / s.denominator_phbs) * 100)
  }
  // Legacy fallback
  const boolKeys = ['i4_air_bersih','i5_cuci_tangan','i6_jamban_sehat','i7_psn',
    'i8_makan_sayur_buah','i9_aktivitas_fisik','i10_tidak_merokok','i11_cek_kesehatan',
    'i12_kunjungan_posyandu','i14_ibu_hamil','i16_remaja_putri']
  const nullableKeys = ['i1_persalinan_nakes','i2_asi_eksklusif','i3_menimbang_balita',
    'i15_ibu_hamil_ttd','i17_remaja_putri_ttd']
  let total = 0; let max = 0;
  boolKeys.forEach(k => { max++; if (s[k]) total++ })
  nullableKeys.forEach(k => { 
    if (s[k] !== undefined && s[k] !== null) { max++; if (s[k]) total++ }
  })
  return max > 0 ? Math.round((total/max)*100) : 0
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
      // FIX FK VIOLATION: Hapus child (survey_art_responses) terlebih dahulu
      await supabase.from('survey_art_responses').delete().eq('survey_id', id);
      const { error } = await supabase.from('surveys').delete().eq('id', id);
      
      if (error) {
        alert('Gagal menghapus survei di server: ' + error.message)
        // Revert UI? For simplicity, we just reload or let user refresh
        router.refresh()
      } else {
        // Hapus juga di lokal jika ada
        try { 
          await offlineDB.survey_art_responses.where('survey_id').equals(id).delete()
          await offlineDB.surveys.delete(id) 
        } catch (e) {}
      }
    } else {
      // Offline delete: Just delete from local if it's pending. If it was already synced, we can't reliably delete it offline without queuing a delete action. For now, offline delete deletes local.
      try { 
        await offlineDB.survey_art_responses.where('survey_id').equals(id).delete()
        await offlineDB.surveys.delete(id) 
      } catch (e) {}
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
            <p className="font-semibold text-sm text-gray-800">Skor PHBS: <span className="text-blue-700">{calculateSkor(s)}</span></p>
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
