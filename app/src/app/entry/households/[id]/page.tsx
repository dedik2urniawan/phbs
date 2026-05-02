import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import SurveyHistoryList from '@/components/SurveyHistoryList'

export default async function EntryHouseholdDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?mode=pwa')

  const { data: household } = await supabase
    .from('households')
    .select('*, ref_desa(desa_kel), ref_puskesmas(nama)')
    .eq('id', id)
    .single()

  if (!household) return <div className="p-6">Data tidak ditemukan.</div>

  const { data: members } = await supabase
    .from('family_members')
    .select('*')
    .eq('household_id', id)
    .order('created_at', { ascending: true })

  const { data: surveys } = await supabase
    .from('surveys')
    .select('*')
    .eq('household_id', id)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <Link href="/entry/households" className="text-gray-400 hover:text-gray-600">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-lg font-bold text-gray-800">Detail Rumah Tangga</h1>
      </div>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-xl font-bold mb-4">{household.nama_kk}</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500">No. KK</p>
              <p className="font-medium text-gray-800">{household.no_kk}</p>
            </div>
            <div>
              <p className="text-gray-500">Desa/Kelurahan</p>
              <p className="font-medium text-gray-800">{household.ref_desa?.desa_kel || '-'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-gray-500">Alamat</p>
              <p className="font-medium text-gray-800">{household.alamat} RT {household.rt}/RW {household.rw}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-4">Anggota Keluarga</h3>
          {members && members.length > 0 ? (
            <div className="space-y-3">
              {members.map(m => (
                <div key={m.id} className="p-3 border border-gray-100 rounded-xl bg-gray-50">
                  <p className="font-semibold text-sm">{m.nama}</p>
                  <p className="text-xs text-gray-500">{m.hubungan_kk} • {m.jenis_kelamin}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Belum ada data anggota keluarga.</p>
          )}
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-800 mb-4">Riwayat Survei</h3>
          <SurveyHistoryList surveys={surveys || []} basePath="/entry" />
        </div>
      </div>
    </div>
  )
}
