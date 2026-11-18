import { createClient } from '@/lib/supabase/server'
import { getSnapshotViewerUser, isOfflineSnapshotMode } from '@/lib/data/offlineSnapshot'

export async function getServerAppUser(): Promise<any | null> {
  if (isOfflineSnapshotMode()) {
    return getSnapshotViewerUser()
  }

  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return null

  const { data: appUser } = await supabase
    .from('app_users')
    .select('*, ref_puskesmas(id, nama, kecamatan, is_active)')
    .eq('id', user.id)
    .single()

  return appUser
}
