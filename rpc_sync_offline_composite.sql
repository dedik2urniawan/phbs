CREATE OR REPLACE FUNCTION sync_offline_composite(
    p_household jsonb DEFAULT NULL,
    p_members jsonb DEFAULT NULL,
    p_survey jsonb DEFAULT NULL,
    p_art_responses jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_kader_id uuid;
    v_member jsonb;
    v_art jsonb;
    v_household_id_final uuid;
    v_member_id_final uuid;
    v_member_map jsonb := '{}'::jsonb;
    v_mapped_member_id uuid;
    v_result jsonb = '{}'::jsonb;
BEGIN
    -- Dapatkan ID kader yang login
    v_kader_id := auth.uid();
    IF v_kader_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- 1. Upsert Household + Tangkap ID Final
    IF p_household IS NOT NULL THEN
        INSERT INTO households (
            id, puskesmas_id, desa_id, no_kk, nik_kk, nama_kk, alamat, rt, rw, created_by, created_at, updated_at
        ) VALUES (
            (p_household->>'id')::uuid,
            (p_household->>'puskesmas_id')::uuid,
            (p_household->>'desa_id')::uuid,
            p_household->>'no_kk',
            p_household->>'nik_kk',
            p_household->>'nama_kk',
            p_household->>'alamat',
            p_household->>'rt',
            p_household->>'rw',
            COALESCE((p_household->>'created_by')::uuid, v_kader_id),
            (p_household->>'created_at')::timestamp,
            (p_household->>'updated_at')::timestamp
        )
        ON CONFLICT (no_kk, puskesmas_id) DO UPDATE SET
            desa_id = EXCLUDED.desa_id,
            nik_kk = EXCLUDED.nik_kk,
            nama_kk = EXCLUDED.nama_kk,
            alamat = EXCLUDED.alamat,
            rt = EXCLUDED.rt,
            rw = EXCLUDED.rw,
            updated_at = EXCLUDED.updated_at
        RETURNING id INTO v_household_id_final;
    ELSE
        v_household_id_final := NULL;
    END IF;

    -- Guard: Jika ada member atau survei, household_id HARUS berhasil didapatkan
    IF (p_members IS NOT NULL AND jsonb_array_length(p_members) > 0) OR (p_survey IS NOT NULL) THEN
        IF v_household_id_final IS NULL THEN
            RAISE EXCEPTION 'Household ID could not be resolved before member/survey upsert. Parent missing!';
        END IF;
    END IF;

    -- 2. Upsert Family Members + Gunakan ID Parent Final + Tangkap Pemetaan ID Member
    IF p_members IS NOT NULL AND jsonb_array_length(p_members) > 0 THEN
        FOR v_member IN SELECT * FROM jsonb_array_elements(p_members)
        LOOP
            IF (v_member->>'nik') IS NOT NULL AND (v_member->>'nik') != '' THEN
                -- Upsert dengan NIK (Bisnis Key)
                INSERT INTO family_members (
                    id, household_id, nama, nik, jenis_kelamin, tgl_lahir, hubungan_kk, pendidikan, pekerjaan, created_at
                ) VALUES (
                    (v_member->>'id')::uuid,
                    v_household_id_final, -- Wajib pakai ID Final hasil resolusi, bukan dari payload
                    v_member->>'nama',
                    v_member->>'nik',
                    v_member->>'jenis_kelamin',
                    (v_member->>'tgl_lahir')::date,
                    v_member->>'hubungan_kk',
                    v_member->>'pendidikan',
                    v_member->>'pekerjaan',
                    (v_member->>'created_at')::timestamp
                )
                ON CONFLICT (nik) DO UPDATE SET
                    household_id = EXCLUDED.household_id, -- Opsional, untuk migrasi ke parent baru jika perlu
                    nama = EXCLUDED.nama,
                    jenis_kelamin = EXCLUDED.jenis_kelamin,
                    tgl_lahir = EXCLUDED.tgl_lahir,
                    hubungan_kk = EXCLUDED.hubungan_kk,
                    pendidikan = EXCLUDED.pendidikan,
                    pekerjaan = EXCLUDED.pekerjaan
                RETURNING id INTO v_member_id_final;
            ELSE
                -- Insert biasa tanpa NIK (Technical Key)
                INSERT INTO family_members (
                    id, household_id, nama, nik, jenis_kelamin, tgl_lahir, hubungan_kk, pendidikan, pekerjaan, created_at
                ) VALUES (
                    (v_member->>'id')::uuid,
                    v_household_id_final, -- Wajib pakai ID Final hasil resolusi
                    v_member->>'nama',
                    v_member->>'nik',
                    v_member->>'jenis_kelamin',
                    (v_member->>'tgl_lahir')::date,
                    v_member->>'hubungan_kk',
                    v_member->>'pendidikan',
                    v_member->>'pekerjaan',
                    (v_member->>'created_at')::timestamp
                )
                ON CONFLICT (id) DO UPDATE SET
                    household_id = EXCLUDED.household_id,
                    nama = EXCLUDED.nama,
                    jenis_kelamin = EXCLUDED.jenis_kelamin,
                    tgl_lahir = EXCLUDED.tgl_lahir,
                    hubungan_kk = EXCLUDED.hubungan_kk,
                    pendidikan = EXCLUDED.pendidikan,
                    pekerjaan = EXCLUDED.pekerjaan
                RETURNING id INTO v_member_id_final;
            END IF;

            -- Simpan pemetaan ID dari Payload ke ID Final dari Database (untuk referensi ART Responses)
            v_member_map := jsonb_set(v_member_map, ARRAY[v_member->>'id'], to_jsonb(v_member_id_final::text));
        END LOOP;
    END IF;

    -- 3. Upsert Survey + Gunakan ID Parent Final
    IF p_survey IS NOT NULL THEN
        INSERT INTO surveys (
            id, household_id, tahun, survey_date, kader_id, 
            i4_air_bersih, i5_cuci_tangan, i6_jamban_sehat, i7_psn, i8_makan_sayur_buah, i9_aktivitas_fisik, i10_tidak_merokok,
            i11_cek_kesehatan, i12_kunjungan_posyandu, i13_pengunjung_posyandu, i14_ibu_hamil, i16_remaja_putri,
            i1_persalinan_nakes, i2_asi_eksklusif, i3_menimbang_balita, i15_ibu_hamil_ttd, i17_remaja_putri_ttd,
            catatan, skor_phbs, denominator_phbs, is_rt_sehat, kategori_phbs, 
            created_at, updated_at
        ) VALUES (
            (p_survey->>'id')::uuid,
            v_household_id_final, -- Wajib pakai ID Final hasil resolusi
            (p_survey->>'tahun')::integer,
            (p_survey->>'survey_date')::date,
            COALESCE((p_survey->>'kader_id')::uuid, v_kader_id),
            (p_survey->>'i4_air_bersih')::boolean,
            (p_survey->>'i5_cuci_tangan')::boolean,
            (p_survey->>'i6_jamban_sehat')::boolean,
            (p_survey->>'i7_psn')::boolean,
            (p_survey->>'i8_makan_sayur_buah')::boolean,
            (p_survey->>'i9_aktivitas_fisik')::boolean,
            (p_survey->>'i10_tidak_merokok')::boolean,
            (p_survey->>'i11_cek_kesehatan')::boolean,
            (p_survey->>'i12_kunjungan_posyandu')::boolean,
            CASE WHEN (p_survey->>'i13_pengunjung_posyandu') IS NULL THEN NULL ELSE ARRAY(SELECT jsonb_array_elements_text(p_survey->'i13_pengunjung_posyandu'))::text[] END,
            (p_survey->>'i14_ibu_hamil')::boolean,
            (p_survey->>'i16_remaja_putri')::boolean,
            (p_survey->>'i1_persalinan_nakes')::boolean,
            (p_survey->>'i2_asi_eksklusif')::boolean,
            (p_survey->>'i3_menimbang_balita')::boolean,
            (p_survey->>'i15_ibu_hamil_ttd')::boolean,
            (p_survey->>'i17_remaja_putri_ttd')::boolean,
            p_survey->>'catatan',
            (p_survey->>'skor_phbs')::integer,
            (p_survey->>'denominator_phbs')::integer,
            (p_survey->>'is_rt_sehat')::boolean,
            p_survey->>'kategori_phbs',
            (p_survey->>'created_at')::timestamp,
            (p_survey->>'updated_at')::timestamp
        )
        ON CONFLICT (household_id, tahun) DO UPDATE SET
            survey_date = EXCLUDED.survey_date,
            kader_id = EXCLUDED.kader_id,
            i4_air_bersih = EXCLUDED.i4_air_bersih,
            i5_cuci_tangan = EXCLUDED.i5_cuci_tangan,
            i6_jamban_sehat = EXCLUDED.i6_jamban_sehat,
            i7_psn = EXCLUDED.i7_psn,
            i8_makan_sayur_buah = EXCLUDED.i8_makan_sayur_buah,
            i9_aktivitas_fisik = EXCLUDED.i9_aktivitas_fisik,
            i10_tidak_merokok = EXCLUDED.i10_tidak_merokok,
            i11_cek_kesehatan = EXCLUDED.i11_cek_kesehatan,
            i12_kunjungan_posyandu = EXCLUDED.i12_kunjungan_posyandu,
            i13_pengunjung_posyandu = EXCLUDED.i13_pengunjung_posyandu,
            i14_ibu_hamil = EXCLUDED.i14_ibu_hamil,
            i16_remaja_putri = EXCLUDED.i16_remaja_putri,
            i1_persalinan_nakes = EXCLUDED.i1_persalinan_nakes,
            i2_asi_eksklusif = EXCLUDED.i2_asi_eksklusif,
            i3_menimbang_balita = EXCLUDED.i3_menimbang_balita,
            i15_ibu_hamil_ttd = EXCLUDED.i15_ibu_hamil_ttd,
            i17_remaja_putri_ttd = EXCLUDED.i17_remaja_putri_ttd,
            catatan = EXCLUDED.catatan,
            skor_phbs = EXCLUDED.skor_phbs,
            denominator_phbs = EXCLUDED.denominator_phbs,
            is_rt_sehat = EXCLUDED.is_rt_sehat,
            kategori_phbs = EXCLUDED.kategori_phbs,
            updated_at = EXCLUDED.updated_at;
    END IF;

    -- 4. Upsert Survey ART Responses + Gunakan ID Member Final dari Peta Memori
    IF p_art_responses IS NOT NULL AND jsonb_array_length(p_art_responses) > 0 THEN
        FOR v_art IN SELECT * FROM jsonb_array_elements(p_art_responses)
        LOOP
            -- Coba ambil ID Final dari Peta Memori
            v_mapped_member_id := (v_member_map->>(v_art->>'family_member_id'))::uuid;
            IF v_mapped_member_id IS NULL THEN
                -- Fallback (seharusnya tidak terjadi jika relasi payload sempurna)
                v_mapped_member_id := (v_art->>'family_member_id')::uuid;
            END IF;

            INSERT INTO survey_art_responses (
                id, survey_id, family_member_id,
                i1_persalinan_nakes, i2_asi_eksklusif, i3_menimbang_balita,
                i5_cuci_tangan, i8_makan_sayur_buah, i9_aktivitas_fisik,
                i10_tidak_merokok, g_cek_kesehatan, g_posyandu_hadir,
                g_ibu_hamil, g_ibu_hamil_ttd, g_remaja_putri_ttd,
                created_at, updated_at
            ) VALUES (
                (v_art->>'id')::uuid,
                (v_art->>'survey_id')::uuid,
                v_mapped_member_id, -- GUNAKAN ID FINAL MEMBER hasil pemetaan
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
                (v_art->>'created_at')::timestamp,
                (v_art->>'updated_at')::timestamp
            )
            ON CONFLICT (survey_id, family_member_id) DO UPDATE SET
                i1_persalinan_nakes = EXCLUDED.i1_persalinan_nakes,
                i2_asi_eksklusif = EXCLUDED.i2_asi_eksklusif,
                i3_menimbang_balita = EXCLUDED.i3_menimbang_balita,
                i5_cuci_tangan = EXCLUDED.i5_cuci_tangan,
                i8_makan_sayur_buah = EXCLUDED.i8_makan_sayur_buah,
                i9_aktivitas_fisik = EXCLUDED.i9_aktivitas_fisik,
                i10_tidak_merokok = EXCLUDED.i10_tidak_merokok,
                g_cek_kesehatan = EXCLUDED.g_cek_kesehatan,
                g_posyandu_hadir = EXCLUDED.g_posyandu_hadir,
                g_ibu_hamil = EXCLUDED.g_ibu_hamil,
                g_ibu_hamil_ttd = EXCLUDED.g_ibu_hamil_ttd,
                g_remaja_putri_ttd = EXCLUDED.g_remaja_putri_ttd,
                updated_at = EXCLUDED.updated_at;
        END LOOP;
    END IF;

    -- Selesai, kembalikan status sukses beserta ID rumah tangga final
    v_result := jsonb_build_object(
        'success', true, 
        'household_id', v_household_id_final
    );
    RETURN v_result;

EXCEPTION
    -- Fail-fast untuk pelanggaran konstrain (jangan ditelan diam-diam)
    WHEN foreign_key_violation OR unique_violation THEN
        RAISE;
    WHEN OTHERS THEN
        RAISE;
END;
$$;

-- Cabut akses eksekusi dari sembarang role (anon / public)
REVOKE EXECUTE ON FUNCTION public.sync_offline_composite(jsonb, jsonb, jsonb, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_offline_composite(jsonb, jsonb, jsonb, jsonb) FROM anon;

-- Hanya role terautentikasi (kader login) yang boleh menjalankan sinkronisasi
GRANT EXECUTE ON FUNCTION public.sync_offline_composite(jsonb, jsonb, jsonb, jsonb) TO authenticated;
