import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  await supabase.auth.signInWithPassword({
    email: 'pkmsingosari@dinkes.go.id',
    password: 'PasswordPHBS2026!'
  });

  const { data: user } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('app_users')
    .select('*, ref_puskesmas(id, nama, kecamatan)')
    .eq('id', user.user.id)
    .single();
    
  console.log('Result:', JSON.stringify(data, null, 2));
  console.log('Error:', error);
}

test();
