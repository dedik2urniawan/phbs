import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Baca variabel dari .env.local secara otomatis
config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: Variabel SUPABASE tidak ditemukan. Pastikan file .env.local sudah ada.');
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Data user dari app_users_rows.sql
const usersToCreate = [
  { email: 'pkmsumawe@dinkes.go.id', role: 'admin_puskesmas', puskesmas_id: '542381f1-6468-4166-b964-59aeea6b6695' },
  { email: 'pkmsingosari@dinkes.go.id', role: 'admin_puskesmas', puskesmas_id: '27a3baa6-5a92-4dde-b030-ad4ca94f94de' },
  { email: 'pkmpakis@dinkes.go.id', role: 'admin_puskesmas', puskesmas_id: '3ed11429-7aff-4e1c-bbb1-d1d38cce7e23' },
  { email: 'pkmgedangan@dinkes.go.id', role: 'admin_puskesmas', puskesmas_id: 'f78b223d-44d8-419d-bb43-0d8017e91bbc' },
  { email: 'pkmkalipare@dinkes.go.id', role: 'admin_puskesmas', puskesmas_id: '96e5e813-361f-4ae4-a70c-f1be71a25767' },
  { email: 'pkmdampit@dinkes.go.id', role: 'admin_puskesmas', puskesmas_id: '4124c822-de78-488e-9bca-f6a24b9009e2' },
  { email: 'pkmngantang@dinkes.go.id', role: 'admin_puskesmas', puskesmas_id: '09f59c5c-475b-41f5-a4a5-1bb9fb9c0f37' },
  { email: 'pkmkasembon@dinkes.go.id', role: 'admin_puskesmas', puskesmas_id: '7ec2cf81-b131-4eb4-8a31-934bc3a33900' },
  { email: 'pkmtajinan@dinkes.go.id', role: 'admin_puskesmas', puskesmas_id: '152cd4bd-40c3-4944-95eb-58aa3c8c6dbd' },
  { email: 'pkmkepanjen@dinkes.go.id', role: 'admin_puskesmas', puskesmas_id: 'cd9d574b-a04b-4c58-873e-cbbbda400a3d' },
  { email: 'pkmketawang@dinkes.go.id', role: 'admin_puskesmas', puskesmas_id: 'a250433b-8fe7-4f1f-9797-a35d0bc695d1' },
  { email: 'pkmwagir@dinkes.go.id', role: 'admin_puskesmas', puskesmas_id: '8dc09f8d-fbef-46b2-b970-f481c5a37b66' },
  { email: 'pkmpagak@dinkes.go.id', role: 'admin_puskesmas', puskesmas_id: 'bff0162d-ea37-4e8f-8068-c32e261b177e' },
  { email: 'pkmjabung@dinkes.go.id', role: 'admin_puskesmas', puskesmas_id: '6fdc0020-14f9-489f-9f2f-1d9dda000e01' },
  { email: 'pkmsitiarjo@dinkes.go.id', role: 'admin_puskesmas', puskesmas_id: '7495393d-b686-4a35-9823-7f79bcb46562' },
  { email: 'pkmgondanglegi@dinkes.go.id', role: 'admin_puskesmas', puskesmas_id: 'fea8ddc5-9034-4353-8c70-1f882090e63a' },
  { email: 'pkmdonomulyo@dinkes.go.id', role: 'admin_puskesmas', puskesmas_id: 'b5ee7789-bc2a-4539-9352-7c07a6cdcad4' },
  { email: 'pkmbululawang@dinkes.go.id', role: 'admin_puskesmas', puskesmas_id: '4ff0f1a0-ec69-4607-91f0-a4161ecbc357' },
  { email: 'admin@dinkes.go.id', role: 'superadmin', puskesmas_id: 'a3526e02-6f80-46ff-8b8e-1ee892400c0a' },
  { email: 'pkmpagelaran@dinkes.go.id', role: 'admin_puskesmas', puskesmas_id: 'ed08540b-401d-45a8-8d26-430f8beacebf' },
  { email: 'pkmampelgading@dinkes.go.id', role: 'admin_puskesmas', puskesmas_id: '43c02baf-e191-4eca-925f-2c1e244a1839' },
  { email: 'pkmponcokusumo@dinkes.go.id', role: 'admin_puskesmas', puskesmas_id: '4cfada23-0758-4eae-adb0-01ae0ee99c39' },
  { email: 'pkmwonosari@dinkes.go.id', role: 'admin_puskesmas', puskesmas_id: '44b47107-4539-4ef0-a5e8-168637f8611c' },
  { email: 'pkmbantur@dinkes.go.id', role: 'admin_puskesmas', puskesmas_id: 'e8765193-ec68-460e-953d-5eeb203d9f8e' },
  { email: 'pkmngajum@dinkes.go.id', role: 'admin_puskesmas', puskesmas_id: '9965efd3-3a49-465b-8425-ca1a1eeec2d6' },
  { email: 'pkmtumpang@dinkes.go.id', role: 'admin_puskesmas', puskesmas_id: '37672525-b536-45b5-b7d4-a761d0434575' },
  { email: 'pkmwajak@dinkes.go.id', role: 'admin_puskesmas', puskesmas_id: '60e32b67-d8c4-44d4-b768-ed72d0f17229' },
  { email: 'pkmardimulyo@dinkes.go.id', role: 'admin_puskesmas', puskesmas_id: '053fa830-5d1b-4bce-bcf7-765abd77aada' },
  { email: 'pkmpamotan@dinkes.go.id', role: 'admin_puskesmas', puskesmas_id: '4f7c18a3-d2ea-4163-80d8-dd1ac2c17ba3' },
  { email: 'pkmpujon@dinkes.go.id', role: 'admin_puskesmas', puskesmas_id: '15ceb43f-85d0-4885-9660-094521612b2f' },
  { email: 'pkmdau@dinkes.go.id', role: 'admin_puskesmas', puskesmas_id: 'fcddf3dc-919c-4eb5-9009-856d4f982cfc' },
  { email: 'pkmtirtoyudo@dinkes.go.id', role: 'admin_puskesmas', puskesmas_id: '1c57a433-9f3b-42d2-b3ce-69ce451608f6' },
  { email: 'stakeholder@dinkes.go.id', role: 'stakeholder', puskesmas_id: null },
  { email: 'pkmwonokerto@dinkes.go.id', role: 'admin_puskesmas', puskesmas_id: '5fae5c7b-dda6-4893-aaf0-f6e3add5c575' },
  { email: 'pkmsumberpucung@dinkes.go.id', role: 'admin_puskesmas', puskesmas_id: '107781a1-aab9-4d61-bae8-fdbbaa505aef' },
  { email: 'pkmlawang@dinkes.go.id', role: 'admin_puskesmas', puskesmas_id: '1a9c2695-99b9-42a5-ae7b-e3b471e7fcf0' },
  { email: 'pkmkarangploso@dinkes.go.id', role: 'admin_puskesmas', puskesmas_id: '6a0aadd8-836a-4b97-809b-28112d78c329' },
  { email: 'pkmkromengan@dinkes.go.id', role: 'admin_puskesmas', puskesmas_id: '8e08c6f6-d238-4a40-906b-513867668a12' },
  { email: 'pkmturen@dinkes.go.id', role: 'admin_puskesmas', puskesmas_id: '6c872b8e-60a4-449e-b940-eaf3e46a43e2' },
  { email: 'pkmpakisaji@dinkes.go.id', role: 'admin_puskesmas', puskesmas_id: '01d7b4ca-4879-47c7-a35d-e65d55d64063' },
  { email: 'pkmsumakul@dinkes.go.id', role: 'admin_puskesmas', puskesmas_id: '16abf709-2c0e-4141-8397-f67628f3989c' }
];

const DEFAULT_PASSWORD = 'PasswordPHBS2026!'; // Password default untuk semua puskesmas

async function seedUsers() {
  console.log(`Mulai membuat ${usersToCreate.length} users di Supabase Auth...`);
  let successCount = 0;
  
  for (const user of usersToCreate) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: user.email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: {
        role: user.role,
        puskesmas_id: user.puskesmas_id
      }
    });

    if (error) {
      if (error.message.includes('already exists') || error.message.includes('registered')) {
        console.log(`[SKIPPED] ${user.email} sudah terdaftar.`);
      } else {
        console.error(`[ERROR] Gagal membuat ${user.email}:`, error.message);
      }
    } else {
      console.log(`[SUCCESS] User dibuat: ${user.email}`);
      successCount++;
    }
  }

  console.log(`Selesai! ${successCount} user baru berhasil ditambahkan.`);
  console.log(`Catatan: Tabel public.app_users otomatis terisi karena kita punya trigger handle_new_user.`);
}

seedUsers();
