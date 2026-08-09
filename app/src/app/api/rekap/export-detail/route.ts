import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCachedRekapSurveysWithART } from '@/lib/data/dashboard'

/**
 * API Route: /api/rekap/export-detail
 * Generates the full KK+ART detail Excel data on-demand (heavy query with ART join).
 * Called by RekapClient when user clicks "Unduh Detail KK & ART (Excel)".
 * Returns JSON array of survey rows with nested ART responses.
 *
 * This avoids loading 135K+ survey rows WITH ART responses on every page load,
 * which was causing the 40K row truncation bug.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const tahun = parseInt(searchParams.get('tahun') || String(new Date().getFullYear()))
  const puskesmasId = searchParams.get('puskesmas_id') || null

  // Authorization: non-superadmin can only fetch their own puskesmas
  const { data: appUser } = await supabase
    .from('app_users')
    .select('role, puskesmas_id')
    .eq('id', session.user.id)
    .single()

  const isSuperAdmin = appUser?.role === 'superadmin'
  const effectivePkmId = isSuperAdmin ? puskesmasId : appUser?.puskesmas_id

  try {
    const data = await getCachedRekapSurveysWithART(tahun, effectivePkmId || null)
    return NextResponse.json({ data, count: data.length })
  } catch (err: any) {
    console.error('[export-detail] Error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
