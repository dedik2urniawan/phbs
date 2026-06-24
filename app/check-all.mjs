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
  // Cek jumlah Total KK terdaftar se Kabupaten
  const { count: hhCount } = await supabase
    .from('households')
    .select('*', { count: 'exact', head: true });

  // Cek jumlah Survei yang sudah diinput se Kabupaten
  const { count: surveyCount } = await supabase
    .from('surveys')
    .select('*', { count: 'exact', head: true });

  console.log("=== TOTAL DATA DATABASE KABUPATEN ===");
  console.log(`Jumlah KK Terdaftar (households): ${hhCount}`);
  console.log(`Jumlah Survei Diinput (surveys): ${surveyCount}`);
}

check();
