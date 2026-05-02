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
      console.error(`Sync error [${item.table_name}/${item.record_id}]:`, err)
      await offlineDB.sync_queue.update(item.id!, { retries: item.retries + 1 })
      errors++
    }
  }

  return { synced, errors }
}

async function processQueueItem(item: SyncQueueItem) {
  const payload = JSON.parse(item.payload)
  // Hapus field lokal yang tidak ada di server
  delete payload.sync_status

  if (item.operation === 'insert') {
    const { error } = await supabase.from(item.table_name).upsert(payload)
    if (error) throw error
  } else if (item.operation === 'update') {
    const { error } = await supabase
      .from(item.table_name)
      .upsert(payload)
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
