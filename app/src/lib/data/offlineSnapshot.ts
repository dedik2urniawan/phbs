import fs from 'fs'
import path from 'path'

export function isOfflineSnapshotMode(): boolean {
  if (process.env.OFFLINE_SNAPSHOT_MODE === 'true') return true
  if (process.env.NEXT_PUBLIC_OFFLINE_SNAPSHOT_MODE === 'true') return true
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return true
  }
  return false
}

let cachedSnapshot: any = null

export function loadSnapshot(): any {
  if (cachedSnapshot) return cachedSnapshot
  const filePath = path.join(process.cwd(), 'public', 'data', 'phbs-snapshot-2026.json')
  const raw = fs.readFileSync(filePath, 'utf-8')
  cachedSnapshot = JSON.parse(raw)
  return cachedSnapshot
}

export function getSnapshotViewerUser() {
  const snap = loadSnapshot()
  const dinkes = (snap.ref_puskesmas || []).find(
    (p: any) => p.nama && p.nama.toLowerCase().includes('dinkes')
  )
  return {
    id: 'snapshot-viewer',
    email: 'paparan@dinkes-malangkab.go.id',
    nama_lengkap: 'Paparan PHBS Kab. Malang',
    role: 'superadmin',
    puskesmas_id: dinkes?.id || null,
    is_active: true,
    ref_puskesmas: dinkes || {
      id: 'dinkes',
      nama: 'DINKES',
      kecamatan: 'KABUPATEN',
      is_active: true,
    },
  }
}

export function getSnapshotRefData() {
  const snap = loadSnapshot()
  return {
    refPuskesmas: snap.ref_puskesmas || [],
    refDesa: snap.ref_desa || [],
  }
}

export function getSnapshotSasaran(tahun?: number, puskesmasId?: string | null) {
  const snap = loadSnapshot()
  let list = snap.sasaran_kk || []
  if (tahun) {
    list = list.filter((s: any) => Number(s.tahun) === Number(tahun))
  }
  if (puskesmasId) {
    list = list.filter((s: any) => String(s.puskesmas_id) === String(puskesmasId))
  }
  return list
}

export function getSnapshotDashboardAggregates(tahun: number = 2026, puskesmasId?: string | null) {
  const snap = loadSnapshot()
  if (!puskesmasId) {
    return {
      tahun,
      puskesmas_id_filter: null,
      global: snap.global,
      by_puskesmas: snap.by_puskesmas || [],
      by_desa: snap.by_desa || [],
      top_kader: (snap.top_kader || []).slice(0, 20),
    }
  }

  const pkm = (snap.by_puskesmas || []).find(
    (p: any) => String(p.puskesmas_id) === String(puskesmasId)
  )
  const desaList = (snap.by_desa || []).filter(
    (d: any) => String(d.puskesmas_id) === String(puskesmasId)
  )
  const topKader = (snap.top_kader || [])
    .filter((k: any) => String(k.puskesmas_id) === String(puskesmasId))
    .slice(0, 20)

  return {
    tahun,
    puskesmas_id_filter: puskesmasId,
    global: pkm || snap.global,
    by_puskesmas: pkm ? [pkm] : [],
    by_desa: desaList,
    top_kader: topKader,
  }
}

export function getSnapshotAnalysisAnalytics(tahun: number = 2026, puskesmasId?: string | null) {
  const snap = loadSnapshot()
  if (puskesmasId && snap.analytics_by_puskesmas?.[puskesmasId]) {
    return snap.analytics_by_puskesmas[puskesmasId]
  }
  return snap.analytics_global
}
