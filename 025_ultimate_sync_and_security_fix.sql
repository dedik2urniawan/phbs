-- =========================================================
-- PATCH 025: ULTIMATE SYNC, FK, TYPE MISMATCH & SECURITY FIX
-- Tujuan:
-- 1. FIX FATAL BUG: Normalisasi i13_pengunjung_posyandu (text[] vs boolean)
--    yang menyebabkan error 42804 dan menggagalkan seluruh transaksi sync (20k+ errors).
-- 2. FIX NOT-NULL CONSTRAINT: Guarding household_id null pada family_members.
-- 3. FIX UNIQUE CONSTRAINT: Dedup NIK pada family_members agar tidak bentrok nik_global_unique.
-- 4. CLEANUP RLS: Hapus policy ganda pada ref_puskesmas (Multiple Permissive Policies).
-- 5. SECURITY HARDENING: Explicit search_path & grant permissions.
-- =========================================================

BEGIN;

-- 1. Pembersihan Policy Ganda pada ref_puskesmas
DO $$ 
DECLARE 
    r RECORD;
BEGIN 
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'ref_puskesmas'
    ) 
    LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.ref_puskesmas', r.policyname); 
    END LOOP; 
END $$;

ALTER TABLE public.ref_puskesmas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ref_puskesmas_select_authenticated" 
ON public.ref_puskesmas FOR SELECT TO authenticated 
USING (true);

CREATE POLICY "ref_puskesmas_update_superadmin" 
ON public.ref_puskesmas FOR UPDATE TO authenticated 
USING ((SELECT public.get_my_role()) = 'superadmin');


-- 2. Perbaikan RPC sync_offline_composite (Bebas Error 42804, 23502, 23505)
CREATE OR REPLACE FUNCTION public.sync_offline_composite(
    p_household jsonb DEFAULT NULL,
    p_members jsonb DEFAULT '[]'::jsonb,
    p_survey jsonb DEFAULT NULL,
    p_art_responses jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_household_id uuid;
    v_survey_id uuid;
    v_member_map jsonb := '{}'::jsonb;
    v_m jsonb;
    v_art jsonb;
    v_new_member_id uuid;
    v_mapped_member_id uuid;
    v_existing_member_id uuid;
    v_target_hh_id uuid;
    v_kader_id uuid := NULL;
    v_raw_kader text;
    v_i13_arr text[] := NULL;
BEGIN
    -- Validasi Auth
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User is not authenticated';
    END IF;

    -- A. HOUSEHOLD UPSERT & RESOLUTION
    IF p_household IS NOT NULL AND (p_household->>'id') IS NOT NULL THEN
        v_household_id := (p_household->>'id')::uuid;
        
        INSERT INTO public.households (
            id, puskesmas_id, desa_id, no_kk, nik_kk, nama_kk, 
            alamat, rt, rw, created_by, created_at, updated_at
        ) VALUES (
            v_household_id,
            (p_household->>'puskesmas_id')::uuid,
            (p_household->>'desa_id')::uuid,
            p_household->>'no_kk',
            p_household->>'nik_kk',
            p_household->>'nama_kk',
            p_household->>'alamat',
            p_household->>'rt',
            p_household->>'rw',
            COALESCE((p_household->>'created_by')::uuid, v_user_id),
            COALESCE((p_household->>'created_at')::timestamptz, now()),
            COALESCE((p_household->>'updated_at')::timestamptz, now())
        )
        ON CONFLICT (id) DO UPDATE SET
            puskesmas_id = EXCLUDED.puskesmas_id,
            desa_id      = EXCLUDED.desa_id,
            no_kk        = EXCLUDED.no_kk,
            nik_kk       = EXCLUDED.nik_kk,
            nama_kk      = EXCLUDED.nama_kk,
            alamat       = EXCLUDED.alamat,
            rt           = EXCLUDED.rt,
            rw           = EXCLUDED.rw,
            updated_at   = EXCLUDED.updated_at;
    ELSE
        IF p_survey IS NOT NULL AND (p_survey->>'household_id') IS NOT NULL THEN
            v_household_id := (p_survey->>'household_id')::uuid;
        END IF;
    END IF;

    -- B. FAMILY MEMBERS UPSERT (Kebal NOT-NULL & NIK Unique Constraint)
    IF jsonb_array_length(p_members) > 0 THEN
        FOR v_m IN SELECT * FROM jsonb_array_elements(p_members) LOOP
            v_new_member_id := (v_m->>'id')::uuid;
            v_target_hh_id := COALESCE((v_m->>'household_id')::uuid, v_household_id);

            -- Guarding Not-Null constraint household_id
            IF v_target_hh_id IS NULL THEN
                CONTINUE;
            END IF;

            -- Guarding nik_global_unique: Jika NIK sudah dipakai oleh member lain, petakan ID ke member tersebut
            IF (v_m->>'nik') IS NOT NULL AND trim(v_m->>'nik') != '' THEN
                SELECT id INTO v_existing_member_id 
                FROM public.family_members 
                WHERE nik = trim(v_m->>'nik') 
                LIMIT 1;

                IF v_existing_member_id IS NOT NULL THEN
                    v_new_member_id := v_existing_member_id;
                END IF;
            END IF;

            INSERT INTO public.family_members (
                id, household_id, nama, nik, jenis_kelamin, 
                tgl_lahir, hubungan_kk, pendidikan, pekerjaan, created_at
            ) VALUES (
                v_new_member_id,
                v_target_hh_id,
                v_m->>'nama',
                v_m->>'nik',
                v_m->>'jenis_kelamin',
                (v_m->>'tgl_lahir')::date,
                v_m->>'hubungan_kk',
                v_m->>'pendidikan',
                v_m->>'pekerjaan',
                COALESCE((v_m->>'created_at')::timestamptz, now())
            )
            ON CONFLICT (id) DO UPDATE SET
                household_id = EXCLUDED.household_id,
                nama         = EXCLUDED.nama,
                nik          = EXCLUDED.nik,
                jenis_kelamin= EXCLUDED.jenis_kelamin,
                tgl_lahir    = EXCLUDED.tgl_lahir,
                hubungan_kk  = EXCLUDED.hubungan_kk,
                pendidikan   = EXCLUDED.pendidikan,
                pekerjaan    = EXCLUDED.pekerjaan;

            v_member_map := jsonb_set(v_member_map, ARRAY[v_m->>'id'], to_jsonb(v_new_member_id::text));
        END LOOP;
    END IF;

    -- C. SURVEY UPSERT (Normalisasi i13_pengunjung_posyandu Sebagai text[])
    IF p_survey IS NOT NULL AND (p_survey->>'id') IS NOT NULL THEN
        v_survey_id := (p_survey->>'id')::uuid;
        
        -- Validasi Kebal FK kader_id
        v_raw_kader := p_survey->>'kader_id';
        IF v_raw_kader IS NOT NULL AND v_raw_kader != '' THEN
            BEGIN
                IF EXISTS (SELECT 1 FROM public.kader_phbs WHERE id = v_raw_kader::uuid) THEN
                    v_kader_id := v_raw_kader::uuid;
                ELSE
                    v_kader_id := NULL;
                END IF;
            EXCEPTION WHEN OTHERS THEN
                v_kader_id := NULL;
            END;
        ELSE
            v_kader_id := NULL;
        END IF;

        -- Normalisasi i13_pengunjung_posyandu (text[])
        IF (p_survey->>'i13_pengunjung_posyandu') IS NOT NULL AND jsonb_typeof(p_survey->'i13_pengunjung_posyandu') = 'array' THEN
            SELECT ARRAY(SELECT jsonb_array_elements_text(p_survey->'i13_pengunjung_posyandu')) INTO v_i13_arr;
        ELSE
            v_i13_arr := NULL;
        END IF;

        INSERT INTO public.surveys (
            id, household_id, tahun, survey_date,
            i1_persalinan_nakes, i2_asi_eksklusif, i3_menimbang_balita,
            i4_air_bersih, i5_cuci_tangan, i6_jamban_sehat, i7_psn,
            i8_makan_sayur_buah, i9_aktivitas_fisik, i10_tidak_merokok,
            i11_cek_kesehatan, i12_kunjungan_posyandu, i13_pengunjung_posyandu,
            i14_ibu_hamil, i15_ibu_hamil_ttd, i16_remaja_putri, i17_remaja_putri_ttd,
            catatan, skor_phbs, denominator_phbs, is_rt_sehat, kategori_phbs,
            kader_id, created_by, created_at, updated_at
        ) VALUES (
            v_survey_id,
            v_household_id,
            COALESCE((p_survey->>'tahun')::integer, EXTRACT(YEAR FROM now())::integer),
            COALESCE((p_survey->>'survey_date')::date, CURRENT_DATE),
            (p_survey->>'i1_persalinan_nakes')::boolean,
            (p_survey->>'i2_asi_eksklusif')::boolean,
            (p_survey->>'i3_menimbang_balita')::boolean,
            COALESCE((p_survey->>'i4_air_bersih')::boolean, false),
            COALESCE((p_survey->>'i5_cuci_tangan')::boolean, false),
            COALESCE((p_survey->>'i6_jamban_sehat')::boolean, false),
            COALESCE((p_survey->>'i7_psn')::boolean, false),
            COALESCE((p_survey->>'i8_makan_sayur_buah')::boolean, false),
            COALESCE((p_survey->>'i9_aktivitas_fisik')::boolean, false),
            COALESCE((p_survey->>'i10_tidak_merokok')::boolean, false),
            (p_survey->>'i11_cek_kesehatan')::boolean,
            (p_survey->>'i12_kunjungan_posyandu')::boolean,
            v_i13_arr,
            (p_survey->>'i14_ibu_hamil')::boolean,
            (p_survey->>'i15_ibu_hamil_ttd')::boolean,
            (p_survey->>'i16_remaja_putri')::boolean,
            (p_survey->>'i17_remaja_putri_ttd')::boolean,
            p_survey->>'catatan',
            COALESCE((p_survey->>'skor_phbs')::integer, 0),
            COALESCE((p_survey->>'denominator_phbs')::integer, 10),
            COALESCE((p_survey->>'is_rt_sehat')::boolean, false),
            COALESCE(p_survey->>'kategori_phbs', 'TIDAK SEHAT'),
            v_kader_id,
            COALESCE((p_survey->>'created_by')::uuid, v_user_id),
            COALESCE((p_survey->>'created_at')::timestamptz, now()),
            COALESCE((p_survey->>'updated_at')::timestamptz, now())
        )
        ON CONFLICT (id) DO UPDATE SET
            survey_date             = EXCLUDED.survey_date,
            i1_persalinan_nakes     = EXCLUDED.i1_persalinan_nakes,
            i2_asi_eksklusif        = EXCLUDED.i2_asi_eksklusif,
            i3_menimbang_balita     = EXCLUDED.i3_menimbang_balita,
            i4_air_bersih           = EXCLUDED.i4_air_bersih,
            i5_cuci_tangan          = EXCLUDED.i5_cuci_tangan,
            i6_jamban_sehat         = EXCLUDED.i6_jamban_sehat,
            i7_psn                  = EXCLUDED.i7_psn,
            i8_makan_sayur_buah     = EXCLUDED.i8_makan_sayur_buah,
            i9_aktivitas_fisik      = EXCLUDED.i9_aktivitas_fisik,
            i10_tidak_merokok       = EXCLUDED.i10_tidak_merokok,
            i11_cek_kesehatan       = EXCLUDED.i11_cek_kesehatan,
            i12_kunjungan_posyandu  = EXCLUDED.i12_kunjungan_posyandu,
            i13_pengunjung_posyandu = EXCLUDED.i13_pengunjung_posyandu,
            i14_ibu_hamil           = EXCLUDED.i14_ibu_hamil,
            i15_ibu_hamil_ttd       = EXCLUDED.i15_ibu_hamil_ttd,
            i16_remaja_putri        = EXCLUDED.i16_remaja_putri,
            i17_remaja_putri_ttd    = EXCLUDED.i17_remaja_putri_ttd,
            catatan                 = EXCLUDED.catatan,
            skor_phbs               = EXCLUDED.skor_phbs,
            denominator_phbs        = EXCLUDED.denominator_phbs,
            is_rt_sehat             = EXCLUDED.is_rt_sehat,
            kategori_phbs           = EXCLUDED.kategori_phbs,
            kader_id                = EXCLUDED.kader_id,
            updated_at              = EXCLUDED.updated_at;
    END IF;

    -- D. SURVEY ART RESPONSES UPSERT
    IF jsonb_array_length(p_art_responses) > 0 THEN
        FOR v_art IN SELECT * FROM jsonb_array_elements(p_art_responses) LOOP
            v_mapped_member_id := (v_member_map->>(v_art->>'family_member_id'))::uuid;
            IF v_mapped_member_id IS NULL THEN
                v_mapped_member_id := (v_art->>'family_member_id')::uuid;
            END IF;

            INSERT INTO public.survey_art_responses (
                id, survey_id, family_member_id,
                i1_persalinan_nakes, i2_asi_eksklusif, i3_menimbang_balita,
                i5_cuci_tangan, i8_makan_sayur_buah, i9_aktivitas_fisik,
                i10_tidak_merokok, g_cek_kesehatan, g_posyandu_hadir,
                g_ibu_hamil, g_ibu_hamil_ttd, g_remaja_putri_ttd,
                created_at, updated_at
            ) VALUES (
                (v_art->>'id')::uuid,
                v_survey_id,
                v_mapped_member_id,
                (v_art->>'i1_persalinan_nakes')::boolean,
                (v_art->>'i2_asi_eksklusif')::boolean,
                (v_art->>'i3_menimbang_balita')::boolean,
                (v_art->>'i5_cuci_tangan')::boolean,
                (v_art->>'i8_makan_sayur_buah')::boolean,
                (v_art->>'i9_aktivitas_fisik')::boolean,
                (v_art->>'i10_tidak_merokok')::boolean,
                (v_art->>'g_cek_kesehatan')::boolean,
                (v_art->>'g_posyandu_hadir')::boolean,
                (v_art->>'g_ibu_hamil')::boolean,
                (v_art->>'g_ibu_hamil_ttd')::boolean,
                (v_art->>'g_remaja_putri_ttd')::boolean,
                COALESCE((v_art->>'created_at')::timestamptz, now()),
                COALESCE((v_art->>'updated_at')::timestamptz, now())
            )
            ON CONFLICT (id) DO UPDATE SET
                i1_persalinan_nakes = EXCLUDED.i1_persalinan_nakes,
                i2_asi_eksklusif    = EXCLUDED.i2_asi_eksklusif,
                i3_menimbang_balita = EXCLUDED.i3_menimbang_balita,
                i5_cuci_tangan      = EXCLUDED.i5_cuci_tangan,
                i8_makan_sayur_buah = EXCLUDED.i8_makan_sayur_buah,
                i9_aktivitas_fisik  = EXCLUDED.i9_aktivitas_fisik,
                i10_tidak_merokok   = EXCLUDED.i10_tidak_merokok,
                g_cek_kesehatan     = EXCLUDED.g_cek_kesehatan,
                g_posyandu_hadir    = EXCLUDED.g_posyandu_hadir,
                g_ibu_hamil         = EXCLUDED.g_ibu_hamil,
                g_ibu_hamil_ttd     = EXCLUDED.g_ibu_hamil_ttd,
                g_remaja_putri_ttd  = EXCLUDED.g_remaja_putri_ttd,
                updated_at          = EXCLUDED.updated_at;
        END LOOP;
    END IF;

    NOTIFY pgrst, 'reload schema';

    RETURN jsonb_build_object(
        'success', true,
        'household_id', v_household_id,
        'survey_id', v_survey_id,
        'member_map', v_member_map
    );

EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Sync Composite Failed: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$$;

-- 3. Security Hardening
ALTER FUNCTION public.get_my_role() SET search_path = public;
ALTER FUNCTION public.get_my_puskesmas() SET search_path = public;
ALTER FUNCTION public.sync_offline_composite(jsonb, jsonb, jsonb, jsonb) SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_my_puskesmas() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_my_puskesmas() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.sync_offline_composite(jsonb, jsonb, jsonb, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.sync_offline_composite(jsonb, jsonb, jsonb, jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
