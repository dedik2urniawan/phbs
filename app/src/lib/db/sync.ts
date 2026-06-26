'use client'

import { createClient } from '@/lib/supabase/client'
import { offlineDB, SyncQueueItem } from './offline'

const supabase = createClient()

export async function isOnline(): Promise<boolean> {
  return navigator.onLine
}

/**
 * Sinkronisasi semua pending records ke Supabase.
 * Dipanggil saat: (1) login, (2) kembali online, (3) manual trigger
 */
export async function syncToServer(): Promise<{ synced: number; errors: number }> {
  if (!(await isOnline())) return { synced: 0, errors: 0 }

  const queue = await offlineDB.sync_queue
    .orderBy('created_at')
    .filter(q => q.retries < 3)
    .toArray()

  let synced = 0
  let errors = 0

  for (const item of queue) {
    try {
      await processQueueItem(item)
      await offlineDB.sync_queue.delete(item.id!)
      synced++
    } catch (err) {
      console.error(`Sync error [${item.table_name}/${item.record_id}]:`, (err as any)?.message || JSON.stringify(err) || err)
      await offlineDB.sync_queue.update(item.id!, { retries: item.retries + 1 })
      errors++
    }
  }

  return { synced, errors }
}

/**
 * Download data referensi (seperti kader_phbs) dari server ke lokal (Dexie)
 * Dipanggil saat pertama kali buka aplikasi PWA
 */
export async function syncReferenceData(): Promise<void> {
  if (!(await isOnline())) return

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: appUser } = await supabase
      .from('app_users')
      .select('puskesmas_id, role')
      .eq('id', user.id)
      .single()

    let query = supabase
      .from('kader_phbs')
      .select('id, puskesmas_id, desa_id, nama_kader, created_at')
      .limit(10000)
    
    if (appUser && appUser.role !== 'superadmin' && appUser.puskesmas_id) {
      query = query.eq('puskesmas_id', appUser.puskesmas_id)
    }

    const { data: kaderData, error } = await query
    
    if (error) throw error
    if (kaderData) {
      await offlineDB.kader_phbs.clear()
      await offlineDB.kader_phbs.bulkAdd(kaderData)
    }
  } catch (err) {
    console.error('Gagal sync data referensi kader:', err)
  }
}

async function processQueueItem(item: SyncQueueItem) {
  const payload = JSON.parse(item.payload)
  // Hapus field lokal yang tidak ada di server
  delete payload.sync_status

  if (item.operation === 'insert' || item.operation === 'update') {
    let upsertOpts = undefined
    if (item.table_name === 'households') {
      upsertOpts = { onConflict: 'no_kk, puskesmas_id' }
    } else if (item.table_name === 'family_members' && payload.nik) {
      upsertOpts = { onConflict: 'nik' }
    } else if (item.table_name === 'surveys') {
      upsertOpts = { onConflict: 'household_id, tahun' }
    } else if (item.table_name === 'survey_art_responses') {
      upsertOpts = { onConflict: 'survey_id, family_member_id' }
    }

    const { error } = await supabase.from(item.table_name).upsert(payload, upsertOpts)
    if (error) throw error
  } else if (item.operation === 'delete') {
    const { error } = await supabase
      .from(item.table_name)
      .delete()
      .eq('id', item.record_id)
    if (error) throw error
  }

  // Update sync_status di local DB
  const table = offlineDB.table(item.table_name)
  await table.update(item.record_id, { sync_status: 'synced' })
}

/**
 * Tambah item ke antrian sync
 */
export async function enqueueSync(
  tableName: string,
  recordId: string,
  operation: 'insert' | 'update' | 'delete',
  payload: object
) {
  await offlineDB.sync_queue.add({
    table_name: tableName,
    record_id: recordId,
    operation,
    payload: JSON.stringify(payload),
    created_at: new Date().toISOString(),
    retries: 0,
  })
}

/**
 * Hitung pending syncs
 */
export async function getPendingSyncCount(): Promise<number> {
  return offlineDB.sync_queue.count()
}
