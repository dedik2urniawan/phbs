import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const gondanglegiId = 'fea8ddc5-9034-4353-8c70-1f882090e63a';

  // 1. Cek Kader di Gondanglegi
  const { data: kader } = await supabase
    .from('kader_phbs')
    .select('id, nama_kader, puskesmas_id, created_at')
    .eq('puskesmas_id', gondanglegiId);
    
  console.log(`=== JUMLAH KADER GONDANGLEGI: ${kader?.length || 0} ===`);
  
  // 2. Cek apakah ada household dari Kader Gondanglegi? (Barangkali puskesmas_id di household NULL/salah)
  if (kader && kader.length > 0) {
    const kaderIds = kader.map(k => k.id);
    
    const { count: hhCount, data: hhData } = await supabase
      .from('surveys')
      .select('household_id, kader_id, created_at', { count: 'exact' })
      .in('kader_id', kaderIds);
      
    console.log(`=== JUMLAH SURVEI OLEH KADER GONDANGLEGI: ${hhCount} ===`);
    if (hhCount > 0) {
        console.log(`Contoh survei:`, hhData.slice(0, 3));
    }
  }

  // 3. Cek apakah ada households dengan user_id dari Gondanglegi?
  const { data: users } = await supabase
    .from('users')
    .select('id, email, puskesmas_id')
    .eq('puskesmas_id', gondanglegiId);

  console.log(`=== JUMLAH USER ADMIN/KADER GONDANGLEGI (users table): ${users?.length || 0} ===`);

  if (users && users.length > 0) {
    const userIds = users.map(u => u.id);
    const { count: hhByUser } = await supabase
      .from('households')
      .select('id', { count: 'exact', head: true })
      .in('created_by', userIds);
      
    console.log(`=== JUMLAH KK DIBUAT OLEH USER GONDANGLEGI: ${hhByUser} ===`);
  }
}

check();
