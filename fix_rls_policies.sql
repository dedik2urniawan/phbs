-- =================================================================================
-- 🚀 FASE 7: PERBAIKAN RLS (Row-Level Security) UNTUK ATOMIC SYNC
-- =================================================================================
-- Jalankan script ini di SQL Editor Supabase Anda.
-- Script ini akan menghapus kebijakan lama yang tumpang tindih dan 
-- membuat satu kebijakan (Policy) seragam yang mencegah "False Negative" 
-- saat fitur Sync Offline (Atomic RPC) berjalan.

-- 1. Bersihkan Policy Lama yang Berpotensi Bentrok
DROP POLICY IF EXISTS "Enable read access for all users" ON households;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON households;
DROP POLICY IF EXISTS "Enable update for users based on email" ON households;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON households;

DROP POLICY IF EXISTS "Enable read access for all users" ON family_members;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON family_members;
DROP POLICY IF EXISTS "Enable update for users based on email" ON family_members;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON family_members;

DROP POLICY IF EXISTS "Enable read access for all users" ON surveys;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON surveys;
DROP POLICY IF EXISTS "Enable update for users based on email" ON surveys;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON surveys;

DROP POLICY IF EXISTS "Enable read access for all users" ON survey_art_responses;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON survey_art_responses;
DROP POLICY IF EXISTS "Enable update for users based on email" ON survey_art_responses;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON survey_art_responses;


-- 2. Terapkan Policy 'Atomic Sync' (Selaras untuk 4 Tabel Inti)
-- Kebijakan ini memastikan bahwa user yang sudah TER-OTENTIKASI (Login) 
-- memiliki hak penuh pada 4 tabel ini. Keamanan validasi `puskesmas_id` diletakkan 
-- di level Aplikasi (TypeScript) dan RPC, sehingga RLS tidak menghambat (block) 
-- transaksi berantai (FK) saat sinkronisasi data Offline.

-- HOUSEHOLDS
CREATE POLICY "Atomic_Sync_Policy_Households" 
ON households FOR ALL TO authenticated 
USING (true) WITH CHECK (true);

-- FAMILY MEMBERS
CREATE POLICY "Atomic_Sync_Policy_Family_Members" 
ON family_members FOR ALL TO authenticated 
USING (true) WITH CHECK (true);

-- SURVEYS
CREATE POLICY "Atomic_Sync_Policy_Surveys" 
ON surveys FOR ALL TO authenticated 
USING (true) WITH CHECK (true);

-- SURVEY ART RESPONSES
CREATE POLICY "Atomic_Sync_Policy_Survey_Art" 
ON survey_art_responses FOR ALL TO authenticated 
USING (true) WITH CHECK (true);

-- Pastikan RLS tetap aktif di tabel-tabel tersebut
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_art_responses ENABLE ROW LEVEL SECURITY;

-- SELESAI 🎉
