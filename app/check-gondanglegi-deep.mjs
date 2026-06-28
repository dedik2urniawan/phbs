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
  // Cek apakah ada lebih dari satu Puskesmas dengan nama mirip "Gondanglegi"
  const { data: puskesmas, error: pErr } = await supabase
    .from('ref_puskesmas')
    .select('*')
    .ilike('nama', '%Gondanglegi%');
    
  console.log("=== PENCARIAN NAMA PUSKESMAS GONDANGLEGI ===");
  console.log(puskesmas);

  if (puskesmas && puskesmas.length > 0) {
    for (const p of puskesmas) {
      console.log(`\n=== DATA UNTUK PUSKESMAS ID: ${p.id} (${p.nama}) ===`);
      const { count: hhCount } = await supabase
        .from('households')
        .select('*', { count: 'exact', head: true })
        .eq('puskesmas_id', p.id);
        
      const { count: svCount } = await supabase
        .from('surveys')
        .select('*, households!inner(puskesmas_id)', { count: 'exact', head: true })
        .eq('households.puskesmas_id', p.id);
        
      console.log(`- Jumlah KK: ${hhCount}`);
      console.log(`- Jumlah Survei: ${svCount}`);
    }
  }

  // Cek 10 KK terbaru yang dimasukkan hari ini, untuk melihat ID puskesmas mereka
  const { data: recentHh } = await supabase
    .from('households')
    .select('id, puskesmas_id, created_at, ref_puskesmas(nama)')
    .order('created_at', { ascending: false })
    .limit(10);
    
  console.log("\n=== 10 KK TERBARU DI DATABASE ===");
  console.log(JSON.stringify(recentHh, null, 2));
}

check();
