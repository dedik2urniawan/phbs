import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import EditMemberClient from '@/app/dashboard/households/[id]/members/[memberId]/edit/EditMemberClient'

export default async function EditMemberPage({ params }: { params: Promise<{ id: string, memberId: string }> }) {
  const { id, memberId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?mode=pwa')

  const { data: household } = await supabase
    .from('households')
    .select('nama_kk')
    .eq('id', id)
    .single()

  const { data: member } = await supabase
    .from('family_members')
    .select('*')
    .eq('id', memberId)
    .single()

  if (!household || !member) {
    return <div className="p-6">Data anggota keluarga tidak ditemukan.</div>
  }

  return <EditMemberClient member={member} householdId={id} nama_kk={household.nama_kk} basePath="/entry" />
}
