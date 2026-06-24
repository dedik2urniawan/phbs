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
  const puskesmasId = 'fea8ddc5-9034-4353-8c70-1f882090e63a';

  // Cek jumlah KK terdaftar di Gondanglegi
  const { count: hhCount, error: hhErr } = await supabase
    .from('households')
    .select('*', { count: 'exact', head: true })
    .eq('puskesmas_id', puskesmasId);

  // Cek jumlah Survei yang sudah diinput
  const { count: surveyCount, error: svErr } = await supabase
    .from('surveys')
    .select('*, households!inner(puskesmas_id)', { count: 'exact', head: true })
    .eq('households.puskesmas_id', puskesmasId);

  // Cek Sasaran
  const { data: sasaran, error: sasErr } = await supabase
    .from('sasaran_kk')
    .select('*')
    .eq('puskesmas_id', puskesmasId);

  console.log("=== DATA PUSKESMAS GONDANGLEGI ===");
  console.log(`Jumlah KK Terdaftar (households): ${hhCount}`);
  if (hhErr) console.error("Error HH:", hhErr);
  
  console.log(`Jumlah Survei Diinput (surveys): ${surveyCount}`);
  if (svErr) console.error("Error Survei:", svErr);
  
  console.log(`Data Sasaran 2026:`, sasaran);
  if (sasErr) console.error("Error Sasaran:", sasErr);
}

check();
