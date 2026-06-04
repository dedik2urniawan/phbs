const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
  const { data, error } = await supabase.from('kader_phbs').select('*');
  if (error) {
    console.error("Error fetching kader_phbs:", error);
    return;
  }
  console.log("Total Kader:", data.length);
  const putatLor = data.filter(k => k.nama_kader && k.nama_kader.includes('TES'));
  console.log("Putat Lor Kader:", putatLor);
}
checkData();
